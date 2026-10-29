import { ApiError } from '@google/genai';

export type GenerationFailureCategory = 'quota_exhausted' | 'non_quota_429' | 'provider_error' | 'unknown_error';

export interface GenerationFailureClassification {
	category: GenerationFailureCategory;
	providerStatus?: number;
	providerCode?: string | number;
}

export interface GenerationAttemptDiagnostic {
	generationAttempt: number;
	generationModel: string;
	isFallbackAttempt: boolean;
	fallbackTriggered: boolean;
	outcome: 'success' | 'fallback' | 'failure';
	reasonCategory?: string;
	providerStatus?: number;
	providerCode?: string | number;
}

type ErrorEnvelope = {
	error?: {
		code?: unknown;
		status?: unknown;
		details?: unknown;
	};
};

function parseEnvelope(message: string): ErrorEnvelope | undefined {
	try {
		const parsed = JSON.parse(message) as unknown;
		return parsed !== null && typeof parsed === 'object' ? parsed as ErrorEnvelope : undefined;
	} catch {
		return undefined;
	}
}

function identifier(value: unknown): string | number | undefined {
	return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function hasQuotaFailure(details: unknown): boolean {
	return Array.isArray(details) && details.some((detail) => {
		if (detail === null || typeof detail !== 'object') return false;
		const type = (detail as Record<string, unknown>)['@type'];
		return typeof type === 'string' && type.endsWith('/google.rpc.QuotaFailure');
	});
}

export function classifyGenerationFailure(error: unknown): GenerationFailureClassification {
	if (!(error instanceof ApiError)) return { category: 'unknown_error' };
	const envelope = parseEnvelope(error.message)?.error;
	const bodyCode = identifier(envelope?.code);
	const bodyStatus = identifier(envelope?.status);
	const providerCode = typeof bodyCode === 'string' ? bodyCode : bodyStatus ?? bodyCode;
	const confirmedQuota = error.status === 429 && (
		bodyCode === 'quota_exceeded' ||
		(bodyStatus === 'RESOURCE_EXHAUSTED' && hasQuotaFailure(envelope?.details))
	);
	return {
		category: confirmedQuota ? 'quota_exhausted' : error.status === 429 ? 'non_quota_429' : 'provider_error',
		providerStatus: error.status,
		...(providerCode !== undefined ? { providerCode } : {})
	};
}

export function logGenerationAttempt(diagnostic: GenerationAttemptDiagnostic): void {
	console.info('[Synethos] generation attempt', diagnostic);
}
