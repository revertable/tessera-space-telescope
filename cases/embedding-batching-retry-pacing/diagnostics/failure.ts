import {
	EmbeddingProviderError,
	type EmbeddingFailureBatch,
	type EmbeddingFailureDiagnostic,
	type EmbeddingFailureKind,
	type EmbeddingFailureReport
} from './provider.js';

function statusOf(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const status = (error as { status?: unknown }).status;
	return typeof status === 'number' ? status : undefined;
}

function rawCodeOf(error: unknown): string | number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const code = (error as { code?: unknown }).code;
	return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}

function retryDelayOf(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const retryDelayMs = (error as { retryDelayMs?: unknown }).retryDelayMs;
	return typeof retryDelayMs === 'number' && Number.isSafeInteger(retryDelayMs) && retryDelayMs >= 0
		? retryDelayMs
		: undefined;
}

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | undefined {
	const normalized = value?.trim();
	if (!normalized) return undefined;
	if (/^\d+$/.test(normalized)) {
		const milliseconds = Number(normalized) * 1000;
		return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
	}
	const retryAt = Date.parse(normalized);
	if (!Number.isFinite(retryAt)) return undefined;
	const milliseconds = Math.max(0, Math.ceil(retryAt - nowMs));
	return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
}

export function embeddingHttpError(message: string, response: Response): Error {
	const retryDelayMs = parseRetryAfterMs(response.headers.get('retry-after'));
	return Object.assign(new Error(message), {
		status: response.status,
		...(retryDelayMs !== undefined ? { retryDelayMs } : {})
	});
}

function codeOf(error: unknown): string {
	const code = rawCodeOf(error);
	return typeof code === 'string' ? code.toUpperCase() : '';
}

export function classifyEmbeddingFailure(error: unknown): { kind: EmbeddingFailureKind; fallbackable: boolean } {
	if (error instanceof EmbeddingProviderError) {
		return { kind: error.kind, fallbackable: error.fallbackable };
	}
	if (error instanceof DOMException && error.name === 'TimeoutError') {
		return { kind: 'transport', fallbackable: true };
	}
	if (error instanceof DOMException && error.name === 'AbortError') {
		return { kind: 'cancelled', fallbackable: false };
	}
	const status = statusOf(error);
	const code = codeOf(error);
	if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) {
		return { kind: 'transport', fallbackable: true };
	}
	if (code === 'QUOTA_EXCEEDED') return { kind: 'quota_exhausted', fallbackable: true };
	if (code === 'RATE_LIMIT_EXCEEDED' || code === 'TOO_MANY_REQUESTS') {
		return { kind: 'rate_limit', fallbackable: true };
	}
	if (status === 429 || code === 'RESOURCE_EXHAUSTED') return { kind: 'unknown', fallbackable: true };
	if ([500, 502, 503, 504].includes(status ?? 0) || code === 'UNAVAILABLE') {
		return { kind: 'temporary_unavailable', fallbackable: true };
	}
	if (status === 401 || status === 403 || status === 498 || code === 'UNAUTHENTICATED' || code === 'PERMISSION_DENIED') {
		return { kind: 'authentication', fallbackable: false };
	}
	if (status === 402) return { kind: 'billing', fallbackable: false };
	if ([400, 404, 422].includes(status ?? 0) || code === 'INVALID_ARGUMENT' || code === 'NOT_FOUND') {
		return { kind: 'invalid_request', fallbackable: false };
	}
	if (error instanceof TypeError) return { kind: 'transport', fallbackable: true };
	return { kind: 'unknown', fallbackable: false };
}

export function wrapEmbeddingFailure(error: unknown): EmbeddingProviderError {
	if (error instanceof EmbeddingProviderError) return error;
	const classification = classifyEmbeddingFailure(error);
	const httpStatus = statusOf(error);
	const providerCode = rawCodeOf(error);
	const retryDelayMs = retryDelayOf(error);
	const diagnostic: EmbeddingFailureDiagnostic = {
		...(httpStatus !== undefined ? { httpStatus } : {}),
		...(providerCode !== undefined ? { providerCode } : {}),
		...(retryDelayMs !== undefined ? { retryDelayMs } : {})
	};
	return new EmbeddingProviderError(
		classification.kind,
		'Embedding provider request failed.',
		classification.fallbackable,
		{ cause: error },
		diagnostic
	);
}

export function withEmbeddingBatchContext(
	error: EmbeddingProviderError,
	batch: EmbeddingFailureBatch
): EmbeddingProviderError {
	return new EmbeddingProviderError(
		error.kind,
		error.message,
		error.fallbackable,
		{ cause: error },
		{ ...error.diagnostic, batch }
	);
}

export function embeddingFailureReport(error: unknown): EmbeddingFailureReport | undefined {
	if (!(error instanceof EmbeddingProviderError)) return undefined;
	return {
		kind: error.kind,
		fallbackable: error.fallbackable,
		...error.diagnostic
	};
}

export function isFallbackableEmbeddingFailure(error: unknown): boolean {
	return error instanceof EmbeddingProviderError && error.fallbackable;
}
