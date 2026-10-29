import type { MosaicConfig } from '../config.js';
import { requireCredential } from '../credentials.js';
import { CohereEmbeddingProvider } from '../providers/cohere/embedding.js';
import { createGeminiClient } from '../providers/gemini/client.js';
import { GeminiEmbeddingProvider } from '../providers/gemini/embedding.js';
import type { EmbeddingProvider } from './provider.js';
import { EmbeddingProviderError } from './provider.js';

import type { EmbeddingTarget } from './provider.js';

export type EmbeddingProviderFactory = (target: EmbeddingTarget) => EmbeddingProvider;

export function createEmbeddingProviderFactory(config: MosaicConfig): EmbeddingProviderFactory {
	const providers = new Map<string, EmbeddingProvider>();
	return (target) => {
		const existing = providers.get(target.id);
		if (existing) return existing;
		const credential = requireCredential(config.credentials, target.credentialSlot);
		let provider: EmbeddingProvider;
		if (target.provider === 'gemini') provider = new GeminiEmbeddingProvider(createGeminiClient(credential));
		else if (target.provider === 'cohere') provider = new CohereEmbeddingProvider(credential);
		else throw new EmbeddingProviderError('configuration', `Unsupported embedding provider: ${target.provider}`, false);
		providers.set(target.id, provider);
		return provider;
	};
}
