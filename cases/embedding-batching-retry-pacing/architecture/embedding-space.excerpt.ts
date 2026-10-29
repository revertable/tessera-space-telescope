import { createHash } from 'node:crypto';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import { CHUNKER_VERSION, chunkSource } from '../knowledge/chunker.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import type { KnowledgeChunk } from '../types.js';

export const INDEX_SCHEMA_VERSION = 4;
export const EMBEDDING_INPUT_VERSION = 2;

function hash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export interface EmbeddingSpaceIdentity {
	provider: string;
	model: string;
	dimensions: number;
	embeddingInputVersion: number;
}

export function embeddingSpaceIdentity(
	target: EmbeddingTarget,
	embeddingInputVersion = EMBEDDING_INPUT_VERSION
): EmbeddingSpaceIdentity {
	return {
		provider: target.provider,
		model: target.model,
		dimensions: target.dimensions,
		embeddingInputVersion
	};
}

export function targetIndexFingerprint(
	corpusFingerprint: string,
	target: EmbeddingTarget,
	embeddingInputVersion = EMBEDDING_INPUT_VERSION
): string {
	return hash(JSON.stringify({
		schemaVersion: INDEX_SCHEMA_VERSION,
		corpusFingerprint,
		embeddingSpace: embeddingSpaceIdentity(target, embeddingInputVersion)
	}));
}
