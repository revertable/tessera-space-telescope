import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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
	id: 'gemini-primary',
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


	it('uses a readable space directory independent of runtime target metadata', () => {
		const renamed = { ...target, id: 'fallback-runtime-role', credentialSlot: 'rotated_credential' };
		const directory = embeddingSpaceIndexDirectory(config, target);
		expect(relative(indexRoot, directory).split(sep)).toEqual([
			'provider=gemini',
			'model=gemini-embedding-2',
			'dimensions=768',
			'input=v2'
		]);
		expect(embeddingSpaceIndexDirectory(config, renamed)).toBe(directory);

		const fingerprint = targetIndexFingerprint(corpus.corpusFingerprint, target);
		expect(indexPath(config, renamed, fingerprint)).toBe(indexPath(config, target, fingerprint));
		const otherCorpusFingerprint = targetIndexFingerprint('older-corpus', target);
		expect(otherCorpusFingerprint).not.toBe(fingerprint);
		expect(dirname(indexPath(config, target, otherCorpusFingerprint))).toBe(directory);

		for (const changed of [
			{ ...target, provider: 'cohere' },
			{ ...target, model: 'another-model' },
			{ ...target, dimensions: 1536 }
		]) {
			expect(embeddingSpaceIndexDirectory(config, changed)).not.toBe(directory);
		}
		expect(embeddingSpaceIndexDirectory(config, target, EMBEDDING_INPUT_VERSION + 1)).not.toBe(directory);
	});

	it('encodes unsafe and uppercase provider/model bytes deterministically', () => {
		const unsafe = { ...target, provider: 'Vendor/UPPER', model: 'Model:*?' };
		const parts = relative(indexRoot, embeddingSpaceIndexDirectory(config, unsafe)).split(sep);
		expect(parts).toEqual([
			'provider=%56endor%2F%55%50%50%45%52',
			'model=%4Dodel%3A%2A%3F',
			'dimensions=768',
			'input=v2'
		]);
		expect(embeddingSpaceIndexDirectory(config, unsafe))
			.toBe(embeddingSpaceIndexDirectory(config, { ...unsafe }));
	});

	it('reuses an index across runtime target id and credential changes', async () => {
		const data = indexData(target);
		await writeIndex(config, target, data);
		const renamed = { ...target, id: 'gemini-fallback', credentialSlot: 'fallback' };
		await expect(readIndex(config, renamed, data.fingerprint)).resolves.toMatchObject({
			fingerprint: data.fingerprint,
			embeddingProvider: target.provider,
			embeddingModel: target.model,
			embeddingInputVersion: EMBEDDING_INPUT_VERSION
		});
	});

	it('reuses a copied artifact from another checkout root', async () => {
		const data = indexData(target);
		await writeIndex(config, target, data);
		const copiedRoot = await mkdtemp(resolve(process.cwd(), '..', 'tmp', 'index-store-copy-'));
		const copiedConfig = { retrieval: { indexDirectory: copiedRoot } } as MosaicConfig;
		try {
			await cp(
				embeddingSpaceIndexDirectory(config, target),
				embeddingSpaceIndexDirectory(copiedConfig, target),
				{ recursive: true }
			);
			await expect(getTargetIndexStatus(copiedConfig, target, corpus))
				.resolves.toMatchObject({ state: 'current', fingerprint: data.fingerprint });
		} finally {
			await rm(copiedRoot, { recursive: true, force: true });
		}
	});
