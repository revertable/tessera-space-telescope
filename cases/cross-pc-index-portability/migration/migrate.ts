import { unlink } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import { prepareCorpus, targetIndexFingerprint } from './corpus.js';
import { indexExists, indexPath, readIndex, writeIndex } from './store.js';

/** Explicit offline migration. Status/search never invoke this or rebuild an index. */
export async function migrateIndexIdentity(
	config: MosaicConfig,
	target: EmbeddingTarget,
	legacyFingerprint: string
): Promise<string> {
	if (!/^[a-f0-9]{64}$/.test(legacyFingerprint)) throw new Error('Invalid legacy index fingerprint.');
	const corpus = await prepareCorpus(config);
	// readIndex validates the legacy fingerprint, schema, embedding contract and every vector.
	const legacy = await readIndex(config, target, legacyFingerprint);
	const chunks = legacy.chunks.map(({ vector: _vector, ...chunk }) => chunk);
	if (!isDeepStrictEqual(chunks, corpus.chunks)) {
		throw new Error('Index migration requires identical chunk IDs, order, metadata and content.');
	}
	const fingerprint = targetIndexFingerprint(corpus.corpusFingerprint, target);
	const candidate = {
		...legacy,
		fingerprint,
		corpusFingerprint: corpus.corpusFingerprint,
		documentHashes: corpus.documentHashes
	};
	const destination = indexPath(config, target, fingerprint);
	if (await indexExists(config, target, fingerprint)) {
		const existing = await readIndex(config, target, fingerprint);
		if (!isDeepStrictEqual(existing, candidate)) throw new Error('Canonical index destination conflicts with migration.');
	} else {
		// Existing storage validates a complete candidate before atomic publication.
		await writeIndex(config, target, candidate);
	}
	const published = await readIndex(config, target, fingerprint);
	if (!isDeepStrictEqual(published, candidate)) throw new Error('Migrated index verification failed.');
	// Delete only the explicitly selected source, after the destination is verified.
	if (legacyFingerprint !== fingerprint) await unlink(indexPath(config, target, legacyFingerprint));
	return destination;
}
