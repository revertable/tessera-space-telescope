import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import type { SearchIndexData } from '../types.js';
import { isPublicSourceUrl } from '../../public-source-url.js';
import {
	EMBEDDING_INPUT_VERSION,
	INDEX_SCHEMA_VERSION,
	embeddingSpaceIdentity,
	targetIndexFingerprint
} from './corpus.js';

function validateIndex(parsed: SearchIndexData, target: EmbeddingTarget, fingerprint: string): SearchIndexData {
	if (
		parsed === null ||
		typeof parsed !== 'object' ||
		parsed.fingerprint !== fingerprint ||
		parsed.schemaVersion !== INDEX_SCHEMA_VERSION ||
		typeof parsed.corpusFingerprint !== 'string' ||
		targetIndexFingerprint(parsed.corpusFingerprint, target) !== fingerprint ||
		parsed.embeddingProvider !== target.provider ||
		parsed.embeddingModel !== target.model ||
		parsed.embeddingInputVersion !== EMBEDDING_INPUT_VERSION ||
		typeof parsed.createdAt !== 'string' ||
		parsed.documentHashes === null ||
		typeof parsed.documentHashes !== 'object' ||
		Array.isArray(parsed.documentHashes) ||
		Object.values(parsed.documentHashes).some((hash) => typeof hash !== 'string') ||
		!Array.isArray(parsed.chunks)
	) {
		throw new Error('The search index is invalid. Rebuild it.');
	}
	if (
		parsed.vectorDimension !== target.dimensions ||
		parsed.chunks.some((chunk) => (
			chunk === null ||
			typeof chunk !== 'object' ||
			typeof chunk.id !== 'string' ||
			typeof chunk.sourceId !== 'string' ||
			typeof chunk.title !== 'string' ||
			typeof chunk.section !== 'string' ||
			typeof chunk.content !== 'string' ||
			!Array.isArray(chunk.vector) ||
			chunk.vector.length !== target.dimensions ||
			chunk.vector.some((value) => typeof value !== 'number' || !Number.isFinite(value))
		))
	) {
		throw new Error('The search index vector dimensions do not match its embedding target.');
	}
	if (parsed.chunks.some((chunk) => !isPublicSourceUrl(chunk.publicUrl))) {
		throw new Error('The search index contains an invalid publicUrl.');
	}
	return parsed;
}

async function readIndexAtPath(path: string, target: EmbeddingTarget, fingerprint: string): Promise<SearchIndexData> {
	return validateIndex(JSON.parse(await readFile(path, 'utf8')) as SearchIndexData, target, fingerprint);
}

export async function readIndex(config: MosaicConfig, target: EmbeddingTarget, fingerprint: string): Promise<SearchIndexData> {
	return readIndexAtPath(indexPath(config, target, fingerprint), target, fingerprint);
}

export async function writeIndex(config: MosaicConfig, target: EmbeddingTarget, index: SearchIndexData): Promise<string> {
	const directory = embeddingSpaceIndexDirectory(config, target);
	await mkdir(directory, { recursive: true });
	const destination = indexPath(config, target, index.fingerprint);
	const temporary = resolve(directory, `.${index.fingerprint}.${process.pid}.${randomUUID()}.tmp`);
	try {
		await writeFile(temporary, JSON.stringify(index), 'utf8');
		await readIndexAtPath(temporary, target, index.fingerprint);
		await rename(temporary, destination);
	} catch (error) {
		await rm(temporary, { force: true }).catch(() => undefined);
		throw error;
	}
	return destination;
}

export async function pruneStaleEmbeddingSpaceIndexes(
	config: MosaicConfig,
	target: EmbeddingTarget,
	currentFingerprint: string
): Promise<void> {
	const directory = embeddingSpaceIndexDirectory(config, target);
	const currentName = `${currentFingerprint}.json`;
	const entries = await readdir(directory, { withFileTypes: true });
	await Promise.all(entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== currentName)
		.map((entry) => unlink(resolve(directory, entry.name))));
}
