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

/** Project allowlisted fields only, without raw messages, bodies or provider responses. */
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
