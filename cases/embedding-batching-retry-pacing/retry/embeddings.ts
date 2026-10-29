import type { MosaicConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { withEmbeddingBatchContext } from './failure.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from './provider-factory.js';
import { EmbeddingProviderError, type EmbeddingProvider, type EmbeddingTarget } from './provider.js';

const DOCUMENT_BATCH_429_BACKOFF_MS = [15_000, 30_000, 60_000] as const;
const MAX_SAFE_RETRY_DELAY_MS = 60_000;

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
		try {
			const result = await embedDocumentBatchWithRetry(provider, {
				target,
				documents: batch.map(({ title, content }) => ({ title, content }))
			});
			if (result.length !== batch.length) {
				throw new EmbeddingError('Embedding provider returned an unexpected number of vectors.');
			}
			vectors.push(...result.map((vector) => validateVector(vector, target.dimensions)));
		} catch (error) {
			if (error instanceof EmbeddingProviderError) {
				throw withEmbeddingBatchContext(error, {
					number: Math.floor(offset / batchSize) + 1,
					documentOffset: offset,
					size: batch.length
				});
			}
			throw error;
		}
	}
	return vectors;
}

async function embedDocumentBatchWithRetry(
	provider: EmbeddingProvider,
	request: Parameters<EmbeddingProvider['embedDocuments']>[0]
): Promise<number[][]> {
	for (let retry = 0; ; retry += 1) {
		try {
			return await provider.embedDocuments(request);
		} catch (error) {
			const delayMs = documentBatchRetryDelayMs(error, retry);
			if (delayMs === undefined) throw error;
			await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

function documentBatchRetryDelayMs(error: unknown, retry: number): number | undefined {
	if (
		!(error instanceof EmbeddingProviderError) ||
		!error.fallbackable ||
		error.diagnostic.httpStatus !== 429 ||
		retry >= DOCUMENT_BATCH_429_BACKOFF_MS.length
	) return undefined;
	const explicitDelayMs = error.diagnostic.retryDelayMs;
	if (explicitDelayMs !== undefined) {
		return Number.isSafeInteger(explicitDelayMs) && explicitDelayMs >= 0 && explicitDelayMs <= MAX_SAFE_RETRY_DELAY_MS
			? explicitDelayMs
			: undefined;
	}
	return DOCUMENT_BATCH_429_BACKOFF_MS[retry];
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
