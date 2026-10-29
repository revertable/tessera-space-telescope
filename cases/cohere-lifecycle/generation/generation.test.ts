import { describe, expect, it, vi } from 'vitest';
import { createCohereGenerationClient } from './generation-client.js';
import { CohereGenerationProvider } from './generation.js';
import type { GenerationRequest } from '../../generation/provider.js';
import { answerResponseSchema } from '../../generation/answer-prompt.js';

const request: GenerationRequest = {
	target: { id: 'cohere-test', provider: 'cohere', model: 'test-model', credentialSlot: 'generation_2', options: { maxOutputTokens: 1200, thinking: false } },
	contents: '<record id="S1">evidence</record>', systemInstruction: 'Return JSON.', responseSchema: { type: 'object' }, maxOutputTokens: 1200
};

describe('Cohere generation contract', () => {
	it.each(['COMPLETE', 'MAX_TOKENS'])('preserves usage for %s without counting thinking text', async (finish_reason) => {
		const usage = { billed_units: { input_tokens: 90, output_tokens: 40 }, tokens: { input_tokens: 100, output_tokens: 50 } };
		const provider = new CohereGenerationProvider(createCohereGenerationClient('test', vi.fn().mockResolvedValue(Response.json({ finish_reason, usage, message: { content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '{}' }] } }))));
		if (finish_reason === 'COMPLETE') expect((await provider.generate(request)).metadata).toEqual({ httpStatus: 200, finishReason: finish_reason, usage });
		else await expect(provider.generate(request)).rejects.toMatchObject({ metadata: { httpStatus: 200, finishReason: finish_reason, usage } });
	});
	it.each([undefined, 'provider-default'] as const)('omits thinking=%s while preserving Structured Output and generation options', async (thinking) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ finish_reason: 'COMPLETE', message: { content: [{ type: 'text', text: '{"basis":"system","answer":"ok","citations":[]}' }] } }));
		const selected: GenerationRequest = {
			...request, responseSchema: answerResponseSchema,
			target: { ...request.target, options: { maxOutputTokens: 1200, thinking } }
		};
		await new CohereGenerationProvider(createCohereGenerationClient('test-key', fetcher)).generate(selected);
		const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
		expect(body).toEqual({
			model: selected.target.model, stream: false, max_tokens: 1200,
			messages: [{ role: 'system', content: selected.systemInstruction }, { role: 'user', content: selected.contents }],
			response_format: { type: 'json_object', schema: answerResponseSchema }
		});
		expect(selected.target.options.thinking).toBe(thinking);
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it('uses generation credentials and translates the shared prompt/schema without native document citations', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ finish_reason: 'COMPLETE', message: { content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '{"answer":"ok"}' }] } }));
		const provider = new CohereGenerationProvider(createCohereGenerationClient('generation-only-key', fetcher));
		await expect(provider.generate(request)).resolves.toEqual({ content: '{"answer":"ok"}', metadata: { httpStatus: 200, finishReason: 'COMPLETE' } });
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://api.cohere.com/v2/chat');
		expect(init?.headers).toMatchObject({ Authorization: 'Bearer generation-only-key' });
		const body = JSON.parse(init!.body as string);
		expect(body).toMatchObject({ model: 'test-model', max_tokens: 1200, messages: [{ role: 'system', content: request.systemInstruction }, { role: 'user', content: request.contents }], response_format: { type: 'json_object', schema: request.responseSchema }, thinking: { type: 'disabled' } });
		expect(body).not.toHaveProperty('documents');
		expect(body).not.toHaveProperty('tools');
	});
	it.each([[429, 'rate_limit'], [503, 'temporarily_unavailable'], [498, 'authentication'], [401, 'authentication'], [400, 'invalid_request']] as const)('normalizes HTTP %i and discards raw error bodies', async (status, category) => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret response', { status }));
		try { await createCohereGenerationClient('test-key', fetcher).chat({}); throw new Error('Expected rejection'); }
		catch (error) { expect(error).toMatchObject({ category, providerStatus: status }); expect(JSON.stringify(error)).not.toContain('secret response'); }
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it.each(['MAX_TOKENS', 'TOOL_CALL', 'TIMEOUT'])('rejects incomplete %s output', async (finish_reason) => {
		await expect(new CohereGenerationProvider({ chat: async () => ({ finish_reason, message: { content: [{ type: 'text', text: '{}' }] } }) }).generate(request)).rejects.toMatchObject({ category: 'invalid_response' });
	});
	it('normalizes transport and timeout failures without retaining secret-bearing causes', async () => {
		for (const [error, category] of [[new TypeError('secret'), 'transport'], [new DOMException('secret', 'TimeoutError'), 'timeout']] as const) {
			const failure = await createCohereGenerationClient('test', vi.fn().mockRejectedValue(error)).chat({}).catch((error) => error);
			expect(failure).toMatchObject({ category });
			expect(failure).not.toHaveProperty('cause');
		}
	});
});
