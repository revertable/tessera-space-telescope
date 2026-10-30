import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CHUNKER_VERSION } from '../knowledge/chunker.js';
import { loadConfig } from '../config.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import {
	EMBEDDING_INPUT_VERSION,
	embeddingSpaceIdentity,
	prepareCorpus,
	targetIndexFingerprint
} from './corpus.js';


describe('hierarchy-preserving approved corpus', () => {
	it('preserves all 38 career chunks and independently verifies all 24 child contexts', async () => {
		const config = loadConfig();
		const source = (await loadApprovedSources(config)).find((item) => item.id === 'professional-career-history')!;
		const chunks = (await prepareCorpus(config)).chunks.filter((chunk) => chunk.sourceId === source.id);
		expect(chunks).toHaveLength(38);
		const normalized = source.content.replace(/\r\n/g, '\n');
		const headings = [...normalized.matchAll(/^(#{1,3}) (.+)$/gm)];
		let category = '';
		let project = '';
		const checked = new Set<string>();
		for (let index = 0; index < headings.length; index++) {
			const heading = headings[index];
			if (heading[1].length === 1) category = heading[2];
			if (heading[1].length === 2) project = heading[2];
			if (heading[1].length !== 3) continue;
			const body = normalized.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? normalized.length).trim();
			const expected = category + ' > ' + project + '\n\n# ' + heading[2] + '\n\n' + body;
			const matches = chunks.filter((chunk) => chunk.section === heading[2] && chunk.content === expected);
			expect(matches).toHaveLength(1);
			checked.add(matches[0].id);
		}
		expect(checked.size).toBe(24);
	});

	it('keeps Blueprint fenced examples in IPI Defense Note and preserves real tail sections', async () => {
		const corpus = await prepareCorpus(loadConfig());
		const sourceIds = [...new Set(corpus.chunks.map((chunk) => chunk.sourceId))]
			.filter((id) => id.endsWith('protocol-agents-blueprint'));
		expect(sourceIds).toHaveLength(2);
		for (const sourceId of sourceIds) {
			const chunks = corpus.chunks.filter((chunk) => chunk.sourceId === sourceId);
			expect(chunks).toHaveLength(13);
			const exampleChunks = chunks.slice(3, 11);
			expect(exampleChunks).toHaveLength(8);
			expect(exampleChunks.every((chunk) => chunk.section === 'IPI Defense Note')).toBe(true);
			expect(exampleChunks.some((chunk) => chunk.content.includes('# AGENTS.md'))).toBe(true);
			expect(chunks.slice(11).map((chunk) => chunk.section)).toEqual(
				sourceId.startsWith('cosmic-horizon-en-') ? ['Usage', 'Next Coordinates'] : ['사용 방식', '다음 좌표']
			);
			expect(chunks.slice(11).map((chunk) => chunk.id)).toEqual([sourceId + ':0012', sourceId + ':0013']);
		}
	});

	it('includes the chunker contract version in corpus and persistent index identity', async () => {
		const config = loadConfig();
		const sources = await loadApprovedSources(config);
		const corpus = await prepareCorpus(config);
		const fingerprint = (chunkerVersion: number) => createHash('sha256').update(JSON.stringify({
			chunkerVersion,
			maxChunkCharacters: config.knowledge.maxChunkCharacters,
			overlapCharacters: config.knowledge.overlapCharacters,
			sources: sources.map((source) => ({
				id: source.id, file: source.file, title: source.title,
				publicUrl: source.publicUrl ?? null, hash: corpus.documentHashes[source.id]
			}))
		})).digest('hex');
		expect(corpus.corpusFingerprint).toBe(fingerprint(CHUNKER_VERSION));
		expect(fingerprint(CHUNKER_VERSION + 1)).not.toBe(corpus.corpusFingerprint);
		expect(targetIndexFingerprint(fingerprint(CHUNKER_VERSION + 1), config.embedding.targets[0]))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, config.embedding.targets[0]));
	});
});
