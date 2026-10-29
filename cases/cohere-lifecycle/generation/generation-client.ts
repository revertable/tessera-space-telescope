import { GenerationProviderError } from '../../generation/provider.js';

export interface CohereGenerationClient {
	chat(body: Record<string, unknown>, onStatus?: (status: number) => void): Promise<unknown>;
}

export function createCohereGenerationClient(apiKey: string, fetcher: typeof fetch = fetch): CohereGenerationClient {
	if (!apiKey.trim()) throw new GenerationProviderError('configuration', 'Generation credential is required.');
	return {
		async chat(body, onStatus) {
			try {
				const response = await fetcher('https://api.cohere.com/v2/chat', {
					method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(body), signal: AbortSignal.timeout(30_000)
				});
				onStatus?.(response.status);
				if (!response.ok) {
					const status = response.status;
					const category = status === 429 ? 'rate_limit'
						: [401, 403, 498].includes(status) ? 'authentication'
						: [500, 502, 503, 504].includes(status) ? 'temporarily_unavailable'
						: [400, 404].includes(status) ? 'invalid_request'
						: status === 422 ? 'invalid_response' : 'unknown';
					throw new GenerationProviderError(category, 'Generation provider request failed.', status);
				}
				try { return await response.json(); }
				catch { throw new GenerationProviderError('invalid_response', 'Generation provider returned invalid JSON.'); }
			} catch (error) {
				if (error instanceof GenerationProviderError) throw error;
				const name = error instanceof Error ? error.name : '';
				throw new GenerationProviderError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : error instanceof TypeError ? 'transport' : 'unknown', 'Generation provider request failed.');
			}
		}
	};
}
