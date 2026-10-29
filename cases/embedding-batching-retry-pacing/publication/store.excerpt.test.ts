import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import type { SearchIndexData } from '../types.js';
import {
	EMBEDDING_INPUT_VERSION,
	INDEX_SCHEMA_VERSION,
	targetIndexFingerprint,
	type PreparedCorpus
} from './corpus.js';
import { getTargetIndexStatus } from './indexer.js';
import {
	embeddingSpaceIndexDirectory,
	indexPath,
	pruneStaleEmbeddingSpaceIndexes,
	readIndex,
	writeIndex
} from './store.js';

const target: EmbeddingTarget = {
	id: 'gemini-embedding-2-768',
	provider: 'gemini',
	model: 'gemini-embedding-2',
	dimensions: 768,
	credentialSlot: 'primary'
};

const corpus: PreparedCorpus = {
	corpusFingerprint: 'current-corpus',
	documentHashes: { source: 'hash' },
	chunks: [{
		id: 'source:0001',
		sourceId: 'source',
		title: 'Source',
		section: 'Section',
		content: 'Text',
		publicUrl: null
	}]
};

let indexRoot: string;
let config: MosaicConfig;

function indexData(embeddingTarget: EmbeddingTarget, prepared = corpus): SearchIndexData {
	return {
		schemaVersion: INDEX_SCHEMA_VERSION,
		fingerprint: targetIndexFingerprint(prepared.corpusFingerprint, embeddingTarget),
		corpusFingerprint: prepared.corpusFingerprint,
		createdAt: '2026-09-28T00:00:00.000Z',
		embeddingProvider: embeddingTarget.provider,
		embeddingModel: embeddingTarget.model,
		embeddingInputVersion: EMBEDDING_INPUT_VERSION,
		vectorDimension: embeddingTarget.dimensions,
		documentHashes: prepared.documentHashes,
		chunks: prepared.chunks.map((chunk) => ({
			...chunk,
			vector: Array.from({ length: embeddingTarget.dimensions }, () => 0)
		}))
	};
}

beforeEach(async () => {
	const temporaryRoot = resolve(process.cwd(), '..', 'tmp');
	await mkdir(temporaryRoot, { recursive: true });
	indexRoot = await mkdtemp(resolve(temporaryRoot, 'index-store-test-'));
	config = { retrieval: { indexDirectory: indexRoot } } as MosaicConfig;
});

afterEach(async () => {
	await rm(indexRoot, { recursive: true, force: true });
});

	it('preserves the current artifact when an unsafe candidate is rejected before publication', async () => {
		const current = indexData(target);
		await writeIndex(config, target, current);
		const invalid = { ...current, chunks: current.chunks.map(chunk => ({ ...chunk, publicUrl: 'javascript:alert(1)' })) };
		await expect(writeIndex(config, target, invalid)).rejects.toThrow('invalid publicUrl');
		await expect(readIndex(config, target, current.fingerprint)).resolves.toEqual(current);
	});

	it('validates a candidate before replacing an exact current artifact', async () => {
		const current = indexData(target);
		await writeIndex(config, target, current);
		const invalid = {
			...current,
			createdAt: '2026-09-28T01:00:00.000Z',
			chunks: current.chunks.map((chunk) => ({ ...chunk, vector: chunk.vector.slice(1) }))
		};

		await expect(writeIndex(config, target, invalid)).rejects.toThrow('dimensions');
		await expect(readIndex(config, target, current.fingerprint))
			.resolves.toMatchObject({ createdAt: current.createdAt });
		expect((await readdir(embeddingSpaceIndexDirectory(config, target))).some((name) => name.endsWith('.tmp')))
			.toBe(false);
	});

	it('prunes only stale JSON artifacts in the selected embedding space', async () => {
		const olderCorpus = { ...corpus, corpusFingerprint: 'older-corpus' };
		const stale = indexData(target, olderCorpus);
		const current = indexData(target);
		const otherTarget = { ...target, model: 'another-model' };
		const other = indexData(otherTarget);
		await writeIndex(config, target, stale);
		await writeIndex(config, target, current);
		await writeIndex(config, otherTarget, other);

		await pruneStaleEmbeddingSpaceIndexes(config, target, current.fingerprint);

		expect((await readdir(embeddingSpaceIndexDirectory(config, target))).filter((name) => name.endsWith('.json')))
			.toEqual([`${current.fingerprint}.json`]);
		await expect(readIndex(config, otherTarget, other.fingerprint)).resolves.toMatchObject({
			fingerprint: other.fingerprint
		});
	});
