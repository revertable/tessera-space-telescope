import { createHash } from 'node:crypto';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import { CHUNKER_VERSION, chunkSource } from '../knowledge/chunker.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import type { KnowledgeChunk } from '../types.js';

export const INDEX_SCHEMA_VERSION = 3;
export const EMBEDDING_INPUT_VERSION = 2;

function hash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export interface PreparedCorpus {
	corpusFingerprint: string;
	documentHashes: Record<string, string>;
	chunks: KnowledgeChunk[];
}

export function targetIndexFingerprint(corpusFingerprint: string, target: EmbeddingTarget): string {
	return hash(JSON.stringify({
		schemaVersion: INDEX_SCHEMA_VERSION,
		corpusFingerprint,
		embeddingInputVersion: EMBEDDING_INPUT_VERSION,
		target: {
			id: target.id,
			provider: target.provider,
			model: target.model,
			dimensions: target.dimensions
		}
	}));
}

export async function prepareCorpus(config: MosaicConfig): Promise<PreparedCorpus> {
	const sources = await loadApprovedSources(config);
	const documentHashes = Object.fromEntries(sources.map((source) => [source.id, hash(source.content)]));
	const chunks = sources.flatMap((source) =>
		chunkSource(source, config.knowledge.maxChunkCharacters, config.knowledge.overlapCharacters)
	);
	const corpusFingerprint = hash(
		JSON.stringify({
			chunkerVersion: CHUNKER_VERSION,
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
	return { corpusFingerprint, documentHashes, chunks };
}
