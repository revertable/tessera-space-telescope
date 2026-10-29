import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MosaicConfig } from '../config.js';
import { embedDocumentChunks } from '../embedding/embeddings.js';
import { EmbeddingProviderError, type EmbeddingTarget } from '../embedding/provider.js';
import { prepareCorpus } from './corpus.js';
import { buildIndex } from './indexer.js';
import { indexExists, pruneStaleEmbeddingSpaceIndexes, readIndex, writeIndex } from './store.js';

vi.mock('../embedding/embeddings.js', () => ({ embedDocumentChunks: vi.fn() }));
vi.mock('./corpus.js', () => ({
	EMBEDDING_INPUT_VERSION: 2,
	INDEX_SCHEMA_VERSION: 4,
	prepareCorpus: vi.fn(),
	targetIndexFingerprint: vi.fn((_corpus: string, target: EmbeddingTarget) => `${target.id}-fingerprint`)
}));
vi.mock('./store.js', () => ({
	embeddingSpaceIndexDirectory: vi.fn((_config: MosaicConfig, target: EmbeddingTarget) => target.id),
	indexExists: vi.fn(),
	indexPath: vi.fn((_config: MosaicConfig, target: EmbeddingTarget, fingerprint: string) => `${target.id}/${fingerprint}.json`),
	pruneStaleEmbeddingSpaceIndexes: vi.fn(),
	readIndex: vi.fn(),
	writeIndex: vi.fn()
}));

const targets: EmbeddingTarget[] = [
	{ id: 'one', provider: 'one', model: 'one', dimensions: 2, credentialSlot: 'one' },
	{ id: 'two', provider: 'two', model: 'two', dimensions: 2, credentialSlot: 'two' },
	{ id: 'three', provider: 'three', model: 'three', dimensions: 2, credentialSlot: 'three' }
];
const config = { embedding: { targets, runtimeTargets: [targets[2], targets[0]] } } as MosaicConfig;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prepareCorpus).mockResolvedValue({
		corpusFingerprint: 'corpus',
		documentHashes: { source: 'hash' },
		chunks: [{ id: 'source:0001', sourceId: 'source', title: 'Source', section: 'Section', content: 'Text', publicUrl: null }]
	});
	vi.mocked(indexExists).mockResolvedValue(false);
	vi.mocked(readIndex).mockResolvedValue({} as Awaited<ReturnType<typeof readIndex>>);
	vi.mocked(writeIndex).mockResolvedValue('written');
});

	it('continues after one target fails and preserves successful target writes', async () => {
		vi.mocked(embedDocumentChunks).mockImplementation(async (_config, target) => {
			if (target.id === 'two') throw new Error('target two failed');
			return [[1, 0]];
		});
		const results = await buildIndex(config);
		expect(results.map(({ target, error }) => ({ id: target.id, failed: Boolean(error) }))).toEqual([
			{ id: 'one', failed: false },
			{ id: 'two', failed: true },
			{ id: 'three', failed: false }
		]);
		expect(vi.mocked(writeIndex).mock.calls.map(([, target]) => target.id)).toEqual(['one', 'three']);
		expect(vi.mocked(pruneStaleEmbeddingSpaceIndexes).mock.calls.map(([, target]) => target.id))
			.toEqual(['one', 'three']);
		for (const [, target, index] of vi.mocked(writeIndex).mock.calls) {
			expect(index).toMatchObject({
				schemaVersion: 4,
				embeddingProvider: target.provider,
				embeddingModel: target.model,
				embeddingInputVersion: 2,
				vectorDimension: target.dimensions
			});
			expect(index).not.toHaveProperty('targetId');
		}
	});

	it('validates a published artifact before pruning stale artifacts', async () => {
		vi.mocked(embedDocumentChunks).mockResolvedValue([[1, 0]]);
		await buildIndex({ embedding: { targets: [targets[0]] } } as MosaicConfig);

		expect(vi.mocked(writeIndex).mock.invocationCallOrder[0])
			.toBeLessThan(vi.mocked(readIndex).mock.invocationCallOrder[0]);
		expect(vi.mocked(readIndex).mock.invocationCallOrder[0])
			.toBeLessThan(vi.mocked(pruneStaleEmbeddingSpaceIndexes).mock.invocationCallOrder[0]);
	});

	it('preserves stale artifacts when published-artifact validation fails', async () => {
		vi.mocked(embedDocumentChunks).mockResolvedValue([[1, 0]]);
		vi.mocked(readIndex).mockRejectedValue(new Error('candidate validation failed'));
		const [result] = await buildIndex({ embedding: { targets: [targets[0]] } } as MosaicConfig);

		expect(result.error).toBe('candidate validation failed');
		expect(pruneStaleEmbeddingSpaceIndexes).not.toHaveBeenCalled();
	});

	it('preserves stale artifacts when candidate write or publication fails', async () => {
		vi.mocked(embedDocumentChunks).mockResolvedValue([[1, 0]]);
		vi.mocked(writeIndex).mockRejectedValue(new Error('candidate publication failed'));
		const [result] = await buildIndex({ embedding: { targets: [targets[0]] } } as MosaicConfig);

		expect(result.error).toBe('candidate publication failed');
		expect(readIndex).not.toHaveBeenCalled();
		expect(pruneStaleEmbeddingSpaceIndexes).not.toHaveBeenCalled();
	});

	it('validates an existing exact artifact before cleanup without embedding', async () => {
		vi.mocked(indexExists).mockResolvedValue(true);
		const [result] = await buildIndex({ embedding: { targets: [targets[0]] } } as MosaicConfig);

		expect(result.status?.state).toBe('current');
		expect(embedDocumentChunks).not.toHaveBeenCalled();
		expect(writeIndex).not.toHaveBeenCalled();
		expect(pruneStaleEmbeddingSpaceIndexes).toHaveBeenCalledWith(
			expect.anything(), targets[0], 'one-fingerprint'
		);
	});

	it('does not cleanup or embed when an existing exact artifact is invalid', async () => {
		vi.mocked(indexExists).mockResolvedValue(true);
		vi.mocked(readIndex).mockRejectedValue(new Error('The search index is invalid. Rebuild it.'));
		const [result] = await buildIndex({ embedding: { targets: [targets[0]] } } as MosaicConfig);

		expect(result.status?.state).toBe('invalid');
		expect(embedDocumentChunks).not.toHaveBeenCalled();
		expect(writeIndex).not.toHaveBeenCalled();
		expect(pruneStaleEmbeddingSpaceIndexes).not.toHaveBeenCalled();
	});
