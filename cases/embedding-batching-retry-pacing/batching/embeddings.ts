import type { MosaicConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from './provider-factory.js';
import type { EmbeddingProvider, EmbeddingTarget } from './provider.js';

export class EmbeddingError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'EmbeddingError';
	}
}

export function validateVector(value: unknown, dimensions: number): number[] {
	if (!Array.isArray(value) || value.length !== dimensions || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
		throw new EmbeddingError(`Embedding provider returned an invalid ${dimensions}-dimension vector.`);
	}
	return value;
}

export async function embedQuestion(
	config: MosaicConfig,
	target: EmbeddingTarget,
	question: string,
	providerFactory: EmbeddingProviderFactory = createEmbeddingProviderFactory(config)
): Promise<number[]> {
	const vector = await providerFactory(target).embedQuery({ target, query: question });
	return validateVector(vector, target.dimensions);
}

export async function embedDocumentChunks(
	config: MosaicConfig,
	target: EmbeddingTarget,
	chunks: KnowledgeChunk[],
	providerFactory: EmbeddingProviderFactory = createEmbeddingProviderFactory(config)
): Promise<number[][]> {
	if (chunks.length === 0) return [];
	const vectors: number[][] = [];
	const provider = providerFactory(target);
	const batchSize = documentBatchSize(provider);
	for (let offset = 0; offset < chunks.length; offset += batchSize) {
		const batch = chunks.slice(offset, offset + batchSize);
		const result = await provider.embedDocuments({
			target,
			documents: batch.map(({ title, content }) => ({ title, content }))
		});
		if (result.length !== batch.length) {
			throw new EmbeddingError('Embedding provider returned an unexpected number of vectors.');
		}
		vectors.push(...result.map((vector) => validateVector(vector, target.dimensions)));
	}
	return vectors;
}

function documentBatchSize(provider: EmbeddingProvider): number {
	const capability = provider.documentBatching;
	if (!capability) return 1;
	const { preferredBatchSize, maximumBatchSize } = capability;
	if (
		!Number.isInteger(preferredBatchSize) ||
		preferredBatchSize < 1 ||
		(maximumBatchSize !== undefined && (
			!Number.isInteger(maximumBatchSize) ||
			maximumBatchSize < 1 ||
			preferredBatchSize > maximumBatchSize
		))
	) {
		throw new EmbeddingError('Embedding provider reported an invalid document batching capability.');
	}
	return preferredBatchSize;
}
