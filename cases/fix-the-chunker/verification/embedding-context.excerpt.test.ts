import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { chunkSource } from '../knowledge/chunker.js';
import type { KnowledgeChunk } from '../types.js';
import { embedDocumentChunks, embedQuestion } from './embeddings.js';
import {
	EmbeddingProviderError,
	type EmbeddingDocumentsRequest,
	type EmbeddingProvider,
	type EmbeddingQueryRequest
} from './provider.js';

function vector(marker: number, dimensions: number): number[] {
	return Array.from({ length: dimensions }, (_, index) => index === 0 ? marker : 0);
}

it('passes inherited section context and a separate title unchanged to document embedding', async () => {
	const config = loadConfig();
	const target = config.embedding.targets[0];
	const documents = chunkSource({
		id: 'resume', file: 'approved/resume.md', title: 'Public Resume',
		publicUrl: null, absolutePath: 'unused',
		content: '# Resume\n## Project\n### Work\nBuilt a tool.\n### Tools\nRust.'
	}, 1800, 240);
	const embedDocuments = vi.fn(async (request: EmbeddingDocumentsRequest) =>
		request.documents.map(() => vector(1, target.dimensions)));
	const embedQuery = vi.fn();
	await embedDocumentChunks(config, target, documents, () => ({
		documentBatching: { preferredBatchSize: 2 }, embedDocuments, embedQuery
	}));
	expect(embedDocuments.mock.calls[0][0].documents).toEqual([
		{ title: 'Public Resume', content: 'Project\n\n# Work\n\nBuilt a tool.' },
		{ title: 'Public Resume', content: 'Project\n\n# Tools\n\nRust.' }
	]);
	expect(embedQuery).not.toHaveBeenCalled();
});
