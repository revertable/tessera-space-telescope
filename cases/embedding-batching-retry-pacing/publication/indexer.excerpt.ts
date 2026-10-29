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

export async function buildTargetIndex(
	config: MosaicConfig,
	target: EmbeddingTarget,
	force = false,
	prepared?: PreparedCorpus
): Promise<IndexStatus> {
	const corpus = prepared ?? await prepareCorpus(config);
	const fingerprint = targetIndexFingerprint(corpus.corpusFingerprint, target);
	if (!force && (await indexExists(config, target, fingerprint))) {
		const status = await getTargetIndexStatus(config, target, corpus);
		if (status.state === 'current') {
			await pruneStaleEmbeddingSpaceIndexes(config, target, fingerprint);
		}
		return status;
	}
	const vectors = corpus.chunks.length ? await embedDocumentChunks(config, target, corpus.chunks) : [];
	if (vectors.length !== corpus.chunks.length) {
		throw new Error('The embedding count does not match the knowledge chunk count.');
	}
	const data: SearchIndexData = {
		schemaVersion: INDEX_SCHEMA_VERSION,
		fingerprint,
		corpusFingerprint: corpus.corpusFingerprint,
		createdAt: new Date().toISOString(),
		embeddingProvider: target.provider,
		embeddingModel: target.model,
		embeddingInputVersion: EMBEDDING_INPUT_VERSION,
		vectorDimension: vectors[0]?.length ?? target.dimensions,
		documentHashes: corpus.documentHashes,
		chunks: corpus.chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] }))
	};
	await writeIndex(config, target, data);
	await readIndex(config, target, fingerprint);
	await pruneStaleEmbeddingSpaceIndexes(config, target, fingerprint);
	return getTargetIndexStatus(config, target, corpus);
}

export interface IndexBuildResult {
	target: EmbeddingTarget;
	status?: IndexStatus;
	error?: string;
	failure?: EmbeddingFailureReport;
}

export async function buildIndex(config: MosaicConfig, force = false, onlyTargetId?: string): Promise<IndexBuildResult[]> {
	const corpus = await prepareCorpus(config);
	const results: IndexBuildResult[] = [];
	const targets = onlyTargetId === undefined
		? config.embedding.targets
		: config.embedding.targets.filter(({ id }) => id === onlyTargetId);
	if (onlyTargetId !== undefined && targets.length !== 1) throw new Error(`Unknown embedding build target: ${onlyTargetId}.`);
	for (const target of targets) {
		try {
			results.push({ target, status: await buildTargetIndex(config, target, force, corpus) });
		} catch (error) {
			const failure = embeddingFailureReport(error);
			results.push({
				target,
				error: error instanceof Error ? error.message : 'Index build failed.',
				...(failure ? { failure } : {})
			});
		}
	}
	return results;
}
