import { describe, expect, it, vi } from 'vitest';
import { GroqGenerationProvider } from './generation.js';
import { createGroqClient } from './client.js';
import { answerResponseSchema, answerSystemInstruction } from '../../generation/answer-prompt.js';
import { generateGroundedAnswerForTarget } from '../../generation/orchestrator.js';
import { loadConfig } from '../../config.js';
import { groundedResult } from '../../answering/answer.js';
import type { GenerationRequest } from '../../generation/provider.js';
import type { Evidence } from '../../types.js';

const request: GenerationRequest = {
	target: { id: 'groq-gpt-oss-120b', provider: 'groq', model: 'openai/gpt-oss-120b', credentialSlot: 'generation_2', options: { maxOutputTokens: 4096, reasoningEffort: 'medium' } },
	contents: '<record id="S1">public evidence</record>', systemInstruction: answerSystemInstruction, responseSchema: answerResponseSchema, maxOutputTokens: 4096
};
const evidence: Evidence[] = [{ id: 'reader:1', sourceId: 'reader', title: 'Reader', section: 'Features', content: 'Reader supports search.', excerpt: 'Reader supports search.', score: 0.9, publicUrl: null, citationId: 'S1' }];
const answer = { basis: 'records', answer: 'Reader supports search.', citations: ['S1'] };
function payload(content = JSON.stringify(answer), finish_reason = 'stop') {
	return { choices: [{ finish_reason, message: { content, reasoning: 'private reasoning text' } }], usage: { prompt_tokens: 100, completion_tokens: 40, completion_tokens_details: { reasoning_tokens: 25 } } };
}

	it('matches calibration wire semantics with explicit medium and strict current answer schema', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload()));
		const response = await new GroqGenerationProvider(createGroqClient('test-key', fetcher)).generate(request);
		const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
		expect(body).toEqual({
			model: 'openai/gpt-oss-120b', stream: false, max_completion_tokens: 4096, reasoning_effort: 'medium',
			messages: [{ role: 'system', content: answerSystemInstruction }, { role: 'user', content: request.contents }],
			response_format: { type: 'json_schema', json_schema: { name: 'synethos_answer', strict: true, schema: answerResponseSchema } }
		});
		expect(body).not.toHaveProperty('tools');
		expect(body).not.toHaveProperty('reasoning_format');
		expect(response).toEqual({ content: JSON.stringify(answer), metadata: { httpStatus: 200, finishReason: 'stop', usage: payload().usage } });
		expect(JSON.stringify(response)).not.toContain('private reasoning text');
		expect(fetcher).toHaveBeenCalledOnce();
	});
	it.each(['length', 'tool_calls', 'content_filter'])('rejects incomplete %s output while preserving native usage', async finish => {
		await expect(new GroqGenerationProvider({ chat: async () => payload('{}', finish) }).generate(request)).rejects.toMatchObject({ category: 'invalid_response', metadata: { finishReason: finish, usage: payload().usage } });
	});

	it.each(['bad json', '{"basis":"wrong","answer":"x","citations":[]}'])('retains production JSON/shape validation for %s', async content => {
		const config = loadConfig();
		const provider = new GroqGenerationProvider({ chat: async () => payload(content) });
		await expect(generateGroundedAnswerForTarget(config, request.target.id, 'Question?', evidence, () => provider)).rejects.toThrow();
	});
	it('does not synthesize usage counts or repair invalid citation IDs', async () => {
		const config = loadConfig();
		const provider = new GroqGenerationProvider({ chat: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ...answer, citations: ['S99'] }) } }] }) });
		const result = await generateGroundedAnswerForTarget(config, request.target.id, 'Question?', evidence, () => provider);
		expect(groundedResult(evidence, result).status).toBe('citation_error');
		expect((await provider.generate(request)).metadata).not.toHaveProperty('usage');
	});
