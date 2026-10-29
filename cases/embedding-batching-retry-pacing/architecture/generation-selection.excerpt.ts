import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { bindNumberedTargetCredentials, loadCredentials } from './credentials.js';
import type { EmbeddingTarget } from './embedding/provider.js';
import type { GenerationTarget } from './generation/provider.js';
import { parseGenerationOptions } from './generation/target-options.js';

export interface GenerationConfiguration {
	targets: GenerationTarget[];
	/** Derived from environment TARGET/API_KEY pairs; never declared in tracked config. */
	credentialSlots: string[];
	/** Derived metadata for consumers of the loaded configuration. */
	credentialBindings: Record<string, string>;
	runtimeTargetIds: string[];
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

export function parseGenerationConfig(value: unknown, environment: NodeJS.ProcessEnv = process.env): GenerationConfiguration {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('generation must be an object.');
	const raw = value as Record<string, unknown>;
	if (Object.hasOwn(raw, 'credentialSlots') || Object.hasOwn(raw, 'credentialBindings')) {
		throw new Error('Generation credential bindings must use environment TARGET/API_KEY pairs, not config.');
	}
	if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
		throw new Error('generation.targets must be a non-empty array.');
	}
	const definitions = raw.targets.map((target, index) => {
		if (target === null || typeof target !== 'object' || Array.isArray(target)) {
			throw new Error(`generation.targets[${index}] must contain provider and model.`);
		}
		const record = target as Record<string, unknown>;
		const id = text(record.id, `generation.targets[${index}].id`);
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Generation target ids must be kebab-case.');
		const provider = text(record.provider, `generation.targets[${index}].provider`);
		return {
			id, provider,
			model: text(record.model, `generation.targets[${index}].model`),
			options: parseGenerationOptions(provider, record.options)
		};
	});
	const ids = definitions.map((target) => target.id);
	if (new Set(ids).size !== ids.length) throw new Error('Generation target ids must be unique.');
	const targets = bindNumberedTargetCredentials('generation', definitions, environment);
	const slots = targets.map(({ credentialSlot }) => credentialSlot);
	const bindings = Object.fromEntries(targets.map(({ id, credentialSlot }) => [id, credentialSlot]));
	if (!Array.isArray(raw.runtimeTargetIds) || !raw.runtimeTargetIds.length) throw new Error('generation.runtimeTargetIds must be non-empty.');
	const runtimeTargetIds = raw.runtimeTargetIds.map((id) => text(id, 'generation.runtimeTargetIds'));
	if (new Set(runtimeTargetIds).size !== runtimeTargetIds.length) throw new Error('Generation runtime order must not contain duplicates.');
	if (runtimeTargetIds.some((id) => !ids.includes(id))) throw new Error('Generation runtime order references an unknown target.');
	return { targets, credentialSlots: slots, credentialBindings: bindings, runtimeTargetIds };
}
