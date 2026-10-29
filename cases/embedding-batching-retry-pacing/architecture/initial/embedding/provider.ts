export interface EmbeddingTarget {
	provider: string;
	model: string;
	dimensions: number;
}

export interface EmbeddingRequest {
	target: EmbeddingTarget;
	content: string;
}

export interface EmbeddingProvider {
	embed(request: EmbeddingRequest): Promise<number[]>;
}

export class EmbeddingProviderError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'EmbeddingProviderError';
	}
}
