import { createHash } from 'node:crypto';
import type { MosaicConfig } from '../config.js';
import { CHUNKER_VERSION, chunkSource } from '../knowledge/chunker.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import type { KnowledgeChunk } from '../types.js';

export const INDEX_SCHEMA_VERSION = 2;
export const EMBEDDING_INPUT_VERSION = 1;

function hash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export interface PreparedCorpus {
	fingerprint: string;
	documentHashes: Record<string, string>;
	chunks: KnowledgeChunk[];
}

export async function prepareCorpus(config: MosaicConfig): Promise<PreparedCorpus> {
	const sources = await loadApprovedSources(config);
	const documentHashes = Object.fromEntries(sources.map((source) => [source.id, hash(source.content)]));
	const chunks = sources.flatMap((source) =>
		chunkSource(source, config.knowledge.maxChunkCharacters, config.knowledge.overlapCharacters)
	);
	const fingerprint = hash(
		JSON.stringify({
			schemaVersion: INDEX_SCHEMA_VERSION,
			chunkerVersion: CHUNKER_VERSION,
			embeddingModel: config.embedding.model,
			embeddingDimensions: config.embedding.outputDimensions,
			embeddingInputVersion: EMBEDDING_INPUT_VERSION,
			maxChunkCharacters: config.knowledge.maxChunkCharacters,
			overlapCharacters: config.knowledge.overlapCharacters,
			sources: sources.map((source) => ({
				id: source.id,
				file: source.file,
				title: source.title,
				publicUrl: source.publicUrl ?? null,
				hash: documentHashes[source.id]
			}))
		})
	);
	return { fingerprint, documentHashes, chunks };
}
