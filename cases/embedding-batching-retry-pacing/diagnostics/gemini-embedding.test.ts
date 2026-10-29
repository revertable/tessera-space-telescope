import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { classifyGeminiEmbeddingError, GEMINI_DOCUMENT_BATCHING, GeminiEmbeddingProvider } from './embedding.js';

function providerError(status: number, error: object): ApiError {
	return new ApiError({ status, message: JSON.stringify({ error }) });
}

describe('Gemini embedding adapter', () => {
	const target = { id: 'gemini-test', provider: 'gemini', model: 'embedding-model', dimensions: 3, credentialSlot: 'primary' };

	it('translates the capability request to Gemini embedContent', async () => {
		const values = [1, 2, 3];
		const embedContent = vi.fn(async (_request: unknown) => ({ embeddings: [{ values }] }));
		const provider = new GeminiEmbeddingProvider({ models: { embedContent } } as any);
		await expect(provider.embedQuery({
			target,
			query: 'input'
		})).resolves.toBe(values);
		expect(embedContent.mock.calls[0][0]).toEqual({
			model: 'embedding-model',
			contents: 'task: question answering | query: input',
			config: { outputDimensionality: 3 }
		});
	});

	it('rejects an unexpected provider response count', async () => {
		const provider = new GeminiEmbeddingProvider({
			models: { embedContent: vi.fn(async () => ({ embeddings: [] })) }
		} as any);
		await expect(provider.embedQuery({
			target,
			query: 'input'
		})).rejects.toThrow('unexpected number');
	});

	it('embeds multiple inputs in one ordered request', async () => {
		const values = [[1, 0], [0, 1]];
		const embedContent = vi.fn(async (_request: unknown) => ({
			embeddings: values.map((item) => ({ values: item }))
		}));
		const provider = new GeminiEmbeddingProvider({ models: { embedContent } } as any);
		expect(provider.documentBatching).toEqual(GEMINI_DOCUMENT_BATCHING);
		expect(provider.documentBatching).toEqual({ preferredBatchSize: 32 });
		await expect(provider.embedDocuments({
			target: { ...target, dimensions: 2 },
			documents: [
				{ title: 'First', content: 'query' },
				{ title: 'Second', content: 'document' }
			]
		})).resolves.toEqual(values);
		expect(embedContent).toHaveBeenCalledWith({
			model: 'embedding-model',
			contents: [
				{ role: 'user', parts: [{ text: 'title: First | text: query' }] },
				{ role: 'user', parts: [{ text: 'title: Second | text: document' }] }
			],
			config: { outputDimensionality: 2 }
		});
	});

	it('normalizes a retryable 429 without retrying the request', async () => {
		const error = providerError(429, {
			code: 'rate_limit_exceeded',
			details: [{
				'@type': 'type.googleapis.com/google.rpc.RetryInfo',
				retryDelay: '2.5s'
			}]
		});
		const embedContent = vi.fn().mockRejectedValue(error);
		const provider = new GeminiEmbeddingProvider({ models: { embedContent } } as any);

		await expect(provider.embedDocuments({
			target,
			documents: [{ title: 'First', content: 'document' }]
		})).rejects.toMatchObject({
			name: 'EmbeddingProviderError',
			kind: 'rate_limit',
			fallbackable: true,
			diagnostic: {
				httpStatus: 429,
				providerCode: 'rate_limit_exceeded',
				retryDelayMs: 2500
			}
		});
		expect(embedContent).toHaveBeenCalledOnce();
	});

	it.each([
		['quota_exceeded', 'quota_exhausted'],
		['rate_limit_exceeded', 'rate_limit'],
		['too_many_requests', 'rate_limit']
	] as const)('classifies the 429 provider code %s as %s', (code, kind) => {
		expect(classifyGeminiEmbeddingError(providerError(429, { code }))).toEqual({
			kind,
			fallbackable: true,
			diagnostic: { httpStatus: 429, providerCode: code }
		});
	});

	it.each([
		['HTTP status only', {}],
		['RESOURCE_EXHAUSTED only', { code: 429, status: 'RESOURCE_EXHAUSTED' }],
		['RESOURCE_EXHAUSTED with RetryInfo', {
			code: 429,
			status: 'RESOURCE_EXHAUSTED',
			details: [{
				'@type': 'type.googleapis.com/google.rpc.RetryInfo',
				retryDelay: '3s'
			}]
		}]
	] as const)('keeps an ambiguous 429 neutral for %s', (_name, error) => {
		const failure = classifyGeminiEmbeddingError(providerError(429, error));
		expect(failure).toMatchObject({
			kind: 'unknown',
			fallbackable: true,
			diagnostic: { httpStatus: 429 }
		});
		if ('details' in error) expect(failure.diagnostic.retryDelayMs).toBe(3000);
	});

	it('allowlists quota identifiers without exposing project metadata', async () => {
		const error = providerError(429, {
			code: 429,
			status: 'RESOURCE_EXHAUSTED',
			message: 'raw provider description',
			details: [{
				'@type': 'type.googleapis.com/google.rpc.QuotaFailure',
				violations: [{
					subject: 'projects/secret-project',
					description: 'client 192.0.2.1 exceeded quota',
					quotaMetric: 'generativelanguage.googleapis.com/embed_content_requests',
					quotaId: 'EmbedContentRequestsPerMinutePerProjectPerModel',
					quotaDimensions: { project: 'secret-project', location: 'global' },
					quotaValue: '100'
				}]
			}]
		});
		const failure = classifyGeminiEmbeddingError(error);

		expect(failure).toEqual({
			kind: 'quota_exhausted',
			fallbackable: true,
			diagnostic: {
				httpStatus: 429,
				providerCode: 'RESOURCE_EXHAUSTED',
				quotaFailure: true,
				quotaLimits: [{
					metric: 'generativelanguage.googleapis.com/embed_content_requests',
					id: 'EmbedContentRequestsPerMinutePerProjectPerModel'
				}]
			}
		});
		const serialized = JSON.stringify(failure);
		expect(serialized).not.toContain('secret-project');
		expect(serialized).not.toContain('192.0.2.1');
		expect(serialized).not.toContain('raw provider description');
		expect(serialized).not.toContain('quotaDimensions');
		expect(serialized).not.toContain('quotaValue');
	});

	it('drops an unsafe provider code rather than serializing arbitrary provider text', () => {
		const failure = classifyGeminiEmbeddingError(providerError(429, {
			code: 'rate limit for projects/secret-project'
		}));
		expect(failure).toEqual({
			kind: 'unknown',
			fallbackable: true,
			diagnostic: { httpStatus: 429 }
		});
		expect(JSON.stringify(failure)).not.toContain('secret-project');
	});
});
