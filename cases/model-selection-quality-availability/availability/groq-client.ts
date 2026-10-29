import { GenerationProviderError } from '../../generation/provider.js';
import { responseFailureDiagnostic } from '../failure-policy.js';

export interface GroqClient {
	chat(body: Record<string, unknown>, onStatus?: (status: number) => void, signal?: AbortSignal): Promise<unknown>;
}

export function createGroqClient(apiKey: string, fetcher: typeof fetch = fetch): GroqClient {
	if (!apiKey.trim()) throw new GenerationProviderError('configuration', 'Generation credential is required.');
	return {
		async chat(body, onStatus, signal) {
			try {
				signal?.throwIfAborted();
				const response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
					method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
					...(signal ? { redirect: 'error' as const } : {})
				});
				onStatus?.(response.status);
				if (!response.ok) {
					const status = response.status;
					const category = status === 429 ? 'rate_limit'
						: [401, 403].includes(status) ? 'authentication'
						: [500, 502, 503, 504].includes(status) ? 'temporarily_unavailable'
						: [400, 404].includes(status) ? 'invalid_request'
						: status === 422 ? 'invalid_response' : 'unknown';
					const failure = status === 429 ? await responseFailureDiagnostic(response) : undefined;
					throw new GenerationProviderError(category, 'Generation provider request failed.', status, undefined, undefined,
						failure ? { failure } : undefined);
				}
				try { return await response.json(); }
				catch { throw new GenerationProviderError('invalid_response', 'Generation provider returned invalid JSON.', response.status); }
			} catch (error) {
				if (error instanceof GenerationProviderError) throw error;
				const name = error instanceof Error ? error.name : '';
				throw new GenerationProviderError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : error instanceof TypeError ? 'transport' : 'unknown', 'Generation provider request failed.');
			}
		}
	};
}
