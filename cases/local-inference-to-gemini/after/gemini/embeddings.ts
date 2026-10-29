import type { GoogleGenAI } from '@google/genai';
import type { MosaicConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { createGeminiClient, GeminiError } from './client.js';

type GeminiModels = Pick<GoogleGenAI, 'models'>;

function validateVector(value: unknown, dimensions: number): number[] {
	if (!Array.isArray(value) || value.length !== dimensions || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
		throw new GeminiError(`Gemini returned an invalid ${dimensions}-dimension embedding vector.`);
	}
	return value;
}

async function embedOne(config: MosaicConfig, content: string, client: GeminiModels): Promise<number[]> {
	try {
		const response = await client.models.embedContent({
			model: config.embedding.model,
			contents: content,
			config: { outputDimensionality: config.embedding.outputDimensions }
		});
		if (response.embeddings?.length !== 1) {
			throw new GeminiError('Gemini returned an unexpected number of embeddings for one input.');
		}
		return validateVector(response.embeddings[0]?.values, config.embedding.outputDimensions);
	} catch (error) {
		if (error instanceof GeminiError) throw error;
		throw new GeminiError('Gemini embedding request failed.', { cause: error });
	}
}

export async function embedQuestion(
	config: MosaicConfig,
	question: string,
	client: GeminiModels = createGeminiClient(config)
): Promise<number[]> {
	return embedOne(config, `task: question answering | query: ${question}`, client);
}

export async function embedDocumentChunks(
	config: MosaicConfig,
	chunks: KnowledgeChunk[],
	client: GeminiModels = createGeminiClient(config)
): Promise<number[][]> {
	const vectors: number[][] = [];
	for (const chunk of chunks) {
		vectors.push(await embedOne(config, `title: ${chunk.title} | text: ${chunk.content}`, client));
	}
	return vectors;
}
