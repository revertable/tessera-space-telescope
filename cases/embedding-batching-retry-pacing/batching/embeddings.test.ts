import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { embedDocumentChunks, embedQuestion } from './embeddings.js';
import type { EmbeddingDocumentsRequest, EmbeddingProvider, EmbeddingQueryRequest } from './provider.js';

function vector(marker: number): number[] {
	return Array.from({ length: 768 }, (_, index) => index === 0 ? marker : 0);
}

function chunks(count: number): KnowledgeChunk[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `profile:${String(index + 1).padStart(4, '0')}`,
		sourceId: 'profile',
		title: 'Profile',
		section: `Section ${index + 1}`,
		content: `chunk ${index + 1}`,
		publicUrl: null
	}));
}

describe('embedding orchestration', () => {
	it('preserves document and vector order across full and partial batches', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const documents = chunks(5);
		const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) =>
			documents.map(({ content }) => vector(Number(content.split(' ')[1])))
		);
		const factory = vi.fn((): EmbeddingProvider => ({
			documentBatching: { preferredBatchSize: 2 },
			embedQuery: vi.fn(),
			embedDocuments
		}));
		const vectors = await embedDocumentChunks(config, target, documents, factory);
		expect(factory).toHaveBeenCalledWith(target);
		expect(embedDocuments).toHaveBeenCalledTimes(3);
		expect(vectors.map((item) => item.length)).toEqual([768, 768, 768, 768, 768]);
		expect(vectors.map((item) => item[0])).toEqual([1, 2, 3, 4, 5]);
		expect(embedDocuments.mock.calls.map(([request]) => request.documents)).toEqual([
			[{ title: 'Profile', content: 'chunk 1' }, { title: 'Profile', content: 'chunk 2' }],
			[{ title: 'Profile', content: 'chunk 3' }, { title: 'Profile', content: 'chunk 4' }],
			[{ title: 'Profile', content: 'chunk 5' }]
		]);
	});

	it('returns an empty result without creating a provider', async () => {
		const config = loadConfig();
		const factory = vi.fn();
		await expect(embedDocumentChunks(config, config.embedding.targets[0], [], factory)).resolves.toEqual([]);
		expect(factory).not.toHaveBeenCalled();
	});

	it('rejects a batch response with the wrong vector count', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const embedDocuments = vi.fn(async () => [vector(1)]);
		await expect(embedDocumentChunks(config, target, chunks(3), () => ({
			documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
		}))).rejects.toThrow('unexpected number');
		expect(embedDocuments).toHaveBeenCalledTimes(1);
	});

	it('rejects a batch response with an invalid vector dimension', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const embedDocuments = vi.fn(async () => [vector(1), [2]]);
		await expect(embedDocumentChunks(config, target, chunks(2), () => ({
			documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
		}))).rejects.toThrow('768-dimension');
	});

	it('stops after a middle batch fails and does not return partial vectors', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
			if (documents[0].content === 'chunk 3') throw new Error('middle batch failed');
			return documents.map(({ content }) => vector(Number(content.split(' ')[1])));
		});
		await expect(embedDocumentChunks(config, target, chunks(5), () => ({
			documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
		}))).rejects.toThrow('middle batch failed');
		expect(embedDocuments).toHaveBeenCalledTimes(2);
		expect(embedDocuments.mock.calls.flatMap(([request]) => request.documents.map(({ content }) => content)))
			.toEqual(['chunk 1', 'chunk 2', 'chunk 3', 'chunk 4']);
	});

	it('passes the raw query and configured target to the provider adapter', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const embedQuery = vi.fn(async (_request: EmbeddingQueryRequest) => vector(9));
		await embedQuestion(config, target, 'Who is Riu Salze?', () => ({ embedQuery, embedDocuments: vi.fn() }));
		expect(embedQuery.mock.calls[0][0]).toEqual({
			target,
			query: 'Who is Riu Salze?'
		});
	});
});
