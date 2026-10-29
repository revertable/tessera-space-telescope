import type { GenerationProvider, GenerationRequest } from '../../generation/provider.js';
import { GenerationProviderError, nativeUsage } from '../../generation/provider.js';
import type { GroqClient } from './client.js';

export class GroqGenerationProvider implements GenerationProvider {
	constructor(private readonly client: GroqClient) {}
	async generate(request: GenerationRequest) {
		let httpStatus: number | undefined;
		const payload = await this.client.chat({
			model: request.target.model, stream: false,
			messages: [{ role: 'system', content: request.systemInstruction }, { role: 'user', content: request.contents }],
			max_completion_tokens: request.maxOutputTokens,
			response_format: { type: 'json_schema', json_schema: { name: 'synethos_answer', strict: true, schema: request.responseSchema } },
			reasoning_effort: request.target.options.reasoningEffort ?? 'medium'
		}, (status) => { httpStatus = status; }) as { usage?: object; choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }> } | null;
		const choice = payload?.choices?.[0];
		const usage = nativeUsage(payload?.usage);
		const metadata = {
			...(httpStatus !== undefined ? { httpStatus } : {}),
			...(typeof choice?.finish_reason === 'string' ? { finishReason: choice.finish_reason } : {}),
			...(usage ? { usage } : {})
		};
		if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim() || choice.message.refusal) {
			throw new GenerationProviderError('invalid_response', 'Generation provider returned an incomplete answer.', httpStatus, undefined, undefined, metadata);
		}
		return { content: choice.message.content, metadata };
	}
}
