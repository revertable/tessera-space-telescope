import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import type { MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import type { SearchIndexData } from '../types.js';
import {
	EMBEDDING_INPUT_VERSION,
	INDEX_SCHEMA_VERSION,
	embeddingSpaceIdentity,
	targetIndexFingerprint
} from './corpus.js';

function persistentPathSegment(value: string): string {
	return [...Buffer.from(value, 'utf8')]
		.map((byte) => (
			(byte >= 0x61 && byte <= 0x7a) ||
			(byte >= 0x30 && byte <= 0x39) ||
			byte === 0x2e || byte === 0x5f || byte === 0x2d
				? String.fromCharCode(byte)
				: `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
		))
		.join('');
}

export function embeddingSpaceIndexDirectory(
	config: MosaicConfig,
	target: EmbeddingTarget,
	embeddingInputVersion = EMBEDDING_INPUT_VERSION
): string {
	const identity = embeddingSpaceIdentity(target, embeddingInputVersion);
	return resolve(
		config.retrieval.indexDirectory,
		`provider=${persistentPathSegment(identity.provider)}`,
		`model=${persistentPathSegment(identity.model)}`,
		`dimensions=${identity.dimensions}`,
		`input=v${identity.embeddingInputVersion}`
	);
}

export function indexPath(config: MosaicConfig, target: EmbeddingTarget, fingerprint: string): string {
	return resolve(embeddingSpaceIndexDirectory(config, target), `${fingerprint}.json`);
}
