import type { MosaicConfig } from '../config.js';
import { createGeminiClient } from '../providers/gemini/client.js';
import { GeminiGenerationProvider } from '../providers/gemini/generation.js';
import type { GenerationProvider } from './provider.js';
import { GenerationProviderError } from './provider.js';

export type GenerationProviderFactory = (provider: string) => GenerationProvider;

export function createGenerationProviderFactory(config: MosaicConfig): GenerationProviderFactory {
	return (provider) => {
		if (provider === 'gemini') return new GeminiGenerationProvider(createGeminiClient(config.gemini.apiKey));
		throw new GenerationProviderError('invalid_request', `Unsupported generation provider: ${provider}`);
	};
}
