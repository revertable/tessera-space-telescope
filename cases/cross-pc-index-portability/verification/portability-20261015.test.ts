import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig, type MosaicConfig } from '../config.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import { searchLocalCandidateBundle } from '../retrieval/search.js';
import type { SearchIndexData } from '../types.js';
import { prepareCorpus, targetIndexFingerprint, type PreparedCorpus } from './corpus.js';
import { getTargetIndexStatus } from './indexer.js';
import * as indexer from './indexer.js';
import * as migration from './migrate.js';
import { indexPath, readIndex } from './store.js';

const checksum = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let directory: string;
let baseline: MosaicConfig;
let baselineCorpus: PreparedCorpus;
let sources: Awaited<ReturnType<typeof loadApprovedSources>>;

beforeAll(async () => {
	baseline = loadConfig();
	sources = await loadApprovedSources(baseline);
	baselineCorpus = await prepareCorpus(baseline);
	expect(sources).toHaveLength(27);
	expect(baselineCorpus.chunks).toHaveLength(372);
	const temporaryRoot = resolve(baseline.projectRoot, 'tmp');
	await mkdir(temporaryRoot, { recursive: true });
	directory = await mkdtemp(resolve(temporaryRoot, 'index-portability-'));
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

describe.each(['gemini', 'cohere'] as const)('repository %s production artifact across checkout line endings', (provider) => {
	let target: EmbeddingTarget;
	let fingerprint: string;
	let artifact: SearchIndexData;
	let baselineArtifactPath: string;
	let artifactBytes: Buffer;
	let originalVectorHash: string;

	beforeAll(async () => {
		const targets = baseline.embedding.targets.filter((target) => target.provider === provider);
		expect(targets).toHaveLength(1);
		target = targets[0];
		// Resolve the exact current artifact from the corpus, never a pinned filename or directory order.
		fingerprint = targetIndexFingerprint(baselineCorpus.corpusFingerprint, target);
		const status = await getTargetIndexStatus(baseline, target, baselineCorpus);
		expect(status).toMatchObject({ state: 'current', fingerprint, chunkCount: 372 });
		baselineArtifactPath = status.path;
		artifactBytes = await readFile(baselineArtifactPath);
		artifact = await readIndex(baseline, target, fingerprint);
		originalVectorHash = checksum(artifact.chunks.map(({ vector }) => vector));
	});

	async function checkout(kind: string): Promise<MosaicConfig> {
		const root = resolve(directory, provider, kind);
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
			embedding: { ...baseline.embedding, runtimeTargets: [target] },
			credentials: { [target.credentialSlot]: 'query-test-only' },
			knowledge: { ...baseline.knowledge, manifestPath: manifest },
			retrieval: { ...baseline.retrieval, indexDirectory: resolve(root, 'indexes') }
		};
		const destination = indexPath(config, target, fingerprint);
		await mkdir(dirname(destination), { recursive: true });
		// Copy the repository artifact bytes. No build, migration, or vector generation in this fixture.
		await copyFile(baselineArtifactPath, destination);
		return config;
	}

	it('matches the current 27-source, 372-chunk corpus and embedding input contract', () => {
		expect(artifact).toMatchObject({
			embeddingProvider: target.provider, embeddingModel: target.model,
			vectorDimension: target.dimensions, embeddingInputVersion: 2,
			fingerprint, corpusFingerprint: baselineCorpus.corpusFingerprint,
			documentHashes: baselineCorpus.documentHashes
		});
		expect(Object.keys(artifact.documentHashes)).toHaveLength(27);
		expect(artifact.chunks).toHaveLength(372);
		expect(artifact.chunks.map(({ vector: _vector, ...chunk }) => chunk)).toEqual(baselineCorpus.chunks);
	});

	it.each(['LF', 'CRLF', 'CR', 'mixed'])('reads and searches the identical artifact immediately in a %s checkout', async (kind) => {
		const config = await checkout(kind);
		const build = vi.spyOn(indexer, 'buildIndex').mockRejectedValue(new Error('Index build forbidden'));
		const buildTarget = vi.spyOn(indexer, 'buildTargetIndex').mockRejectedValue(new Error('Index build forbidden'));
		const migrate = vi.spyOn(migration, 'migrateIndexIdentity').mockRejectedValue(new Error('Migration forbidden'));
		const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live API calls permitted'));
		const corpus = await prepareCorpus(config);
		expect(corpus.corpusFingerprint).toBe(baselineCorpus.corpusFingerprint);
		expect(corpus.documentHashes).toEqual(artifact.documentHashes);
		expect(corpus.chunks).toEqual(artifact.chunks.map(({ vector: _vector, ...chunk }) => chunk));
		expect(targetIndexFingerprint(corpus.corpusFingerprint, target)).toBe(fingerprint);
		const status = await getTargetIndexStatus(config, target);
		expect(status).toMatchObject({ state: 'current', fingerprint, chunkCount: 372 });
		expect((await readFile(status.path)).equals(artifactBytes)).toBe(true);
		const index = await readIndex(config, target, status.fingerprint);
		expect(checksum(index)).toBe(checksum(artifact));
		expect(checksum(index.chunks.map(({ vector }) => vector))).toBe(originalVectorHash);

		// Production retrieval needs a query embedding; stub only that operation.
		const embedQuery = vi.fn(async () => artifact.chunks[0].vector);
		const embedDocuments = vi.fn(async (): Promise<number[][]> => { throw new Error('Document embedding forbidden'); });
		const result = await searchLocalCandidateBundle(config, ['What do the approved records say?'], () => ({ embedQuery, embedDocuments }));
		expect(result.target.id).toBe(target.id);
		expect(result.ranked[0]).toHaveLength(372);
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
		expect(corpus.corpusFingerprint).not.toBe(baselineCorpus.corpusFingerprint);
		expect(targetIndexFingerprint(corpus.corpusFingerprint, config.embedding.runtimeTargets[0])).not.toBe(fingerprint);
		expect((await getTargetIndexStatus(config, config.embedding.runtimeTargets[0])).state).toBe('stale');
	});
});
