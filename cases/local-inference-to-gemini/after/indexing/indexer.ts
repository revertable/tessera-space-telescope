import type { MosaicConfig } from '../config.js';
import { embedDocumentChunks } from '../gemini/embeddings.js';
import type { SearchIndexData } from '../types.js';
import { INDEX_SCHEMA_VERSION, prepareCorpus } from './corpus.js';
import { indexExists, indexPath, writeIndex } from './store.js';

export interface IndexStatus {
	state: 'current' | 'missing' | 'empty';
	fingerprint: string;
	path: string;
	chunkCount: number;
}

export async function getIndexStatus(config: MosaicConfig): Promise<IndexStatus> {
	const corpus = await prepareCorpus(config);
	const exists = await indexExists(config, corpus.fingerprint);
	return {
		state: corpus.chunks.length === 0 ? 'empty' : exists ? 'current' : 'missing',
		fingerprint: corpus.fingerprint,
		path: indexPath(config, corpus.fingerprint),
		chunkCount: corpus.chunks.length
	};
}

export async function buildIndex(config: MosaicConfig, force = false): Promise<IndexStatus> {
	const corpus = await prepareCorpus(config);
	if (!force && (await indexExists(config, corpus.fingerprint))) return getIndexStatus(config);
	const vectors = corpus.chunks.length ? await embedDocumentChunks(config, corpus.chunks) : [];
	if (vectors.length !== corpus.chunks.length) {
		throw new Error('The embedding count does not match the knowledge chunk count.');
	}
	const data: SearchIndexData = {
		schemaVersion: INDEX_SCHEMA_VERSION,
		fingerprint: corpus.fingerprint,
		createdAt: new Date().toISOString(),
		embeddingModel: config.embedding.model,
		vectorDimension: vectors[0]?.length ?? 0,
		documentHashes: corpus.documentHashes,
		chunks: corpus.chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] }))
	};
	await writeIndex(config, data);
	return getIndexStatus(config);
}
