import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig, type MosaicConfig } from '../config.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import { searchLocalCandidateBundle } from '../retrieval/search.js';
import type { SearchIndexData } from '../types.js';
import { prepareCorpus, targetIndexFingerprint } from './corpus.js';
import { getTargetIndexStatus } from './indexer.js';
import * as indexer from './indexer.js';
import * as migration from './migrate.js';
import { indexPath, readIndex } from './store.js';

const fingerprint = '23601dded9d2a9722d12e9083f23061d6c53d71c5e7d8ba884df87f2e7716f61';
const corpusFingerprint = 'e33efbad546d96a0d4715253cee0a3387009aec3dc7f9df6112caec74f3bc49f';
const originalVectorHash = '662bf30f36c66af0a78fd294ed7dfe2346dea6182e1a5710752839fe68d68e80';
const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let directory: string;
let baseline: MosaicConfig;
let artifact: SearchIndexData;
let baselineArtifactPath: string;
let artifactBytes: Buffer;
let sources: Awaited<ReturnType<typeof loadApprovedSources>>;

beforeAll(async () => {
	baseline = loadConfig();
	const target = baseline.embedding.runtimeTargets[0];
	baselineArtifactPath = indexPath(baseline, target, fingerprint);
	artifactBytes = await readFile(baselineArtifactPath);
	artifact = await readIndex(baseline, target, fingerprint);
	sources = await loadApprovedSources(baseline);
	const temporaryRoot = resolve(baseline.projectRoot, 'tmp');
	await mkdir(temporaryRoot, { recursive: true });
	directory = await mkdtemp(resolve(temporaryRoot, 'index-portability-'));
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function checkout(kind: string): Promise<MosaicConfig> {
	const root = resolve(directory, kind);
	const manifest = resolve(root, 'knowledge', 'sources.json');
	await mkdir(dirname(manifest), { recursive: true });
	await copyFile(baseline.knowledge.manifestPath, manifest);
	for (const source of sources) {
		const file = resolve(dirname(manifest), source.file);
		await mkdir(dirname(file), { recursive: true });
		let position = 0;
		const content = source.content.replace(/\n/g, () => kind === 'CRLF' ? '\r\n' : kind === 'CR' ? '\r' : kind === 'mixed' ? ['\n', '\r', '\r\n'][position++ % 3] : '\n');
		await writeFile(file, content);
	}
	const config = {
		...baseline, projectRoot: root,
		credentials: { [baseline.embedding.runtimeTargets[0].credentialSlot]: 'query-test-only' },
		knowledge: { ...baseline.knowledge, manifestPath: manifest },
		retrieval: { ...baseline.retrieval, indexDirectory: resolve(root, 'indexes') }
	};
	const destination = indexPath(config, config.embedding.runtimeTargets[0], fingerprint);
	await mkdir(dirname(destination), { recursive: true });
	// Copy the repository artifact bytes. No build, migration, or vector generation in this fixture.
	await copyFile(baselineArtifactPath, destination);
	return config;
}

describe('one repository Cohere production artifact across checkout line endings', () => {
	it('preserves the original 505 vectors and embedding input contract', () => {
		expect(artifact).toMatchObject({ embeddingProvider: 'cohere', embeddingModel: 'embed-v4.0', vectorDimension: 1536, embeddingInputVersion: 2 });
		expect(artifact.chunks).toHaveLength(505);
		expect(checksum(artifact.chunks.map(({ vector }) => vector))).toBe(originalVectorHash);
	});

	it.each(['LF', 'CRLF', 'CR', 'mixed'])('reads and searches the identical artifact immediately in a %s checkout', async (kind) => {
		const config = await checkout(kind);
		const target = config.embedding.runtimeTargets[0];
		const build = vi.spyOn(indexer, 'buildIndex');
		const buildTarget = vi.spyOn(indexer, 'buildTargetIndex');
		const migrate = vi.spyOn(migration, 'migrateIndexIdentity');
		const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live API calls permitted'));
		const corpus = await prepareCorpus(config);
		expect(corpus.corpusFingerprint).toBe(corpusFingerprint);
		expect(corpus.documentHashes).toEqual(artifact.documentHashes);
		expect(corpus.chunks).toEqual(artifact.chunks.map(({ vector: _vector, ...chunk }) => chunk));
		expect(targetIndexFingerprint(corpus.corpusFingerprint, target)).toBe(fingerprint);
		const status = await getTargetIndexStatus(config, target);
		expect(status).toMatchObject({ state: 'current', fingerprint, chunkCount: 505 });
		expect((await readFile(status.path)).equals(artifactBytes)).toBe(true);
		const index = await readIndex(config, target, status.fingerprint);
		expect(checksum(index)).toBe(checksum(artifact));

		// Production retrieval needs a query embedding; stub only that operation.
		const embedQuery = vi.fn(async () => artifact.chunks[0].vector);
		const embedDocuments = vi.fn(async (): Promise<number[][]> => { throw new Error('Document embedding forbidden'); });
		const result = await searchLocalCandidateBundle(config, ['What do the approved records say?'], () => ({ embedQuery, embedDocuments }));
		expect(result.target.id).toBe(target.id);
		expect(result.ranked[0]).toHaveLength(505);
		expect(result.ranked[0][0].score).toBeCloseTo(1);
		expect(embedQuery).toHaveBeenCalledOnce();
		expect(embedDocuments).not.toHaveBeenCalled();
		expect(build).not.toHaveBeenCalled();
		expect(buildTarget).not.toHaveBeenCalled();
		expect(migrate).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does not treat a real source-content change as the same corpus', async () => {
		const config = await checkout('changed');
		await writeFile(resolve(dirname(config.knowledge.manifestPath), sources[0].file), sources[0].content + '\nAdditional evidence.\n');
		const corpus = await prepareCorpus(config);
		expect(corpus.corpusFingerprint).not.toBe(corpusFingerprint);
		expect(targetIndexFingerprint(corpus.corpusFingerprint, config.embedding.runtimeTargets[0])).not.toBe(fingerprint);
		expect((await getTargetIndexStatus(config, config.embedding.runtimeTargets[0])).state).toBe('stale');
	});
});
