import { ApiError, type Content, type GoogleGenAI } from '@google/genai';
import type {
	EmbeddingDocumentsRequest,
	EmbeddingFailureDiagnostic,
	EmbeddingFailureKind,
	EmbeddingProvider,
	EmbeddingQueryRequest,
	EmbeddingQuotaLimit
} from '../../embedding/provider.js';
import { EmbeddingProviderError } from '../../embedding/provider.js';
import { classifyEmbeddingFailure, wrapEmbeddingFailure } from '../../embedding/failure.js';

type GeminiModels = Pick<GoogleGenAI, 'models'>;

// Application preference for bounded request payloads and failure units.
// The Gemini batchEmbedContents reference does not publish this as an API maximum.
export const GEMINI_DOCUMENT_BATCHING = Object.freeze({ preferredBatchSize: 32 });

type ErrorEnvelope = {
	error?: {
		code?: unknown;
		status?: unknown;
		details?: unknown;
	};
};

type GeminiEmbeddingFailure = {
	kind: EmbeddingFailureKind;
	fallbackable: boolean;
	diagnostic: EmbeddingFailureDiagnostic;
};

function parseEnvelope(message: string): ErrorEnvelope | undefined {
	try {
		const parsed = JSON.parse(message) as unknown;
		return parsed !== null && typeof parsed === 'object' ? parsed as ErrorEnvelope : undefined;
	} catch {
		return undefined;
	}
}

function safeProviderIdentifier(value: unknown): string | number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	return typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9._:/-]+$/.test(value)
		? value
		: undefined;
}

function typedDetails(details: unknown, typeName: string): Record<string, unknown>[] {
	if (!Array.isArray(details)) return [];
	return details.filter((detail): detail is Record<string, unknown> => {
		if (detail === null || typeof detail !== 'object') return false;
		const type = (detail as Record<string, unknown>)['@type'];
		return typeof type === 'string' && type.endsWith(`/google.rpc.${typeName}`);
	});
}

function retryDelayMs(details: unknown): number | undefined {
	for (const detail of typedDetails(details, 'RetryInfo')) {
		const retryDelay = detail.retryDelay;
		if (typeof retryDelay !== 'string') continue;
		const match = /^(\d+(?:\.\d+)?)s$/.exec(retryDelay);
		if (!match) continue;
		const milliseconds = Math.ceil(Number(match[1]) * 1000);
		if (Number.isSafeInteger(milliseconds)) return milliseconds;
	}
	return undefined;
}

function safeQuotaIdentifier(value: unknown): string | undefined {
	return typeof value === 'string' && value.length <= 256 && /^[A-Za-z0-9._:/-]+$/.test(value)
		? value
		: undefined;
}

function quotaLimits(details: unknown): EmbeddingQuotaLimit[] {
	const limits: EmbeddingQuotaLimit[] = [];
	for (const detail of typedDetails(details, 'QuotaFailure')) {
		if (!Array.isArray(detail.violations)) continue;
		for (const violation of detail.violations.slice(0, 8)) {
			if (violation === null || typeof violation !== 'object') continue;
			const fields = violation as Record<string, unknown>;
			const metric = safeQuotaIdentifier(fields.quotaMetric);
			const id = safeQuotaIdentifier(fields.quotaId);
			if (metric || id) limits.push({ ...(metric ? { metric } : {}), ...(id ? { id } : {}) });
		}
	}
	return limits;
}

export function classifyGeminiEmbeddingError(error: ApiError): GeminiEmbeddingFailure {
	const envelope = parseEnvelope(error.message)?.error;
	const bodyCode = safeProviderIdentifier(envelope?.code);
	const bodyStatus = safeProviderIdentifier(envelope?.status);
	const normalizedCode = typeof bodyCode === 'string' ? bodyCode.toUpperCase() : '';
	const providerCode = typeof bodyCode === 'string' ? bodyCode : bodyStatus ?? bodyCode;
	const quotaDetails = typedDetails(envelope?.details, 'QuotaFailure');
	const hasQuotaFailure = quotaDetails.length > 0;
	const classification = classifyEmbeddingFailure(error);
	const explicitRateLimit = normalizedCode === 'RATE_LIMIT_EXCEEDED' || normalizedCode === 'TOO_MANY_REQUESTS';
	const explicitQuota = normalizedCode === 'QUOTA_EXCEEDED' || hasQuotaFailure;
	const kind: EmbeddingFailureKind = explicitRateLimit
		? 'rate_limit'
		: explicitQuota
			? 'quota_exhausted'
			: classification.kind;
	const retry = retryDelayMs(envelope?.details);
	const limits = quotaLimits(envelope?.details);
	return {
		kind,
		fallbackable: classification.fallbackable,
		diagnostic: {
			httpStatus: error.status,
			...(providerCode !== undefined ? { providerCode } : {}),
			...(retry !== undefined ? { retryDelayMs: retry } : {}),
			...(hasQuotaFailure ? { quotaFailure: true as const } : {}),
			...(limits.length ? { quotaLimits: limits } : {})
		}
	};
}

function wrapGeminiEmbeddingFailure(error: unknown): EmbeddingProviderError {
	if (error instanceof EmbeddingProviderError) return error;
	if (!(error instanceof ApiError)) return wrapEmbeddingFailure(error);
	const failure = classifyGeminiEmbeddingError(error);
	return new EmbeddingProviderError(
		failure.kind,
		'Embedding provider request failed.',
		failure.fallbackable,
		{ cause: error },
		failure.diagnostic
	);
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
	readonly documentBatching = GEMINI_DOCUMENT_BATCHING;

	constructor(private readonly client: GeminiModels) {}

	async embedQuery(request: EmbeddingQueryRequest): Promise<number[]> {
		try {
			const response = await this.client.models.embedContent({
				model: request.target.model,
				contents: `task: question answering | query: ${request.query}`,
				config: { outputDimensionality: request.target.dimensions }
			});
			if (response.embeddings?.length !== 1) {
				throw new EmbeddingProviderError('invalid_response', 'Embedding provider returned an unexpected number of vectors.', false);
			}
			return response.embeddings[0]?.values as number[];
		} catch (error) {
			throw wrapGeminiEmbeddingFailure(error);
		}
	}

	async embedDocuments(request: EmbeddingDocumentsRequest): Promise<number[][]> {
		try {
			const response = await this.client.models.embedContent({
				model: request.target.model,
				contents: request.documents.map((document): Content => ({
					role: 'user',
					parts: [{ text: `title: ${document.title} | text: ${document.content}` }]
				})),
				config: { outputDimensionality: request.target.dimensions }
			});
			if (response.embeddings?.length !== request.documents.length) {
				throw new EmbeddingProviderError('invalid_response', 'Embedding provider returned an unexpected number of vectors.', false);
			}
			return response.embeddings.map((embedding) => embedding.values as number[]);
		} catch (error) {
			throw wrapGeminiEmbeddingFailure(error);
		}
	}
}
