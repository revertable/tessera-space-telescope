import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MosaicConfig } from '../config.js';
import type { SearchIndexData } from '../types.js';
import { INDEX_SCHEMA_VERSION } from './corpus.js';

export function indexPath(config: MosaicConfig, fingerprint: string): string {
	return resolve(config.retrieval.indexDirectory, `${fingerprint}.json`);
}

export async function indexExists(config: MosaicConfig, fingerprint: string): Promise<boolean> {
	try {
		await access(indexPath(config, fingerprint));
		return true;
	} catch {
		return false;
	}
}

export async function readIndex(config: MosaicConfig, fingerprint: string): Promise<SearchIndexData> {
	const parsed = JSON.parse(await readFile(indexPath(config, fingerprint), 'utf8')) as SearchIndexData;
	if (parsed.fingerprint !== fingerprint || parsed.schemaVersion !== INDEX_SCHEMA_VERSION || !Array.isArray(parsed.chunks)) {
		throw new Error('The search index is invalid. Rebuild it.');
	}
	return parsed;
}

export async function writeIndex(config: MosaicConfig, index: SearchIndexData): Promise<string> {
	await mkdir(config.retrieval.indexDirectory, { recursive: true });
	const destination = indexPath(config, index.fingerprint);
	const temporary = `${destination}.${process.pid}.tmp`;
	await writeFile(temporary, JSON.stringify(index), 'utf8');
	if (await indexExists(config, index.fingerprint)) await rm(destination);
	await rename(temporary, destination);
	return destination;
}
