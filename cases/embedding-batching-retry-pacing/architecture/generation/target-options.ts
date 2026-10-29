import type { GenerationOptions } from './provider.js';

/** Provider request options are validated here, then translated only by adapters. */
export function parseGenerationOptions(provider: string, value: unknown): GenerationOptions {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Generation options must be an object.');
	const record = value as Record<string, unknown>;
	const supported: Record<string, string[]> = {
		gemini: ['maxOutputTokens', 'temperature'],
		cohere: ['maxOutputTokens', 'temperature', 'thinking'],
		groq: ['maxOutputTokens', 'reasoningEffort']
	};
	const keys = supported[provider];
	if (!keys) throw new Error('Unsupported generation provider.');
	if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error('Unsupported generation option.');
	const max = provider === 'cohere' ? 64000 : 65536;
	if (!Number.isInteger(record.maxOutputTokens) || (record.maxOutputTokens as number) < 64 || (record.maxOutputTokens as number) > max) {
		throw new Error(`Generation maxOutputTokens must be an integer between 64 and ${max}.`);
	}
	if (record.temperature !== undefined && (typeof record.temperature !== 'number' || !Number.isFinite(record.temperature) || record.temperature < 0 || record.temperature > (provider === 'cohere' ? 1 : 2))) {
		throw new Error('Invalid generation temperature.');
	}
	if (record.thinking !== undefined && typeof record.thinking !== 'boolean' && record.thinking !== 'provider-default') {
		throw new Error('Invalid generation thinking option.');
	}
	if (record.reasoningEffort !== undefined && !['low', 'medium', 'high'].includes(record.reasoningEffort as string)) {
		throw new Error('Invalid generation reasoning effort.');
	}
	return { ...record } as unknown as GenerationOptions;
}
