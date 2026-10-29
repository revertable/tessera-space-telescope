import { describe, expect, it } from 'vitest';
import { classifyEmbeddingFailure, embeddingFailureReport, parseRetryAfterMs, wrapEmbeddingFailure } from './failure.js';

describe('embedding failure classification', () => {
	it.each([
		[{ status: 429 }, 'unknown'],
		[{ status: 503 }, 'temporary_unavailable'],
		[{ code: 'ETIMEDOUT' }, 'transport']
	] as const)('allows fallback for transient failures', (error, kind) => {
		expect(classifyEmbeddingFailure(error)).toEqual({ kind, fallbackable: true });
	});

	it.each([
		[{ status: 429, code: 'RATE_LIMIT_EXCEEDED' }, 'rate_limit'],
		[{ status: 429, code: 'TOO_MANY_REQUESTS' }, 'rate_limit'],
		[{ status: 429, code: 'QUOTA_EXCEEDED' }, 'quota_exhausted']
	] as const)('classifies a 429 only with explicit provider evidence', (error, kind) => {
		expect(classifyEmbeddingFailure(error)).toEqual({ kind, fallbackable: true });
	});

	it('keeps RESOURCE_EXHAUSTED neutral without explicit quota metadata', () => {
		expect(classifyEmbeddingFailure({ status: 429, code: 'RESOURCE_EXHAUSTED' }))
			.toEqual({ kind: 'unknown', fallbackable: true });
	});

	it.each([
		[{ status: 401 }, 'authentication'],
		[{ status: 402 }, 'billing'],
		[{ status: 400 }, 'invalid_request']
	] as const)('does not hide operational or request failures', (error, kind) => {
		expect(classifyEmbeddingFailure(error)).toEqual({ kind, fallbackable: false });
	});

	it('distinguishes a timeout from caller cancellation', () => {
		expect(classifyEmbeddingFailure(new DOMException('timed out', 'TimeoutError')))
			.toEqual({ kind: 'transport', fallbackable: true });
		expect(classifyEmbeddingFailure(new DOMException('cancelled', 'AbortError')))
			.toEqual({ kind: 'cancelled', fallbackable: false });
	});

	it('keeps unknown failures non-fallbackable', () => {
		expect(classifyEmbeddingFailure(new Error('unknown'))).toEqual({ kind: 'unknown', fallbackable: false });
	});

	it('preserves safe transport metadata in a serializable report', () => {
		const wrapped = wrapEmbeddingFailure(Object.assign(new Error('provider payload'), {
			status: 429,
			code: 'RATE_LIMIT_EXCEEDED'
		}));
		expect(wrapped.message).toBe('Embedding provider request failed.');
		expect(embeddingFailureReport(wrapped)).toEqual({
			kind: 'rate_limit',
			fallbackable: true,
			httpStatus: 429,
			providerCode: 'RATE_LIMIT_EXCEEDED'
		});
		expect(JSON.stringify(embeddingFailureReport(wrapped))).not.toContain('provider payload');
	});

	it('normalizes both safe Retry-After forms without retaining the header', () => {
		expect(parseRetryAfterMs('15', Date.UTC(2026, 8, 29))).toBe(15_000);
		expect(parseRetryAfterMs('Tue, 29 Sep 2026 00:00:30 GMT', Date.UTC(2026, 8, 29))).toBe(30_000);
		expect(parseRetryAfterMs('invalid', Date.UTC(2026, 8, 29))).toBeUndefined();
	});

	it('preserves only a validated retry delay from a generic HTTP failure', () => {
		const wrapped = wrapEmbeddingFailure(Object.assign(new Error('private provider response'), {
			status: 429,
			retryDelayMs: 30_000
		}));
		expect(embeddingFailureReport(wrapped)).toEqual({
			kind: 'unknown',
			fallbackable: true,
			httpStatus: 429,
			retryDelayMs: 30_000
		});
		expect(JSON.stringify(embeddingFailureReport(wrapped))).not.toContain('private provider response');
	});
});
