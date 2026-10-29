import type { MosaicConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from './provider-factory.js';
import type { EmbeddingTarget } from './provider.js';

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
	const vectors: number[][] = [];
	const provider = providerFactory(target);
	for (const chunk of chunks) {
		const result = await provider.embedDocuments({
			target,
			documents: [{ title: chunk.title, content: chunk.content }]
		});
		if (result.length !== 1) {
			throw new EmbeddingError('Embedding provider returned an unexpected number of vectors.');
		}
		vectors.push(validateVector(result[0], target.dimensions));
	}
	return vectors;
}
