import { describe, expect, it, vi } from 'vitest';
import { createCohereClient } from './client.js';
import { EmbeddingProviderError } from '../../embedding/provider.js';

describe('Cohere embedding HTTP client', () => {
	it('uses the v2 float embedding contract without exposing the credential in the body', async () => {
		const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ embeddings: { float: [[1, 0]] } }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		}));
		const client = createCohereClient('test-credential', fetcher as typeof fetch);
		await expect(client.embed({
			model: 'embed-v4.0', texts: ['question'], inputType: 'search_query', dimensions: 1536
		})).resolves.toEqual([[1, 0]]);
		const [, init] = fetcher.mock.calls[0];
		expect(JSON.parse(String(init?.body))).toEqual({
			model: 'embed-v4.0',
			texts: ['question'],
			input_type: 'search_query',
			embedding_types: ['float'],
			output_dimension: 1536
		});
		expect(String(init?.body)).not.toContain('test-credential');
	});

	it('keeps an unannotated HTTP 429 neutral and fallbackable', async () => {
		const client = createCohereClient('test-credential', vi.fn(async () => new Response('', { status: 429 })) as typeof fetch);
		const failure = await client.embed({
			model: 'embed-v4.0', texts: ['question'], inputType: 'search_query', dimensions: 1536
		}).catch((error) => error);
		expect(failure).toBeInstanceOf(EmbeddingProviderError);
		expect(failure).toMatchObject({
			kind: 'unknown',
			fallbackable: true,
			diagnostic: { httpStatus: 429 }
		});
	});

	it('normalizes Retry-After without exposing response content', async () => {
		const client = createCohereClient('test-credential', vi.fn(async () => new Response('private detail', {
			status: 429,
			headers: { 'Retry-After': '30' }
		})) as typeof fetch);
		const failure = await client.embed({
			model: 'embed-v4.0', texts: ['question'], inputType: 'search_query', dimensions: 1536
		}).catch((error) => error);
		expect(failure).toMatchObject({
			kind: 'unknown',
			fallbackable: true,
			diagnostic: { httpStatus: 429, retryDelayMs: 30_000 }
		});
		expect(String(failure)).not.toContain('private detail');
	});
});
