import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	bindEmbeddingCredentials,
	loadConfig,
	parseEmbeddingTargets,
	parseRuntimeEmbeddingTargets
} from './config.js';

const configuredBindings = {
	MOSAIC_EMBEDDING_1_TARGET: 'cohere-embed-v4',
	MOSAIC_EMBEDDING_2_TARGET: 'voyage-4'
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

	it('loads independent build and runtime target orders from config', () => {
		const config = withEnvironment(configuredBindings, () => loadConfig());
		expect(config.generation.credentialSlot).toBe('generation');
		expect(config.embedding.targets).toEqual([
			{
				id: 'cohere-embed-v4', provider: 'cohere', model: 'embed-v4.0', dimensions: 1536, credentialSlot: 'embedding_1'
			},
			{
				id: 'voyage-4', provider: 'voyage', model: 'voyage-4', dimensions: 1024, credentialSlot: 'embedding_2'
			}
		]);
		expect(config.embedding.runtimeTargets.map(({ id }) => id)).toEqual(['cohere-embed-v4', 'voyage-4']);
		const environmentExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
		expect(environmentExample).not.toContain('MOSAIC_EMBEDDING_MODEL');
		expect(environmentExample).not.toContain('MOSAIC_PRIMARY_API_KEY');
	});

	it('resolves an explicit runtime order without deriving it from build target order', () => {
		const targets = bindEmbeddingCredentials(parseEmbeddingTargets([
			{ id: 'build-first', provider: 'a', model: 'a1', dimensions: 128 },
			{ id: 'build-second', provider: 'b', model: 'b1', dimensions: 256 }
		]), {
			MOSAIC_EMBEDDING_1_TARGET: 'build-first',
			MOSAIC_EMBEDDING_2_TARGET: 'build-second'
		});
		expect(parseRuntimeEmbeddingTargets(['build-second', 'build-first'], targets).map(({ id }) => id))
			.toEqual(['build-second', 'build-first']);
		expect(() => parseRuntimeEmbeddingTargets(undefined, targets)).toThrow('must be a non-empty array');
		expect(() => parseRuntimeEmbeddingTargets(['missing'], targets)).toThrow('unknown target');
		expect(() => parseRuntimeEmbeddingTargets(['build-first', 'build-first'], targets)).toThrow('duplicates');
	});

	it('keeps target credentials fixed when the environment overrides only runtime order', () => {
		withEnvironment({
			MOSAIC_EMBEDDING_1_TARGET: 'voyage-4',
			MOSAIC_EMBEDDING_1_API_KEY: 'voyage-secret',
			MOSAIC_EMBEDDING_2_TARGET: 'cohere-embed-v4',
			MOSAIC_EMBEDDING_2_API_KEY: 'cohere-secret',
			MOSAIC_EMBEDDING_RUNTIME_TARGETS: 'voyage-4,cohere-embed-v4'
		}, () => {
			const config = loadConfig();
			expect(config.embedding.targets.map(({ id }) => id)).toEqual(['cohere-embed-v4', 'voyage-4']);
			expect(config.embedding.targets.map(({ id, credentialSlot }) => ({ id, credentialSlot }))).toEqual([
				{ id: 'cohere-embed-v4', credentialSlot: 'embedding_2' },
				{ id: 'voyage-4', credentialSlot: 'embedding_1' }
			]);
			expect(config.credentials).toMatchObject({
				embedding_1: 'voyage-secret',
				embedding_2: 'cohere-secret'
			});
			expect(config.embedding.runtimeTargets.map(({ id }) => id)).toEqual(['voyage-4', 'cohere-embed-v4']);
		});
	});

	it('extends numbered target bindings to a synthetic third build target', () => {
		const targets = bindEmbeddingCredentials(parseEmbeddingTargets([
			{ id: 'one', provider: 'a', model: 'a1', dimensions: 128 },
			{ id: 'two', provider: 'b', model: 'b1', dimensions: 256 },
			{ id: 'three', provider: 'c', model: 'c1', dimensions: 512 }
		]), {
			MOSAIC_EMBEDDING_1_TARGET: 'two',
			MOSAIC_EMBEDDING_2_TARGET: 'three',
			MOSAIC_EMBEDDING_3_TARGET: 'one'
		});
		expect(targets.map(({ id, credentialSlot }) => ({ id, credentialSlot }))).toEqual([
			{ id: 'one', credentialSlot: 'embedding_3' },
			{ id: 'two', credentialSlot: 'embedding_1' },
			{ id: 'three', credentialSlot: 'embedding_2' }
		]);
	});

	it('rejects duplicate build target identity', () => {
		expect(() => parseEmbeddingTargets([
			{ id: 'one', provider: 'a', model: 'same', dimensions: 128 },
			{ id: 'two', provider: 'a', model: 'same', dimensions: 128 }
		])).toThrow('must not duplicate');
	});

	it('requires complete, unique, known, consecutive numbered target bindings', () => {
		const targets = parseEmbeddingTargets([
			{ id: 'one', provider: 'a', model: 'a1', dimensions: 128 },
			{ id: 'two', provider: 'b', model: 'b1', dimensions: 256 }
		]);
		expect(() => bindEmbeddingCredentials(targets, {
			MOSAIC_EMBEDDING_1_TARGET: 'one'
		})).toThrow('MOSAIC_EMBEDDING_2_TARGET must be a non-empty string');
		expect(() => bindEmbeddingCredentials(targets, {
			MOSAIC_EMBEDDING_1_TARGET: 'one',
			MOSAIC_EMBEDDING_2_TARGET: 'one'
		})).toThrow('must not contain duplicate target ids');
		expect(() => bindEmbeddingCredentials(targets, {
			MOSAIC_EMBEDDING_1_TARGET: 'one',
			MOSAIC_EMBEDDING_2_TARGET: 'missing'
		})).toThrow('unknown embedding target');
		expect(() => bindEmbeddingCredentials(targets, {
			MOSAIC_EMBEDDING_1_TARGET: 'one',
			MOSAIC_EMBEDDING_2_TARGET: 'two',
			MOSAIC_EMBEDDING_3_TARGET: 'extra'
		})).toThrow('consecutive indexes 1 through 2');
	});
