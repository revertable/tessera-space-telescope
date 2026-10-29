import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { loadCredentials, validateCredentialSlot } from './credentials.js';
import type { EmbeddingTarget } from './embedding/provider.js';
import type { GenerationTarget } from './generation/provider.js';

export type EmbeddingTargetDefinition = Omit<EmbeddingTarget, 'credentialSlot'>;

export function parseEmbeddingTargets(value: unknown): EmbeddingTargetDefinition[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error('embedding.targets must be a non-empty array.');
	}
	const targets = value.map((target, index) => {
		if (target === null || typeof target !== 'object') {
			throw new Error(`embedding.targets[${index}] must be an object.`);
		}
		const record = target as Record<string, unknown>;
		const id = text(record.id, `embedding.targets[${index}].id`);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
			throw new Error(`embedding.targets[${index}].id must be kebab-case.`);
		}
		return {
			id,
			provider: text(record.provider, `embedding.targets[${index}].provider`),
			model: text(record.model, `embedding.targets[${index}].model`),
			dimensions: integerInRange(record.dimensions, `embedding.targets[${index}].dimensions`, 128, 4096)
		};
	});
	if (new Set(targets.map(({ id }) => id)).size !== targets.length) {
		throw new Error('embedding target ids must be unique.');
	}
	const identities = targets.map(({ provider, model, dimensions }) => `${provider}\u0000${model}\u0000${dimensions}`);
	if (new Set(identities).size !== identities.length) {
		throw new Error('embedding targets must not duplicate provider, model, and dimensions.');
	}
	return targets;
}

export function bindEmbeddingCredentials(
	targets: EmbeddingTargetDefinition[],
	environment: NodeJS.ProcessEnv = process.env
): EmbeddingTarget[] {
	const targetBindingPattern = /^MOSAIC_EMBEDDING_(\d+)_TARGET$/;
	for (const name of Object.keys(environment)) {
		const match = targetBindingPattern.exec(name);
		if (!match) continue;
		const index = Number(match[1]);
		if (name !== `MOSAIC_EMBEDDING_${index}_TARGET` || index < 1 || index > targets.length) {
			throw new Error(`Embedding target bindings must use consecutive indexes 1 through ${targets.length}.`);
		}
	}

	const targetsById = new Map(targets.map((target) => [target.id, target]));
	const credentialSlotsByTargetId = new Map<string, string>();
	for (let index = 1; index <= targets.length; index += 1) {
		const variableName = `MOSAIC_EMBEDDING_${index}_TARGET`;
		const targetId = text(environment[variableName], variableName);
		if (!targetsById.has(targetId)) {
			throw new Error(`${variableName} references an unknown embedding target: ${targetId}.`);
		}
		if (credentialSlotsByTargetId.has(targetId)) {
			throw new Error(`Embedding target bindings must not contain duplicate target ids: ${targetId}.`);
		}
		credentialSlotsByTargetId.set(targetId, `embedding_${index}`);
	}

	return targets.map((target) => ({
		...target,
		credentialSlot: credentialSlotsByTargetId.get(target.id)!
	}));
}

export function parseRuntimeEmbeddingTargets(value: unknown, targets: EmbeddingTarget[]): EmbeddingTarget[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error('embedding.runtimeTargetIds must be a non-empty array.');
	}
	const ids = value.map((id, index) => text(id, `embedding.runtimeTargetIds[${index}]`));
	if (new Set(ids).size !== ids.length) {
		throw new Error('embedding.runtimeTargetIds must not contain duplicates.');
	}
	const targetsById = new Map(targets.map((target) => [target.id, target]));
	return ids.map((id) => {
		const target = targetsById.get(id);
		if (!target) throw new Error(`embedding.runtimeTargetIds references an unknown target: ${id}.`);
		return target;
	});
}

function text(value: unknown, label: string): string {
	if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
	return value.trim();
}

function numberInRange(value: unknown, label: string, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
		throw new Error(`${label} must be between ${min} and ${max}.`);
	}
	return value;
}

function integerInRange(value: unknown, label: string, min: number, max: number): number {
	const parsed = numberInRange(value, label, min, max);
	if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer.`);
	return parsed;
}
