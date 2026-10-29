import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { createGenerationProviderFactory } from './provider-factory.js';
import { createGeminiClient } from '../providers/gemini/client.js';
import { createCohereGenerationClient } from '../providers/cohere/generation-client.js';
import { createGroqClient } from '../providers/groq/client.js';

vi.mock('../providers/gemini/client.js', () => ({ createGeminiClient: vi.fn(() => ({ models: {} })) }));
vi.mock('../providers/cohere/generation-client.js', () => ({ createCohereGenerationClient: vi.fn(() => ({ chat: vi.fn() })) }));
vi.mock('../providers/groq/client.js', () => ({ createGroqClient: vi.fn(() => ({ chat: vi.fn() })) }));

describe('generation factory credential isolation', () => {
	it('uses bound generation slots, permits identical key values in separate target slots, and ignores embedding slots', () => {
		const config = loadConfig();
		config.credentials = { generation_1: 'first', generation_2: 'first', generation_3: 'second', generation_4: 'third', embedding_1: 'unrelated' };
		const factory = createGenerationProviderFactory(config);
		for (const target of config.generation.targets) expect(factory(target)).toBe(factory(target));
		expect(createGeminiClient).toHaveBeenCalledWith('first');
		expect(createCohereGenerationClient).toHaveBeenCalledWith('second');
		expect(createGroqClient).toHaveBeenCalledWith('third');
		config.generation.runtimeTargetIds.reverse();
		expect(factory(config.generation.targets[0])).toBe(factory(config.generation.targets[0]));
	});
	it('does not borrow an embedding credential when the generation credential is missing', () => {
		const config = loadConfig();
		config.credentials = { embedding_1: 'available' };
		const target = config.generation.targets.find((t) => t.provider === 'cohere')!;
		expect(() => createGenerationProviderFactory(config)(target)).toThrow('credential is not configured');
	});
});
