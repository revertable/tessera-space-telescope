import { describe, expect, it, vi } from 'vitest';
import { COHERE_DOCUMENT_BATCHING, CohereEmbeddingProvider } from './embedding.js';

const target = {
	id: 'cohere-fallback', provider: 'cohere', model: 'embed-v4.0', dimensions: 1536, credentialSlot: 'fallback'
};

describe('Cohere embedding adapter', () => {
	it('keeps query and multilingual document semantics distinct', async () => {
		const embed = vi.fn(async ({ inputType }: { inputType: string }) =>
			inputType === 'search_query' ? [[1]] : [[2], [3]]
		);
		const provider = new CohereEmbeddingProvider({ embed } as never);
		expect(provider.documentBatching).toEqual(COHERE_DOCUMENT_BATCHING);
		expect(provider.documentBatching).toEqual({ preferredBatchSize: 96, maximumBatchSize: 96 });
		await expect(provider.embedQuery({ target, query: '검증 철학은 무엇인가요?' })).resolves.toEqual([1]);
		await expect(provider.embedDocuments({
			target,
			documents: [
				{ title: '검증 철학', content: '한국어 문서' },
				{ title: 'Verification', content: 'English document' }
			]
		})).resolves.toEqual([[2], [3]]);
		expect(embed.mock.calls[0][0]).toMatchObject({ inputType: 'search_query', texts: ['검증 철학은 무엇인가요?'] });
		expect(embed.mock.calls[1][0]).toMatchObject({
			inputType: 'search_document',
			texts: ['검증 철학\n\n한국어 문서', 'Verification\n\nEnglish document']
		});
	});

	it('rejects document requests above the v2 API maximum before calling the client', async () => {
		const embed = vi.fn();
		const provider = new CohereEmbeddingProvider({ embed } as never);
		await expect(provider.embedDocuments({
			target,
			documents: Array.from({ length: 97 }, (_, index) => ({ title: `Title ${index}`, content: `Text ${index}` }))
		})).rejects.toThrow('at most 96');
		expect(embed).not.toHaveBeenCalled();
	});
});
