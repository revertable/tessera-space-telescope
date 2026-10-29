import type { MosaicConfig } from '../config.js';
import { ollamaPost } from './client.js';

interface EmbedResponse {
	embeddings: number[][];
}

export async function embedTexts(
	config: MosaicConfig,
	inputs: string[],
	request: typeof fetch = fetch
): Promise<number[][]> {
	if (inputs.length === 0) return [];
	const all: number[][] = [];
	for (let start = 0; start < inputs.length; start += config.embedding.batchSize) {
		const batch = inputs.slice(start, start + config.embedding.batchSize);
		const response = await ollamaPost<EmbedResponse>(
			config,
			'/api/embed',
			{ model: config.embedding.model, input: batch, truncate: false },
			request
		);
		if (!Array.isArray(response.embeddings) || response.embeddings.length !== batch.length) {
			throw new Error('Ollama returned an unexpected number of embeddings.');
		}
		all.push(...response.embeddings);
	}
	const dimension = all[0]?.length ?? 0;
	if (!dimension || all.some((vector) => vector.length !== dimension || vector.some((value) => !Number.isFinite(value)))) {
		throw new Error('Ollama returned invalid embedding vectors.');
	}
	return all;
}
