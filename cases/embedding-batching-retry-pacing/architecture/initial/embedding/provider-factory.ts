import type { MosaicConfig } from '../config.js';
import { createGeminiClient } from '../providers/gemini/client.js';
import { GeminiEmbeddingProvider } from '../providers/gemini/embedding.js';
import type { EmbeddingProvider } from './provider.js';
import { EmbeddingProviderError } from './provider.js';

export type EmbeddingProviderFactory = (provider: string) => EmbeddingProvider;

export function createEmbeddingProviderFactory(config: MosaicConfig): EmbeddingProviderFactory {
	return (provider) => {
		if (provider === 'gemini') return new GeminiEmbeddingProvider(createGeminiClient(config.gemini.apiKey));
		throw new EmbeddingProviderError(`Unsupported embedding provider: ${provider}`);
	};
}
