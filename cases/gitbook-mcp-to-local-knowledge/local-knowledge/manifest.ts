import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { assertWithin, type MosaicConfig } from '../config.js';
import type { SourceDefinition } from '../types.js';

interface ManifestFile {
	version: number;
	sources: SourceDefinition[];
}

export interface LoadedSource extends SourceDefinition {
	absolutePath: string;
	content: string;
}

export async function loadApprovedSources(config: MosaicConfig): Promise<LoadedSource[]> {
	const manifest = JSON.parse(await readFile(config.knowledge.manifestPath, 'utf8')) as ManifestFile;
	if (manifest.version !== 1 || !Array.isArray(manifest.sources)) {
		throw new Error('knowledge/sources.json must contain version 1 and a sources array.');
	}
	const knowledgeRoot = dirname(config.knowledge.manifestPath);
	const seenIds = new Set<string>();
	const loaded: LoadedSource[] = [];

	for (const source of manifest.sources) {
		if (!source || typeof source.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(source.id)) {
			throw new Error('Every source needs an id containing only letters, numbers, hyphens, or underscores.');
		}
		if (seenIds.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
		if (typeof source.file !== 'string' || typeof source.title !== 'string' || !source.title.trim()) {
			throw new Error(`Source ${source.id} needs a file and title.`);
		}
		const absolutePath = assertWithin(knowledgeRoot, resolve(knowledgeRoot, source.file), `source ${source.id}`);
		if (extname(absolutePath).toLowerCase() !== '.md') throw new Error(`Source ${source.id} must be Markdown.`);
		if (source.publicUrl) {
			const url = new URL(source.publicUrl);
			if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Source ${source.id} has an invalid publicUrl.`);
		}
		seenIds.add(source.id);
		loaded.push({
			...source,
			title: source.title.trim(),
			publicUrl: source.publicUrl ?? null,
			absolutePath,
			content: await readFile(absolutePath, 'utf8')
		});
	}
	return loaded;
}
