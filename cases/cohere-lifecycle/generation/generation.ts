import type { GenerationProvider, GenerationRequest } from '../../generation/provider.js';
import { GenerationProviderError, nativeUsage } from '../../generation/provider.js';
import type { CohereGenerationClient } from './generation-client.js';

export class CohereGenerationProvider implements GenerationProvider {
	constructor(private readonly client: CohereGenerationClient) {}
	async generate(request: GenerationRequest) {
		const options = request.target.options;
		let httpStatus: number | undefined;
		const payload = await this.client.chat({
			model: request.target.model, stream: false,
			messages: [{ role: 'system', content: request.systemInstruction }, { role: 'user', content: request.contents }],
			max_tokens: request.maxOutputTokens,
			response_format: { type: 'json_object', schema: request.responseSchema },
			...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
			...(typeof options.thinking === 'boolean' ? { thinking: { type: options.thinking ? 'enabled' : 'disabled' } } : {})
		}, (status) => { httpStatus = status; }) as { usage?: object; finish_reason?: string; message?: { content?: Array<{ type?: string; text?: string }> } } | null;
		const metadata = { ...(httpStatus !== undefined ? { httpStatus } : {}), ...(payload?.finish_reason ? { finishReason: payload.finish_reason } : {}), ...(nativeUsage(payload?.usage) ? { usage: nativeUsage(payload?.usage) } : {}) };
		if (typeof payload?.finish_reason !== 'string' || payload.finish_reason.toLowerCase() !== 'complete' || !Array.isArray(payload.message?.content)) {
			throw new GenerationProviderError('invalid_response', 'Generation provider returned an incomplete answer.', httpStatus, undefined, undefined, metadata);
		}
		const blocks = payload.message.content.filter((block) => block?.type === 'text');
		if (!blocks.length || blocks.some((block) => typeof block.text !== 'string')) throw new GenerationProviderError('invalid_response', 'Generation provider returned invalid answer content.', httpStatus, undefined, undefined, metadata);
		return { content: blocks.map((block) => block.text).join(''), metadata };
	}
}
