export type ServiceOperation = 'answer' | 'search';

type DiagnosticError = {
	name: string;
	category?: string;
	status?: string | number;
	code?: string | number;
};

export type ServiceDiagnostic = {
	operation: ServiceOperation;
	errors: DiagnosticError[];
};

const publicFailures = {
	answer: {
		status: 503,
		body: {
			code: 'ANSWER_UNAVAILABLE',
			error: '현재 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
		}
	},
	search: {
		status: 503,
		body: {
			code: 'SEARCH_UNAVAILABLE',
			error: '현재 관련 자료를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.'
		}
	}
} as const;

export const invalidQuestionFailure = {
	status: 400,
	body: {
		code: 'INVALID_QUESTION',
		error: '질문 내용을 확인한 뒤 다시 시도해 주세요.'
	}
} as const;

const diagnosticCodes = new Set(['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'INVALID_ARGUMENT', 'quota_exceeded']);
const diagnosticNames = new Set(['Error', 'TypeError', 'ApiError', 'GenerationError', 'GenerationTimeoutError', 'GenerationProviderError', 'EmbeddingProviderError', 'InvalidIndexError']);
const diagnosticCategories = new Set(['quota_exhausted', 'temporarily_unavailable', 'authentication', 'invalid_request', 'configuration', 'rate_limit', 'transport', 'timeout', 'invalid_response', 'unknown']);

export function safeDiagnosticIdentifier(value: unknown): string | number | undefined {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) return value;
	return typeof value === 'string' && diagnosticCodes.has(value) ? value : undefined;
}

function diagnosticError(value: unknown): DiagnosticError {
	if (value instanceof Error) {
		const record = value as Error & { status?: unknown; code?: unknown; category?: string; providerStatus?: unknown; providerCode?: unknown };
		const status = safeDiagnosticIdentifier(record.providerStatus ?? record.status);
		const code = safeDiagnosticIdentifier(record.providerCode ?? record.code);
		return {
			name: diagnosticNames.has(value.name) ? value.name : 'Error',
			...(record.category && diagnosticCategories.has(record.category) ? { category: record.category } : {}),
			...(status !== undefined ? { status } : {}),
			...(code !== undefined ? { code } : {})
		};
	}
	return { name: 'NonError' };
}

export function safeServiceDiagnostic(operation: ServiceOperation, error: unknown): ServiceDiagnostic {
	const errors: DiagnosticError[] = [];
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current !== undefined && current !== null && errors.length < 4 && !seen.has(current)) {
		seen.add(current);
		errors.push(diagnosticError(current));
		current = current instanceof Error ? current.cause : undefined;
	}
	return { operation, errors };
}

export function serviceFailure(operation: ServiceOperation, error: unknown) {
	console.error('[Synethos] service operation failed', safeServiceDiagnostic(operation, error));
	return publicFailures[operation];
}
