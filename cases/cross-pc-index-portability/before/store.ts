import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import type { SearchIndexData } from '../types.js';
import { INDEX_SCHEMA_VERSION } from './corpus.js';

export function targetIndexDirectory(config: MosaicConfig, target: EmbeddingTarget): string {
	return resolve(config.retrieval.indexDirectory, target.id);
}

export function indexPath(config: MosaicConfig, target: EmbeddingTarget, fingerprint: string): string {
	return resolve(targetIndexDirectory(config, target), `${fingerprint}.json`);
}

export async function indexExists(config: MosaicConfig, target: EmbeddingTarget, fingerprint: string): Promise<boolean> {
	try {
		await access(indexPath(config, target, fingerprint));
		return true;
	} catch {
		return false;
	}
}

export async function readIndex(config: MosaicConfig, target: EmbeddingTarget, fingerprint: string): Promise<SearchIndexData> {
	const parsed = JSON.parse(await readFile(indexPath(config, target, fingerprint), 'utf8')) as SearchIndexData;
	if (
		parsed.fingerprint !== fingerprint ||
		parsed.schemaVersion !== INDEX_SCHEMA_VERSION ||
		parsed.targetId !== target.id ||
		parsed.embeddingProvider !== target.provider ||
		parsed.embeddingModel !== target.model ||
		!Array.isArray(parsed.chunks)
	) {
		throw new Error('The search index is invalid. Rebuild it.');
	}
	if (parsed.vectorDimension !== target.dimensions || parsed.chunks.some(({ vector }) => !Array.isArray(vector) || vector.length !== target.dimensions)) {
		throw new Error('The search index vector dimensions do not match its embedding target.');
	}
	return parsed;
}

export async function writeIndex(config: MosaicConfig, target: EmbeddingTarget, index: SearchIndexData): Promise<string> {
	await mkdir(targetIndexDirectory(config, target), { recursive: true });
	const destination = indexPath(config, target, index.fingerprint);
	const temporary = `${destination}.${process.pid}.tmp`;
	await writeFile(temporary, JSON.stringify(index), 'utf8');
	await rename(temporary, destination);
	return destination;
}
