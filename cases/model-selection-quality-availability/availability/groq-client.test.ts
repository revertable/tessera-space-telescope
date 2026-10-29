import { describe, expect, it, vi } from 'vitest';
import { createGroqClient } from './client.js';

describe('Groq HTTP transport', () => {
	it('uses the passed numbered credential and sends one authenticated request', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
		const status = vi.fn();
		await expect(createGroqClient('numbered-test-key', fetcher).chat({ model: 'test' }, status)).resolves.toEqual({ ok: true });
		expect(status).toHaveBeenCalledWith(200);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
		expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer numbered-test-key' }, body: '{"model":"test"}' });
		expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
	});
	it.each([[400, 'invalid_request'], [401, 'authentication'], [403, 'authentication'], [404, 'invalid_request'], [422, 'invalid_response'], [429, 'rate_limit'], [500, 'temporarily_unavailable'], [503, 'temporarily_unavailable']] as const)('classifies HTTP %i without retries or secret-bearing causes', async (status, category) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('numbered-test-key private error body', { status }));
		try {
			await createGroqClient('numbered-test-key', fetcher).chat({});
			throw new Error('Expected rejection');
		} catch (error) {
			expect(error).toMatchObject({ category, providerStatus: status });
			expect(error).not.toHaveProperty('cause');
			expect(JSON.stringify(error)).not.toContain('numbered-test-key');
			expect(String(error)).not.toContain('private error body');
		}
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it('rejects malformed HTTP JSON and missing credentials', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json'));
		await expect(createGroqClient('test-key', fetcher).chat({})).rejects.toMatchObject({ category: 'invalid_response', providerStatus: 200 });
		expect(() => createGroqClient(' ', fetcher)).toThrow('Generation credential is required');
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it.each([[new TypeError('secret key'), 'transport'], [new DOMException('secret key', 'TimeoutError'), 'timeout'], [new DOMException('secret key', 'AbortError'), 'timeout'], [new Error('secret key'), 'unknown']] as const)('sanitizes %s transport errors', async (failure, category) => {
		const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
		try { await createGroqClient('test-key', fetcher).chat({}); throw new Error('Expected rejection'); }
		catch (error) {
			expect(error).toMatchObject({ category });
			expect(error).not.toHaveProperty('cause');
			expect(String(error)).not.toContain('secret key');
		}
		expect(fetcher).toHaveBeenCalledOnce();
	});
});
