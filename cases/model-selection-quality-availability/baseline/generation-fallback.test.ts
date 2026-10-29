import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { classifyGenerationFailure } from './generation-fallback.js';

function providerError(status: number, error: object): ApiError {
	return new ApiError({ status, message: JSON.stringify({ error }) });
}

describe('generation fallback classification', () => {
	it('recognizes the current GenerateContent QuotaFailure envelope', () => {
		expect(classifyGenerationFailure(providerError(429, {
			code: 429,
			status: 'RESOURCE_EXHAUSTED',
			details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure' }]
		}))).toEqual({ category: 'quota_exhausted', providerStatus: 429, providerCode: 'RESOURCE_EXHAUSTED' });
	});

	it('recognizes the machine-readable quota_exceeded code', () => {
		expect(classifyGenerationFailure(providerError(429, {
			code: 'quota_exceeded',
			message: 'quota reached'
		}))).toEqual({ category: 'quota_exhausted', providerStatus: 429, providerCode: 'quota_exceeded' });
	});

	it.each([
		['rate_limit_exceeded', { code: 'rate_limit_exceeded' }],
		['too_many_requests', { code: 'too_many_requests' }],
		['ambiguous resource exhaustion', { code: 429, status: 'RESOURCE_EXHAUSTED' }]
	])('does not classify %s as quota exhaustion', (_name, error) => {
		expect(classifyGenerationFailure(providerError(429, error))).toMatchObject({
			category: 'non_quota_429',
			providerStatus: 429
		});
	});

	it('does not classify other provider or application errors as quota exhaustion', () => {
		expect(classifyGenerationFailure(providerError(503, { code: 503, status: 'UNAVAILABLE' }))).toMatchObject({
			category: 'provider_error', providerStatus: 503, providerCode: 'UNAVAILABLE'
		});
		expect(classifyGenerationFailure(new Error('local failure'))).toEqual({ category: 'unknown_error' });
	});

	it.each([
		[400, 'INVALID_ARGUMENT'],
		[401, 'UNAUTHENTICATED'],
		[403, 'PERMISSION_DENIED']
	])('does not classify HTTP %i %s as quota exhaustion', (status, code) => {
		expect(classifyGenerationFailure(providerError(status, { code: status, status: code }))).toEqual({
			category: 'provider_error', providerStatus: status, providerCode: code
		});
	});
});
