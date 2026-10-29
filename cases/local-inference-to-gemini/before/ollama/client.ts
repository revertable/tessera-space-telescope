import type { MosaicConfig } from '../config.js';

export class OllamaError extends Error {
	constructor(message: string, readonly status?: number) {
		super(message);
		this.name = 'OllamaError';
	}
}

export async function ollamaPost<T>(
	config: MosaicConfig,
	path: string,
	body: unknown,
	request: typeof fetch = fetch
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);
	try {
		const response = await request(`${config.ollama.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});
		if (!response.ok) {
			const detail = await response.text();
			throw new OllamaError(`Ollama ${path} failed (${response.status}): ${detail.slice(0, 300)}`, response.status);
		}
		return (await response.json()) as T;
	} catch (error) {
		if (error instanceof OllamaError) throw error;
		const message = error instanceof Error ? error.message : String(error);
		throw new OllamaError(`Ollama is unavailable at ${config.ollama.baseUrl}: ${message}`);
	} finally {
		clearTimeout(timeout);
	}
}

export async function ollamaTags(config: MosaicConfig, request: typeof fetch = fetch): Promise<string[]> {
	try {
		const response = await request(`${config.ollama.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
		if (!response.ok) return [];
		const data = (await response.json()) as { models?: Array<{ name?: string }> };
		return (data.models ?? []).flatMap((model) => (model.name ? [model.name] : []));
	} catch {
		return [];
	}
}
