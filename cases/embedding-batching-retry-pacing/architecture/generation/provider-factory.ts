import type { MosaicConfig } from '../config.js';
import { requireCredential } from '../credentials.js';
import { createGeminiClient } from '../providers/gemini/client.js';
import { GeminiGenerationProvider } from '../providers/gemini/generation.js';
import { CohereGenerationProvider } from '../providers/cohere/generation.js';
import { createCohereGenerationClient } from '../providers/cohere/generation-client.js';
import { GroqGenerationProvider } from '../providers/groq/generation.js';
import { createGroqClient } from '../providers/groq/client.js';
import type { GenerationProvider, GenerationTarget } from './provider.js';
import { GenerationProviderError } from './provider.js';

export type GenerationProviderFactory = (target: GenerationTarget) => GenerationProvider;

export function getGenerationTarget(config: MosaicConfig, id: string): GenerationTarget {
	const target = config.generation.targets.find((item) => item.id === id);
	if (!target) throw new GenerationProviderError('configuration', 'Unknown generation target.');
	return target;
}

export function createGenerationProviderFactory(config: MosaicConfig): GenerationProviderFactory {
	const providers = new Map<string, GenerationProvider>();
	return (target) => {
		const existing = providers.get(target.id);
		if (existing) return existing;
		let credential: string;
		try { credential = requireCredential(config.credentials, target.credentialSlot); }
		catch { throw new GenerationProviderError('configuration', 'Generation target credential is not configured.'); }
		let provider: GenerationProvider;
		if (target.provider === 'gemini') provider = new GeminiGenerationProvider(createGeminiClient(credential));
		else if (target.provider === 'cohere') provider = new CohereGenerationProvider(createCohereGenerationClient(credential));
		else if (target.provider === 'groq') provider = new GroqGenerationProvider(createGroqClient(credential));
		else throw new GenerationProviderError('configuration', 'Unsupported generation provider.');
		providers.set(target.id, provider);
		return provider;
	};
}
