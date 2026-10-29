import { describe, expect, it } from 'vitest';
import { safeDiagnosticIdentifier, safeServiceDiagnostic } from './safe-diagnostics.js';

describe('safe diagnostics without HTTP', () => {
	it('extracts only safe diagnostic fields from an error chain', () => {
		const provider = Object.assign(new Error('backend unavailable'), {
			name: 'ApiError', status: 503, code: 'UNAVAILABLE', apiKey: 'secret', request: { records: 'private' }
		});
		const diagnostic = safeServiceDiagnostic('answer', new Error('generation failed', { cause: provider }));
		expect(diagnostic).toEqual({
			operation: 'answer',
			errors: [{ name: 'Error' }, { name: 'ApiError', status: 503, code: 'UNAVAILABLE' }]
		});
		expect(JSON.stringify(diagnostic)).not.toContain('secret');
		expect(JSON.stringify(diagnostic)).not.toContain('private');
	});

	it('drops arbitrary names, categories, identifiers, messages, bodies and provider responses', () => {
		const secret = 'synthetic-diagnostic-secret';
		const error = Object.assign(new Error(secret), {
			name: secret, category: secret, status: secret, code: secret,
			apiKey: secret, body: secret, response: { content: secret }, request: { body: secret }
		});
		expect(safeServiceDiagnostic('answer', error)).toEqual({ operation: 'answer', errors: [{ name: 'Error' }] });
	});

	it('preserves allowed categories and prefers normalized provider identifiers', () => {
		const error = Object.assign(new Error('private provider text'), {
			name: 'GenerationProviderError', category: 'quota_exhausted',
			providerStatus: 429, providerCode: 'quota_exceeded', status: 503, code: 'UNAVAILABLE'
		});
		expect(safeServiceDiagnostic('search', error)).toEqual({
			operation: 'search', errors: [{ name: 'GenerationProviderError', category: 'quota_exhausted', status: 429, code: 'quota_exceeded' }]
		});
	});

	it('accepts only known codes and integer HTTP status identifiers', () => {
		for (const value of [100, 429, 599, 'UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'INVALID_ARGUMENT', 'quota_exceeded']) {
			expect(safeDiagnosticIdentifier(value)).toBe(value);
		}
		for (const value of [99, 600, 429.5, NaN, Infinity, '429', 'private text', null, {}]) {
			expect(safeDiagnosticIdentifier(value)).toBeUndefined();
		}
	});

	it('bounds deep and cyclic cause chains and ignores fields on non-errors', () => {
		let deep = new Error('private');
		for (let i = 0; i < 6; i++) deep = new Error('private', { cause: deep });
		expect(safeServiceDiagnostic('answer', deep).errors).toEqual(Array.from({ length: 4 }, () => ({ name: 'Error' })));
		const cycle = new Error('private');
		cycle.cause = cycle;
		expect(safeServiceDiagnostic('answer', cycle).errors).toEqual([{ name: 'Error' }]);
		expect(safeServiceDiagnostic('answer', { name: 'ApiError', status: 503, body: 'private' }).errors).toEqual([{ name: 'NonError' }]);
	});
});
