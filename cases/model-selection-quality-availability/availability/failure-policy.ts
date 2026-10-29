import type { GenerationProviderError, RateLimitDiagnostic } from '../generation/provider.js';

export function permitsProviderFallback(failure: GenerationProviderError, stage: 'classification' | 'generation'): boolean {
	return ['quota_exhausted', 'rate_limit', 'temporarily_unavailable', 'transport', 'timeout'].includes(failure.category)
		|| (stage === 'classification' && failure.category === 'invalid_response');
}

function delay(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** Re-project even normalized metadata before logging; never accept free text. */
export function safeFailureDiagnostic(value: unknown): RateLimitDiagnostic {
	if (!value || typeof value !== 'object') return {};
	const raw = value as RateLimitDiagnostic;
	return {
		...(delay(raw.retryDelayMs) !== undefined ? { retryDelayMs: raw.retryDelayMs } : {}),
		...(delay(raw.resetAfterMs) !== undefined ? { resetAfterMs: raw.resetAfterMs } : {}),
		...(['daily', 'short', 'unknown'].includes(raw.quotaScope ?? '') ? { quotaScope: raw.quotaScope } : {}),
		...(raw.quotaFailure === true ? { quotaFailure: true as const } : {})
	};
}

export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
	if (!value?.trim()) return undefined;
	const raw = value.trim();
	return /^\d+$/.test(raw) ? delay(Number(raw) * 1000)
		: Number.isFinite(Date.parse(raw)) ? delay(Math.max(0, Math.ceil(Date.parse(raw) - now))) : undefined;
}

function durationMs(value: string | null): number | undefined {
	if (!value) return undefined;
	const matches = [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
	if (!matches.length || matches.map(match => match[0]).join('') !== value) return undefined;
	const units: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000 };
	return delay(Math.ceil(matches.reduce((total, match) => total + Number(match[1]) * units[match[2]], 0)));
}

export function bodyFailureDiagnostic(value: unknown): RateLimitDiagnostic {
	if (!value || typeof value !== 'object') return {};
	const envelope = (value as { error?: unknown }).error;
	if (!envelope || typeof envelope !== 'object') return {};
	const details = (envelope as { details?: unknown }).details;
	const diagnostic: RateLimitDiagnostic = {};
	if (!Array.isArray(details)) return diagnostic;
	for (const detail of details.slice(0, 16)) {
		if (!detail || typeof detail !== 'object') continue;
		if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo') {
			const retry = durationMs(typeof detail.retryDelay === 'string' ? detail.retryDelay : null);
			if (retry !== undefined) diagnostic.retryDelayMs = retry;
		}
		if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') {
			diagnostic.quotaFailure = true;
			if (Array.isArray(detail.violations)) {
				for (const violation of detail.violations.slice(0, 8)) {
					const id = violation?.quotaId;
					if (typeof id !== 'string' || id.length > 256) continue;
					if (/PerDay/i.test(id)) diagnostic.quotaScope = 'daily';
					else if (/PerMinute|PerSecond/i.test(id) && diagnostic.quotaScope !== 'daily') diagnostic.quotaScope = 'short';
				}
			}
		}
	}
	if (diagnostic.quotaFailure && !diagnostic.quotaScope) diagnostic.quotaScope = 'unknown';
	return diagnostic;
}

/** Read a bounded body, discard it after projection, and retain no raw headers. */
export async function responseFailureDiagnostic(response: Response): Promise<RateLimitDiagnostic> {
	const diagnostic: RateLimitDiagnostic = {};
	const retry = retryAfterMs(response.headers.get('retry-after'));
	if (retry !== undefined) diagnostic.retryDelayMs = retry;
	const resets = ['x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens']
		.map(header => durationMs(response.headers.get(header))).filter((value): value is number => value !== undefined);
	if (resets.length) diagnostic.resetAfterMs = Math.max(...resets);
	const reader = response.body?.getReader();
	if (!reader) return diagnostic;
	try {
		let body = '';
		let size = 0;
		const decoder = new TextDecoder();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 16 * 1024) return diagnostic;
			body += decoder.decode(value, { stream: true });
		}
		body += decoder.decode();
		return { ...bodyFailureDiagnostic(JSON.parse(body)), ...diagnostic };
	} catch { return diagnostic; }
	finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
