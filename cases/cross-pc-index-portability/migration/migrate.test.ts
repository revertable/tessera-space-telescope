import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MosaicConfig } from '../config.js';
import type { SearchIndexData } from '../types.js';
import { prepareCorpus, targetIndexFingerprint, INDEX_SCHEMA_VERSION, EMBEDDING_INPUT_VERSION } from './corpus.js';
import { migrateIndexIdentity } from './migrate.js';
import * as store from './store.js';

const target = { id: 'cohere-test', provider: 'cohere', model: 'embed-v4.0', dimensions: 3, credentialSlot: 'test' };
let directory: string;
let config: MosaicConfig;
let legacy: SearchIndexData;

beforeEach(async () => {
	const temporaryRoot = resolve(process.cwd(), '..', 'tmp');
	await mkdir(temporaryRoot, { recursive: true });
	directory = await mkdtemp(resolve(temporaryRoot, 'identity-migration-'));
	const knowledge = resolve(directory, 'knowledge');
	await mkdir(knowledge);
	await writeFile(resolve(knowledge, 'source.md'), '# Title\r\n\r\nFirst.\r\n\r\n## Second\r\n\r\nSecond.\r\n');
	await writeFile(resolve(knowledge, 'sources.json'), JSON.stringify({
		version: 1, sources: [{ id: 'source', file: 'source.md', title: 'Title', publicUrl: null }]
	}));
	config = {
		projectRoot: directory, credentials: {},
		knowledge: { manifestPath: resolve(knowledge, 'sources.json'), maxChunkCharacters: 800, overlapCharacters: 100 },
		retrieval: { indexDirectory: resolve(directory, 'indexes'), topK: 5, minimumScore: 0.25 }
	} as MosaicConfig;
	const corpus = await prepareCorpus(config);
	legacy = {
		schemaVersion: INDEX_SCHEMA_VERSION,
		fingerprint: targetIndexFingerprint('legacy-raw-corpus', target),
		corpusFingerprint: 'legacy-raw-corpus',
		createdAt: '2026-09-30T05:44:06.336Z',
		embeddingProvider: target.provider, embeddingModel: target.model,
		embeddingInputVersion: EMBEDDING_INPUT_VERSION, vectorDimension: target.dimensions,
		documentHashes: { source: 'legacy-raw-hash' },
		chunks: corpus.chunks.map((chunk, index) => ({ ...chunk, vector: [index + 0.1, -0.25, 0.5] }))
	};
	await store.writeIndex(config, target, legacy);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await rm(directory, { recursive: true, force: true });
});

async function expectOriginalPreserved(bytes?: string) {
	const original = await readFile(store.indexPath(config, target, legacy.fingerprint), 'utf8');
	expect(original).toBe(bytes ?? JSON.stringify(legacy));
}

describe('explicit offline identity migration', () => {
	it('preserves every chunk, vector and creation time and publishes canonical metadata before removing the source', async () => {
		const corpus = await prepareCorpus(config);
		const destination = await migrateIndexIdentity(config, target, legacy.fingerprint);
		expect(destination).toBe(store.indexPath(config, target, targetIndexFingerprint(corpus.corpusFingerprint, target)));
		const migrated = await store.readIndex(config, target, targetIndexFingerprint(corpus.corpusFingerprint, target));
		expect(migrated).toEqual({ ...legacy, fingerprint: targetIndexFingerprint(corpus.corpusFingerprint, target), corpusFingerprint: corpus.corpusFingerprint, documentHashes: corpus.documentHashes });
		await expect(readFile(store.indexPath(config, target, legacy.fingerprint))).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await migrateIndexIdentity(config, target, migrated.fingerprint)).toBe(destination);
	});

	it.each(['content', 'order', 'metadata'])('refuses %s changes without touching the source or creating a destination', async (kind) => {
		if (kind === 'content') legacy.chunks[0].content += ' changed';
		if (kind === 'order') legacy.chunks.reverse();
		if (kind === 'metadata') legacy.chunks[0].title = 'Different title';
		await store.writeIndex(config, target, legacy);
		await expect(migrateIndexIdentity(config, target, legacy.fingerprint)).rejects.toThrow('identical chunk');
		await expectOriginalPreserved();
		const corpus = await prepareCorpus(config);
		expect(await store.indexExists(config, target, targetIndexFingerprint(corpus.corpusFingerprint, target))).toBe(false);
	});

	it.each(['contract', 'dimensions'])('refuses invalid legacy %s before publication', async (kind) => {
		if (kind === 'contract') legacy.embeddingInputVersion++;
		if (kind === 'dimensions') legacy.chunks[0].vector.pop();
		await writeFile(store.indexPath(config, target, legacy.fingerprint), JSON.stringify(legacy));
		await expect(migrateIndexIdentity(config, target, legacy.fingerprint)).rejects.toThrow();
		await expectOriginalPreserved();
	});

	it('refuses a conflicting canonical destination and preserves both files', async () => {
		const corpus = await prepareCorpus(config);
		const existing = { ...structuredClone(legacy), fingerprint: targetIndexFingerprint(corpus.corpusFingerprint, target), corpusFingerprint: corpus.corpusFingerprint, documentHashes: corpus.documentHashes };
		existing.chunks[0].vector[0] = 99;
		await store.writeIndex(config, target, existing);
		await expect(migrateIndexIdentity(config, target, legacy.fingerprint)).rejects.toThrow('destination conflicts');
		await expectOriginalPreserved();
		expect(await store.readIndex(config, target, existing.fingerprint)).toEqual(existing);
	});

	it('preserves the legacy file if atomic publication fails', async () => {
		vi.spyOn(store, 'writeIndex').mockRejectedValueOnce(new Error('publication failed'));
		await expect(migrateIndexIdentity(config, target, legacy.fingerprint)).rejects.toThrow('publication failed');
		await expectOriginalPreserved();
	});

	it('preserves the legacy file if verification after publication fails', async () => {
		const originalRead = store.readIndex;
		vi.spyOn(store, 'readIndex')
			.mockImplementationOnce(originalRead)
			.mockRejectedValueOnce(new Error('verification failed'));
		await expect(migrateIndexIdentity(config, target, legacy.fingerprint)).rejects.toThrow('verification failed');
		await expectOriginalPreserved();
	});

	it('rejects path-like fingerprints before reading or writing an artifact', async () => {
		await expect(migrateIndexIdentity(config, target, '../outside')).rejects.toThrow('Invalid legacy');
		await expectOriginalPreserved();
	});
});
