import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	bindEmbeddingCredentials,
	loadConfig,
	parseEmbeddingTargets,
	parseGenerationConfig,
	parseRuntimeEmbeddingTargets
} from './config.js';

const configuredBindings = {
	MOSAIC_EMBEDDING_1_TARGET: 'cohere-embed-v4-1536',
	MOSAIC_EMBEDDING_2_TARGET: undefined,
	MOSAIC_EMBEDDING_3_TARGET: 'gemini-embedding-2-768',
	MOSAIC_EMBEDDING_4_TARGET: 'gemini-embedding-2-1536'
};

function withEnvironment<T>(values: Record<string, string | undefined>, run: () => T): T {
	const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
	for (const [name, value] of Object.entries(values)) {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	try {
		return run();
	} finally {
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
}

const generationBindings = {
	MOSAIC_GENERATION_1_TARGET: 'gemini-3-5-flash-lite',
	MOSAIC_GENERATION_2_TARGET: 'gemini-3-1-flash-lite',
	MOSAIC_GENERATION_3_TARGET: 'cohere-command-a-plus',
	MOSAIC_GENERATION_4_TARGET: 'groq-qwen3-8-27b'
};

	function raw() {
		return JSON.parse(readFileSync(resolve(process.cwd(), '../config/mosaic.json'), 'utf8')).generation;
	}

	it('derives one slot per target and keeps runtime independent of registry and slot order', () => {
		const input = raw();
		input.targets.reverse();
		const generation = parseGenerationConfig(input, generationBindings);
		expect(generation.runtimeTargetIds).toEqual(['gemini-3-5-flash-lite', 'gemini-3-1-flash-lite']);
		expect(generation.targets.filter((t) => t.provider === 'gemini').map((t) => t.credentialSlot)).toEqual(['generation_2', 'generation_1']);
		input.runtimeTargetIds.reverse();
		expect(parseGenerationConfig(input, generationBindings).credentialBindings).toEqual(generation.credentialBindings);
		const rebound = { ...generationBindings, MOSAIC_GENERATION_3_TARGET: 'groq-qwen3-8-27b', MOSAIC_GENERATION_4_TARGET: 'cohere-command-a-plus' };
		expect(parseGenerationConfig(input, rebound).credentialBindings['cohere-command-a-plus']).toBe('generation_4');
		expect(parseGenerationConfig(input, generationBindings).runtimeTargetIds).toEqual(input.runtimeTargetIds);
	});
	it('allows the same model with different option profiles under distinct target ids', () => {
		const input = raw();
		input.targets.push({ ...input.targets[0], id: 'alternate-sampling', options: { maxOutputTokens: 1200, temperature: 0.2 } });
		expect(parseGenerationConfig(input, { ...generationBindings, MOSAIC_GENERATION_7_TARGET: 'alternate-sampling' }).targets).toHaveLength(5);
	});

	it('loads optional generation credentials without requiring evaluation targets', () => {
		withEnvironment({ MOSAIC_GENERATION_3_API_KEY: '', MOSAIC_GENERATION_4_API_KEY: '' }, () => {
			const config = loadConfig();
			expect(config.credentials.generation_4).toBe('');
			expect(config.credentials.generation_3).toBe('');
		});
	});
	it('rejects legacy model overrides instead of silently changing target identity', () => {
		withEnvironment({ MOSAIC_GENERATION_MODEL: 'override' }, () => expect(() => loadConfig()).toThrow('Legacy generation'));
	});
