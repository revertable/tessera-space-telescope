import type {
	EmbeddingDocumentsRequest,
	EmbeddingProvider,
	EmbeddingQueryRequest
} from '../../embedding/provider.js';
import { EmbeddingProviderError } from '../../embedding/provider.js';
import { createCohereClient, type CohereClient } from './client.js';

const COHERE_MAX_INPUTS = 96;
export const COHERE_DOCUMENT_BATCHING = Object.freeze({
	preferredBatchSize: COHERE_MAX_INPUTS,
	maximumBatchSize: COHERE_MAX_INPUTS
});

export class CohereEmbeddingProvider implements EmbeddingProvider {
	readonly documentBatching = COHERE_DOCUMENT_BATCHING;
	private readonly client: CohereClient;

	constructor(apiKeyOrClient: string | CohereClient) {
		this.client = typeof apiKeyOrClient === 'string' ? createCohereClient(apiKeyOrClient) : apiKeyOrClient;
	}

	async embedQuery(request: EmbeddingQueryRequest): Promise<number[]> {
		const vectors = await this.client.embed({
			model: request.target.model,
			texts: [request.query],
			inputType: 'search_query',
			dimensions: request.target.dimensions
		});
		if (vectors.length !== 1) {
			throw new EmbeddingProviderError('invalid_response', 'Embedding provider returned an unexpected number of vectors.', false);
		}
		return vectors[0];
	}

	async embedDocuments(request: EmbeddingDocumentsRequest): Promise<number[][]> {
		if (request.documents.length > COHERE_MAX_INPUTS) {
			throw new EmbeddingProviderError('invalid_request', `Cohere accepts at most ${COHERE_MAX_INPUTS} documents per request.`, false);
		}
		const vectors = await this.client.embed({
			model: request.target.model,
			texts: request.documents.map(({ title, content }) => `${title}\n\n${content}`),
			inputType: 'search_document',
			dimensions: request.target.dimensions
		});
		if (vectors.length !== request.documents.length) {
			throw new EmbeddingProviderError('invalid_response', 'Embedding provider returned an unexpected number of vectors.', false);
		}
		return vectors;
	}
}
