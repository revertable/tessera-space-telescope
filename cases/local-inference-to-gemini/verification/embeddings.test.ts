import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import type { KnowledgeChunk } from '../types.js';
import { embedDocumentChunks, embedQuestion } from './embeddings.js';

function vector(marker: number): number[] {
	return Array.from({ length: 768 }, (_, index) => index === 0 ? marker : 0);
}

describe('Gemini embeddings', () => {
	it('creates one independent 768-dimension vector per chunk in matching order', async () => {
		const chunks: KnowledgeChunk[] = [
			{ id: 'profile:0001', sourceId: 'profile', title: 'Profile', section: 'One', content: 'first chunk', publicUrl: null },
			{ id: 'profile:0002', sourceId: 'profile', title: 'Profile', section: 'Two', content: 'second chunk', publicUrl: null },
			{ id: 'profile:0003', sourceId: 'profile', title: 'Profile', section: 'Three', content: 'third chunk', publicUrl: null }
		];
		const embedContent = vi.fn(async ({ contents }: { contents: string }) => {
			const marker = contents.includes('first') ? 1 : contents.includes('second') ? 2 : 3;
			return { embeddings: [{ values: vector(marker) }] };
		});
		const client = { models: { embedContent } } as any;

		const vectors = await embedDocumentChunks(loadConfig(), chunks, client);

		expect(embedContent).toHaveBeenCalledTimes(chunks.length);
		expect(vectors).toHaveLength(chunks.length);
		expect(vectors.map((item) => item.length)).toEqual([768, 768, 768]);
		expect(vectors.map((item) => item[0])).toEqual([1, 2, 3]);
		expect(embedContent.mock.calls.map(([request]) => request.contents)).toEqual([
			'title: Profile | text: first chunk',
			'title: Profile | text: second chunk',
			'title: Profile | text: third chunk'
		]);
	});

	it('uses the question-answering query prefix for search questions', async () => {
		const embedContent = vi.fn(async (_request: { model: string; contents: string; config: { outputDimensionality: number } }) => ({
			embeddings: [{ values: vector(9) }]
		}));
		await embedQuestion(loadConfig(), 'Who is Riu Salze?', { models: { embedContent } } as any);
		expect(embedContent.mock.calls[0][0]).toMatchObject({
			model: 'gemini-embedding-2',
			contents: 'task: question answering | query: Who is Riu Salze?',
			config: { outputDimensionality: 768 }
		});
	});
});
