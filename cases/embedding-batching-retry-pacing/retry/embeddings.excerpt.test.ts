import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { embedDocumentChunks, embedQuestion } from './embeddings.js';
import {
	EmbeddingProviderError,
	type EmbeddingDocumentsRequest,
	type EmbeddingProvider,
	type EmbeddingQueryRequest
} from './provider.js';

function vector(marker: number, dimensions: number): number[] {
	return Array.from({ length: dimensions }, (_, index) => index === 0 ? marker : 0);
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

function rateLimit(retryDelayMs?: number): EmbeddingProviderError {
	return new EmbeddingProviderError(
		'unknown',
		'Embedding provider request failed.',
		true,
		undefined,
		{ httpStatus: 429, ...(retryDelayMs !== undefined ? { retryDelayMs } : {}) }
	);
}

	it('retries only the current document batch with the bounded 15, 30, and 60 second fallback', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = config.embedding.targets[0];
			let currentBatchAttempts = 0;
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				if (documents[0].content === 'chunk 3' && currentBatchAttempts++ < 3) throw rateLimit();
				return documents.map(({ content }) => vector(Number(content.split(' ')[1]), target.dimensions));
			});
			const pending = embedDocumentChunks(config, target, chunks(5), () => ({
				documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
			}));

			await vi.advanceTimersByTimeAsync(0);
			expect(embedDocuments).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(14_999);
			expect(embedDocuments).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(1);
			expect(embedDocuments).toHaveBeenCalledTimes(3);
			await vi.advanceTimersByTimeAsync(30_000);
			expect(embedDocuments).toHaveBeenCalledTimes(4);
			await vi.advanceTimersByTimeAsync(60_000);

			await expect(pending).resolves.toEqual([
				vector(1, target.dimensions),
				vector(2, target.dimensions),
				vector(3, target.dimensions),
				vector(4, target.dimensions),
				vector(5, target.dimensions)
			]);
			expect(embedDocuments.mock.calls.map(([request]) => request.documents.map(({ content }) => content))).toEqual([
				['chunk 1', 'chunk 2'],
				['chunk 3', 'chunk 4'],
				['chunk 3', 'chunk 4'],
				['chunk 3', 'chunk 4'],
				['chunk 3', 'chunk 4'],
				['chunk 5']
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('prefers an explicit safe retry delay over fallback backoff', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = config.embedding.targets[0];
			const embedDocuments = vi.fn()
				.mockRejectedValueOnce(rateLimit(2_500))
				.mockResolvedValueOnce([vector(1, target.dimensions)]);
			const pending = embedDocumentChunks(config, target, chunks(1), () => ({
				documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
			}));

			await vi.advanceTimersByTimeAsync(2_499);
			expect(embedDocuments).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			await expect(pending).resolves.toEqual([vector(1, target.dimensions)]);
			expect(embedDocuments).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it('stops after four attempts and retains final batch context', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = config.embedding.targets[0];
			const embedDocuments = vi.fn().mockRejectedValue(rateLimit());
			const pending = embedDocumentChunks(config, target, chunks(1), () => ({
				documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
			}));
			const rejection = expect(pending).rejects.toMatchObject({
				diagnostic: {
					httpStatus: 429,
					batch: { number: 1, documentOffset: 0, size: 1 }
				}
			});
			await vi.runAllTimersAsync();
			await rejection;
			expect(embedDocuments).toHaveBeenCalledTimes(4);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not retry non-429 or unsafe explicit delays', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		for (const failure of [
			new EmbeddingProviderError('temporary_unavailable', 'failed', true, undefined, { httpStatus: 503 }),
			rateLimit(60_001)
		]) {
			const embedDocuments = vi.fn().mockRejectedValue(failure);
			await expect(embedDocumentChunks(config, target, chunks(1), () => ({
				documentBatching: { preferredBatchSize: 2 }, embedQuery: vi.fn(), embedDocuments
			}))).rejects.toBeInstanceOf(EmbeddingProviderError);
			expect(embedDocuments).toHaveBeenCalledOnce();
		}
	});

	it('does not apply document retry policy to query embedding', async () => {
		const config = loadConfig();
		const target = config.embedding.targets[0];
		const embedQuery = vi.fn().mockRejectedValue(rateLimit());
		await expect(embedQuestion(config, target, 'Who is Riu Salze?', () => ({
			embedQuery,
			embedDocuments: vi.fn()
		}))).rejects.toBeInstanceOf(EmbeddingProviderError);
		expect(embedQuery).toHaveBeenCalledOnce();
	});
