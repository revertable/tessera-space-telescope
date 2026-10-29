import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	bindEmbeddingCredentials,
	loadConfig,
	parseEmbeddingTargets,
	parseGenerationConfig,
	parseRuntimeEmbeddingTargets,
	parseIntentTopK,
	parseClassificationConfig
} from './config.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));

const configuredBindings = {
	MOSAIC_EMBEDDING_1_TARGET: undefined,
	MOSAIC_EMBEDDING_2_TARGET: undefined,
	MOSAIC_EMBEDDING_3_TARGET: 'gemini-embedding-2-768',
};

	it('keeps shared project configuration synchronized without source adapters', () => {
		const projectRoot = resolve(process.cwd(), '..');
		const actual = JSON.parse(readFileSync(resolve(projectRoot, 'config/mosaic.json'), 'utf8'));
		const example = JSON.parse(readFileSync(resolve(projectRoot, 'config/mosaic.example.json'), 'utf8'));
		expect(example.knowledge).toEqual(actual.knowledge);
		expect(example.classification).toEqual(actual.classification);
		expect(example.retrieval).toEqual(actual.retrieval);
		expect(example.embedding.runtimeTargetIds).toEqual(actual.embedding.runtimeTargetIds);
		expect(example.embedding.targets).toEqual(actual.embedding.targets);
		expect(example.generation).toEqual(actual.generation);
		expect(actual.generation.targets.map(({ provider, options }: { provider: string; options: { maxOutputTokens: number } }) => ({ provider, maxOutputTokens: options.maxOutputTokens }))).toEqual([
			{ provider: 'gemini', maxOutputTokens: 32768 },
			{ provider: 'groq', maxOutputTokens: 4096 }
		]);
		expect(actual.embedding.runtimeTargetIds).toEqual(['gemini-embedding-2-768']);
		expect(actual.retrieval.indexDirectory).toBe('indexes');
		expect(readFileSync(resolve(process.cwd(), '.env.example'), 'utf8'))
			.toContain('MOSAIC_INDEX_DIRECTORY=indexes');
		expect(actual.knowledge).not.toHaveProperty('sources');
	});

const generationBindings = {
	MOSAIC_GENERATION_1_TARGET: 'gemini-3-5-flash-lite',
	MOSAIC_GENERATION_2_TARGET: 'groq-gpt-oss-120b'
};

beforeEach(() => {
	vi.stubEnv('MOSAIC_GENERATION_3_TARGET', undefined);
	vi.stubEnv('MOSAIC_GENERATION_4_TARGET', undefined);
	for (const [name, value] of Object.entries({ ...generationBindings, ...configuredBindings })) vi.stubEnv(name, value);
	for (const intent of ['LOOKUP', 'SYNTHESIS', 'AGGREGATE']) vi.stubEnv(`MOSAIC_RETRIEVAL_${intent}_TOP_K`, undefined);
});
afterEach(() => vi.unstubAllEnvs());

	function raw() {
		return JSON.parse(readFileSync(resolve(process.cwd(), '../config/mosaic.json'), 'utf8')).generation;
	}
	it('registers GPT-OSS as the only runtime fallback', () => {
		const generation = parseGenerationConfig(raw(), generationBindings);
		expect(generation.runtimeTargetIds).toEqual(['gemini-3-5-flash-lite', 'groq-gpt-oss-120b']);
		expect(generation.targets).toHaveLength(2);
		expect(generation.targets.find(t => t.id === 'groq-gpt-oss-120b')).toMatchObject({
			provider: 'groq', model: 'openai/gpt-oss-120b', credentialSlot: 'generation_2',
			options: { maxOutputTokens: 4096, reasoningEffort: 'medium' }
		});
	});
