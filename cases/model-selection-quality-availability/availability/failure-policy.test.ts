import { describe, expect, it } from 'vitest';
import { GenerationProviderError } from '../generation/provider.js';
import { bodyFailureDiagnostic, permitsProviderFallback, responseFailureDiagnostic, retryAfterMs, safeFailureDiagnostic } from './failure-policy.js';

describe('safe bounded provider failure policy', () => {
	it.each(['quota_exhausted', 'rate_limit', 'temporarily_unavailable', 'transport', 'timeout'] as const)(
		'permits independent provider fallback for %s', category => {
			const failure = new GenerationProviderError(category, 'private');
			expect(permitsProviderFallback(failure, 'generation')).toBe(true);
			expect(permitsProviderFallback(failure, 'classification')).toBe(true);
		});
	it('limits invalid-response recovery to classification', () => {
		const failure = new GenerationProviderError('invalid_response', 'private');
		expect(permitsProviderFallback(failure, 'classification')).toBe(true);
		expect(permitsProviderFallback(failure, 'generation')).toBe(false);
	});
	it.each(['authentication', 'configuration', 'invalid_request', 'unknown'] as const)('blocks %s', category => {
		const failure = new GenerationProviderError(category, 'private');
		expect(permitsProviderFallback(failure, 'classification')).toBe(false);
		expect(permitsProviderFallback(failure, 'generation')).toBe(false);
	});
	it('projects quota and retry details without identifiers or free text', () => {
		expect(bodyFailureDiagnostic({ error: { message: 'secret', details: [
			{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1.5s' },
			{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [
				{ quotaId: 'RequestsPerDayPerProject', description: 'secret', quotaDimensions: { project: 'secret' } }
			] }
		] } })).toEqual({ retryDelayMs: 1500, quotaFailure: true, quotaScope: 'daily' });
	});
	it('normalizes headers and bounds raw bodies', async () => {
		const diagnostic = await responseFailureDiagnostic(Response.json({ error: { message: 'secret' } },
			{ status: 429, headers: { 'retry-after': '2', 'x-ratelimit-reset-requests': '1m2.5s',
				'x-ratelimit-reset-tokens': '500ms', 'authorization': 'secret' } }));
		expect(diagnostic).toEqual({ retryDelayMs: 2000, resetAfterMs: 62500 });
		expect(await responseFailureDiagnostic(new Response('s'.repeat(20000), { status: 429 }))).toEqual({});
	});
	it('rejects malicious normalized fields', () => {
		expect(safeFailureDiagnostic({ retryDelayMs: 'secret', resetAfterMs: -1, quotaScope: 'secret',
			quotaFailure: 'secret', body: 'secret' })).toEqual({});
	});
	it('supports both Retry-After forms without accepting invalid delays', () => {
		expect(retryAfterMs('2')).toBe(2000);
		expect(retryAfterMs('Tue, 06 Oct 2026 00:00:02 GMT', Date.parse('2026-10-06T00:00:00Z'))).toBe(2000);
		expect(retryAfterMs('secret')).toBeUndefined();
	});
});
