import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { chunkSource } from '../knowledge/chunker.js';
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

beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });

function buildLogs(): string[] {
	return vi.mocked(console.log).mock.calls.map(([line]) => String(line));
}

	it.each(['gemini', 'fixture-provider', 'future-provider'])('logs progress and retries for %s', async (provider) => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider };
			let attempts = 0;
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				if (++attempts === 1) throw rateLimit(59_000);
				return documents.map(() => vector(1, target.dimensions));
			});
			const pending = embedDocumentChunks(config, target, chunks(2), () => ({ embedDocuments, embedQuery: vi.fn() }));
			await vi.runAllTimersAsync();
			await pending;
			const name = provider.replace(/^./, first => first.toUpperCase());
			expect(buildLogs().filter(line => !line.includes('pacing:'))).toEqual([
				`[${name}] batch 1/2 started (attempt 1/4)`,
				`[${name}] batch 1/2 failed: HTTP 429 unknown`,
				`[${name}] batch 1/2 retry 1/3 in 59.0s`,
				`[${name}] batch 1/2 started (attempt 2/4)`,
				`[${name}] batch 1/2 complete`,
				`[${name}] batch 2/2 started (attempt 1/4)`,
				`[${name}] batch 2/2 complete`
			]);
			expect(buildLogs().filter(line => line.includes('pacing:'))).toEqual(provider === 'gemini'
				? ['[Gemini] pacing: waiting 22.0s before batch 2/2'] : []);
		} finally { vi.useRealTimers(); }
	});

	it('reports retry exhaustion and fallback waits without exposing raw error data', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'fixture-provider' };
			const error = new EmbeddingProviderError('quota_exhausted', 'secret-key response-body', true,
				{ cause: new Error('private-document') }, { httpStatus: 429 });
			const pending = embedDocumentChunks(config, target, chunks(1), () => ({
				embedDocuments: vi.fn().mockRejectedValue(error), embedQuery: vi.fn()
			}));
			const rejection = expect(pending).rejects.toMatchObject({ cause: error });
			await vi.runAllTimersAsync();
			await rejection;
			expect(buildLogs().filter(line => line.includes(' in '))).toEqual([
				'[Fixture-provider] batch 1/1 retry 1/3 in 15.0s',
				'[Fixture-provider] batch 1/1 retry 2/3 in 30.0s',
				'[Fixture-provider] batch 1/1 retry 3/3 in 60.0s'
			]);
			expect(buildLogs().at(-1)).toBe('[Fixture-provider] batch 1/1 failed after 4 attempts: retries exhausted (3/3)');
			expect(buildLogs().join('\n')).not.toMatch(/secret-key|response-body|private-document/);
		} finally { vi.useRealTimers(); }
	});

	it.each([{ values: [] }, { values: [[1]] }])('does not report success for invalid vectors', async ({ values }) => {
		const config = loadConfig();
		await expect(embedDocumentChunks(config, config.embedding.targets[0], chunks(1), () => ({
			embedDocuments: vi.fn().mockResolvedValue(values), embedQuery: vi.fn()
		}))).rejects.toThrow();
		expect(buildLogs().at(-1)).toContain('failed: invalid_response; retry not scheduled');
		expect(buildLogs().join('\n')).not.toContain('complete');
	});

	it('does not log query success or failure', async () => {
		const config = loadConfig();
		const target = { ...config.embedding.targets[0], provider: 'gemini' };
		const embedQuery = vi.fn().mockResolvedValueOnce(vector(1, target.dimensions)).mockRejectedValueOnce(rateLimit());
		const factory = () => ({ embedQuery, embedDocuments: vi.fn() });
		await embedQuestion(config, target, 'query', factory);
		await expect(embedQuestion(config, target, 'query', factory)).rejects.toThrow();
		expect(buildLogs()).toEqual([]);
	});

	it('paces all full and partial batches while leaving query embedding immediate', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'gemini' };
			const starts: number[] = [];
			const origin = performance.now();
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				starts.push(performance.now() - origin);
				return documents.map(({ content }) => vector(Number(content.split(' ')[1]), target.dimensions));
			});
			const embedQuery = vi.fn(async () => vector(9, target.dimensions));
			const factory = () => ({ documentBatching: { preferredBatchSize: 32 }, embedDocuments, embedQuery });
			const pending = embedDocumentChunks(config, target, chunks(373), factory);
			await vi.advanceTimersByTimeAsync(0);
			expect(starts).toEqual([0]);
			await vi.advanceTimersByTimeAsync(21_999);
			expect(starts).toEqual([0]);
			await expect(embedQuestion(config, target, 'query', factory)).resolves.toEqual(vector(9, target.dimensions));
			expect(embedQuery).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(1);
			expect(starts).toEqual([0, 22_000]);
			await vi.runAllTimersAsync();
			expect((await pending).map(item => item[0])).toEqual(Array.from({ length: 373 }, (_, index) => index + 1));
			expect(starts).toEqual(Array.from({ length: 12 }, (_, index) => index * 22_000));
			expect(embedDocuments.mock.calls.at(-1)![0].documents).toHaveLength(21);
			for (const start of starts) {
				expect(starts.filter(time => time >= start && time <= start + 60_000).length).toBeLessThanOrEqual(3);
			}
		} finally {
			vi.useRealTimers();
		}
	});

	it.each([5_000, 25_000])('counts the %i ms response time toward the start interval', async (responseMs) => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'gemini' };
			const origin = performance.now();
			const starts: number[] = [];
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				starts.push(performance.now() - origin);
				await new Promise<void>(resolve => setTimeout(resolve, responseMs));
				return documents.map(() => vector(1, target.dimensions));
			});
			const pending = embedDocumentChunks(config, target, chunks(33), () => ({
				documentBatching: { preferredBatchSize: 32 }, embedDocuments, embedQuery: vi.fn()
			}));
			await vi.runAllTimersAsync();
			await pending;
			expect(starts).toEqual([0, Math.max(22_000, responseMs)]);
			expect(buildLogs().filter(line => line.includes('pacing:'))).toEqual(responseMs < 22_000
				? ['[Gemini] pacing: waiting 17.0s before batch 2/2'] : []);
		} finally {
			vi.useRealTimers();
		}
	});

	it.each([
		{ retryDelayMs: undefined, expectedStart: 22_000 },
		{ retryDelayMs: 2_500, expectedStart: 22_000 },
		{ retryDelayMs: 59_000, expectedStart: 59_000 }
	])('combines pacing with provider/backoff delay $retryDelayMs', async ({ retryDelayMs, expectedStart }) => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'gemini' };
			const origin = performance.now();
			const starts: number[] = [];
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				starts.push(performance.now() - origin);
				if (starts.length === 1) throw rateLimit(retryDelayMs);
				return documents.map(() => vector(1, target.dimensions));
			});
			const pending = embedDocumentChunks(config, target, chunks(33), () => ({
				documentBatching: { preferredBatchSize: 32 }, embedDocuments, embedQuery: vi.fn()
			}));
			await vi.runAllTimersAsync();
			await pending;
			expect(starts).toEqual([0, expectedStart, expectedStart + 22_000]);
			expect(buildLogs().filter(line => line.includes('pacing:'))).toEqual([
				...(expectedStart === 22_000 ? [`[Gemini] pacing: waiting ${((22_000 - (retryDelayMs ?? 15_000)) / 1000).toFixed(1)}s before batch 1/2`] : []),
				'[Gemini] pacing: waiting 22.0s before batch 2/2'
			]);
			expect(embedDocuments.mock.calls.map(([request]) => request.documents.length)).toEqual([32, 32, 1]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps the four-attempt limit and the longer 30/60 second backoffs', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'gemini' };
			const origin = performance.now();
			const starts: number[] = [];
			const embedDocuments = vi.fn(async () => {
				starts.push(performance.now() - origin);
				throw rateLimit();
			});
			const pending = embedDocumentChunks(config, target, chunks(1), () => ({ embedDocuments, embedQuery: vi.fn() }));
			const rejection = expect(pending).rejects.toMatchObject({
				diagnostic: { httpStatus: 429, batch: { number: 1, documentOffset: 0, size: 1 } }
			});
			await vi.runAllTimersAsync();
			await rejection;
			expect(starts).toEqual([0, 22_000, 52_000, 112_000]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not pace Fixture-provider document batches', async () => {
		vi.useFakeTimers();
		try {
			const config = loadConfig();
			const target = { ...config.embedding.targets[0], provider: 'fixture-provider' };
			const origin = performance.now();
			const starts: number[] = [];
			const embedDocuments = vi.fn(async ({ documents }: EmbeddingDocumentsRequest) => {
				starts.push(performance.now() - origin);
				return documents.map(() => vector(1, target.dimensions));
			});
			await embedDocumentChunks(config, target, chunks(65), () => ({
				documentBatching: { preferredBatchSize: 32 }, embedDocuments, embedQuery: vi.fn()
			}));
			expect(starts).toEqual([0, 0, 0]);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
