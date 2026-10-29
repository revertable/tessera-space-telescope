import { EmbeddingProviderError } from '../../embedding/provider.js';
import { wrapEmbeddingFailure } from '../../embedding/failure.js';

export type CohereInputType = 'search_query' | 'search_document';

interface CohereEmbedResponse {
	embeddings?: { float?: number[][] };
}

export interface CohereEmbedRequest {
	model: string;
	texts: string[];
	inputType: CohereInputType;
	dimensions: number;
}

export interface CohereClient {
	embed(request: CohereEmbedRequest): Promise<number[][]>;
}

export function createCohereClient(apiKey: string, fetcher: typeof fetch = fetch): CohereClient {
	if (!apiKey) throw new Error('The configured credential is required on the server.');
	return {
		async embed(request) {
			try {
				const response = await fetcher('https://api.cohere.com/v2/embed', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						model: request.model,
						texts: request.texts,
						input_type: request.inputType,
						embedding_types: ['float'],
						output_dimension: request.dimensions
					}),
					signal: AbortSignal.timeout(30_000)
				});
				if (!response.ok) {
					throw Object.assign(new Error('Cohere embedding request failed.'), { status: response.status });
				}
				const payload = await response.json() as CohereEmbedResponse;
				if (!Array.isArray(payload.embeddings?.float)) {
					throw new EmbeddingProviderError('invalid_response', 'Embedding provider returned an invalid response.', false);
				}
				return payload.embeddings.float;
			} catch (error) {
				throw wrapEmbeddingFailure(error);
			}
		}
	};
}
