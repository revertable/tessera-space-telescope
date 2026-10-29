export interface GenerationTarget {
	provider: string;
	model: string;
}

export interface GenerationRequest {
	target: GenerationTarget;
	contents: string;
	systemInstruction: string;
	responseSchema: object;
	maxOutputTokens: number;
}

export interface GenerationResponse {
	content?: string;
}

export interface GenerationProvider {
	generate(request: GenerationRequest): Promise<GenerationResponse>;
}

export type GenerationProviderErrorCategory =
	| 'quota_exhausted'
	| 'temporarily_unavailable'
	| 'authentication'
	| 'invalid_request'
	| 'unknown';

export class GenerationProviderError extends Error {
	constructor(
		public readonly category: GenerationProviderErrorCategory,
		message: string,
		public readonly providerStatus?: number,
		public readonly providerCode?: string | number,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = 'GenerationProviderError';
	}
}
