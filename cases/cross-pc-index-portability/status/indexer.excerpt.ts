import type { MosaicConfig } from '../config.js';
import { embedDocumentChunks } from '../embedding/embeddings.js';
import { embeddingFailureReport } from '../embedding/failure.js';
import type { EmbeddingFailureReport, EmbeddingTarget } from '../embedding/provider.js';
import type { SearchIndexData } from '../types.js';
import { readdir } from 'node:fs/promises';
import {
	EMBEDDING_INPUT_VERSION,
	INDEX_SCHEMA_VERSION,
	prepareCorpus,
	targetIndexFingerprint,
	type PreparedCorpus
} from './corpus.js';
import {
	embeddingSpaceIndexDirectory,
	indexExists,
	indexPath,
	pruneStaleEmbeddingSpaceIndexes,
	readIndex,
	writeIndex
} from './store.js';

export type IndexState = 'current' | 'missing' | 'stale' | 'empty' | 'invalid' | 'corrupt' | 'dimension_mismatch';
export interface IndexStatus {
	target: EmbeddingTarget;
	state: IndexState;
	fingerprint: string;
	corpusFingerprint: string;
	path: string;
	chunkCount: number;
	error?: string;
}

async function hasOtherEmbeddingSpaceArtifacts(config: MosaicConfig, target: EmbeddingTarget): Promise<boolean> {
	try {
		return (await readdir(embeddingSpaceIndexDirectory(config, target))).some((name) => name.endsWith('.json'));
	} catch {
		return false;
	}
}

export async function getTargetIndexStatus(
	config: MosaicConfig,
	target: EmbeddingTarget,
	prepared?: PreparedCorpus
): Promise<IndexStatus> {
	const corpus = prepared ?? await prepareCorpus(config);
	const fingerprint = targetIndexFingerprint(corpus.corpusFingerprint, target);
	const base = {
		target,
		fingerprint,
		corpusFingerprint: corpus.corpusFingerprint,
		path: indexPath(config, target, fingerprint),
		chunkCount: corpus.chunks.length
	};
	if (corpus.chunks.length === 0) return { ...base, state: 'empty' };
	if (!(await indexExists(config, target, fingerprint))) {
		return { ...base, state: await hasOtherEmbeddingSpaceArtifacts(config, target) ? 'stale' : 'missing' };
	}
	try {
		await readIndex(config, target, fingerprint);
		return { ...base, state: 'current' };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The search index is invalid.';
		if (message.includes('dimensions')) return { ...base, state: 'dimension_mismatch', error: message };
		if (error instanceof SyntaxError) return { ...base, state: 'corrupt', error: message };
		return { ...base, state: 'invalid', error: message };
	}
}

export async function getIndexStatus(config: MosaicConfig): Promise<IndexStatus[]> {
	const corpus = await prepareCorpus(config);
	return Promise.all(config.embedding.targets.map((target) => getTargetIndexStatus(config, target, corpus)));
}
