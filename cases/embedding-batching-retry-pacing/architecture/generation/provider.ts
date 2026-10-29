export interface GenerationTarget {
	id: string;
	provider: string;
	model: string;
	credentialSlot: string;
	options: GenerationOptions;
}

export interface GenerationOptions {
	maxOutputTokens: number;
	temperature?: number;
	/** Cohere: provider-default omits the wire field; Command A+ defaults to enabled. */
	thinking?: boolean | 'provider-default';
	reasoningEffort?: 'none' | 'default' | 'low' | 'medium' | 'high';
}

export interface GenerationRequest {
	target: GenerationTarget;
	contents: string;
	systemInstruction: string;
	responseSchema: object;
	maxOutputTokens: number;
	retryPolicy?: 'none';
}

/** Native usage field names are retained; absent counts are never synthesized. */
export interface GenerationMetadata {
	httpStatus?: number;
	finishReason?: string;
	usage?: object;
}

export function nativeUsage(value: unknown): object | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	// Only the provider's dedicated usage object, never messages, headers or reasoning text.
	return structuredClone(value);
}

export interface GenerationResponse {
	content?: string;
	metadata?: GenerationMetadata;
}

export interface GenerationProvider {
	generate(request: GenerationRequest): Promise<GenerationResponse>;
}

export type GenerationProviderErrorCategory =
	| 'quota_exhausted'
	| 'temporarily_unavailable'
	| 'authentication'
	| 'invalid_request'
	| 'configuration'
	| 'rate_limit'
	| 'transport'
	| 'timeout'
	| 'invalid_response'
	| 'unknown';

export class GenerationProviderError extends Error {
	constructor(
		public readonly category: GenerationProviderErrorCategory,
		message: string,
		public readonly providerStatus?: number,
		public readonly providerCode?: string | number,
		options?: ErrorOptions,
		public readonly metadata?: GenerationMetadata
	) {
		super(message, options);
		this.name = 'GenerationProviderError';
	}
}
