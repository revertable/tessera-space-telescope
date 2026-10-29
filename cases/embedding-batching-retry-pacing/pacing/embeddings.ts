import type { MosaicConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { withEmbeddingBatchContext } from './failure.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from './provider-factory.js';
import { EmbeddingProviderError, type EmbeddingProvider, type EmbeddingTarget } from './provider.js';

const DOCUMENT_BATCH_429_BACKOFF_MS = [15_000, 30_000, 60_000] as const;
const MAX_SAFE_RETRY_DELAY_MS = 60_000;
// A 32-document Gemini batch consumes up to 32 observed free-tier request units.
// Space starts beyond 20s so at most three full batches start in a 60s window.
const GEMINI_DOCUMENT_REQUEST_INTERVAL_MS = 22_000;

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
	const providerName = target.provider.replace(/^./, (first) => first.toUpperCase());
	const totalBatches = Math.ceil(chunks.length / batchSize);
	// One gate per build, shared by successful batches and their retry attempts.
	let lastRequestStartedAt: number | undefined;
	const beforeRequest = target.provider === 'gemini' ? async (batchLabel: string) => {
		if (lastRequestStartedAt !== undefined) {
			let remainingMs: number;
			let waitingLogged = false;
			while ((remainingMs = GEMINI_DOCUMENT_REQUEST_INTERVAL_MS - (performance.now() - lastRequestStartedAt)) > 0) {
				if (!waitingLogged) {
					console.log(`[${providerName}] pacing: waiting ${(remainingMs / 1000).toFixed(1)}s before ${batchLabel}`);
					waitingLogged = true;
				}
				await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
			}
		}
		lastRequestStartedAt = performance.now();
	} : undefined;
	for (let offset = 0; offset < chunks.length; offset += batchSize) {
		const batch = chunks.slice(offset, offset + batchSize);
		const batchLabel = `batch ${Math.floor(offset / batchSize) + 1}/${totalBatches}`;
		const log = (message: string) => console.log(`[${providerName}] ${batchLabel} ${message}`);
		let responseReceived = false;
		try {
			const result = await embedDocumentBatchWithRetry(provider, {
				target,
				documents: batch.map(({ title, content }) => ({ title, content }))
			}, log, beforeRequest ? () => beforeRequest(batchLabel) : undefined);
			responseReceived = true;
			if (result.length !== batch.length) {
				throw new EmbeddingError('Embedding provider returned an unexpected number of vectors.');
			}
			vectors.push(...result.map((vector) => validateVector(vector, target.dimensions)));
			log('complete');
		} catch (error) {
			if (responseReceived) log('failed: invalid_response; retry not scheduled');
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
	request: Parameters<EmbeddingProvider['embedDocuments']>[0],
	log: (message: string) => void,
	beforeRequest?: () => Promise<void>
): Promise<number[][]> {
	for (let retry = 0; ; retry += 1) {
		try {
			if (beforeRequest) await beforeRequest();
			log(`started (attempt ${retry + 1}/${DOCUMENT_BATCH_429_BACKOFF_MS.length + 1})`);
			return await provider.embedDocuments(request);
		} catch (error) {
			const status = error instanceof EmbeddingProviderError ? error.diagnostic.httpStatus : undefined;
			const kind = error instanceof EmbeddingProviderError ? error.kind : 'unknown';
			log(`failed: ${status !== undefined ? `HTTP ${status} ` : ''}${kind}`);
			const delayMs = documentBatchRetryDelayMs(error, retry);
			if (delayMs === undefined) {
				const exhausted = error instanceof EmbeddingProviderError && error.fallbackable && status === 429
					&& retry >= DOCUMENT_BATCH_429_BACKOFF_MS.length;
				log(`failed after ${retry + 1} attempts: ${exhausted
					? `retries exhausted (${retry}/${DOCUMENT_BATCH_429_BACKOFF_MS.length})`
					: 'retry not scheduled'}`);
				throw error;
			}
			log(`retry ${retry + 1}/${DOCUMENT_BATCH_429_BACKOFF_MS.length} in ${(delayMs / 1000).toFixed(1)}s`);
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
