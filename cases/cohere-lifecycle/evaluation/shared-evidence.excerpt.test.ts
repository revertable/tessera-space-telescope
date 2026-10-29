import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config.js';
import { GenerationProviderError, type GenerationRequest } from '../../generation/provider.js';
import { prepareRetrievalSnapshot, identityHash, type RetrievalSnapshot } from './snapshots.js';
import { calibrationConfig, compareGenerationTargets } from './run.js';
import type { IndexStatus } from '../../indexing/indexer.js';
import type { PreparedCorpus } from '../../indexing/corpus.js';
import type { LocalCandidate } from '../search.js';

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

function fixture() {
	const config = loadConfig();
	config.credentials = {};
	const target = config.embedding.targets[0];
	const chunks = [1, 2].map((n) => ({ id: `source:${n}`, sourceId: 'source', title: 'Title', section: `Section ${n}`, content: `Record ${n}`, publicUrl: null }));
	const corpus: PreparedCorpus = { corpusFingerprint: 'corpus', documentHashes: {}, chunks };
	const status: IndexStatus = { target, state: 'current', fingerprint: 'index', corpusFingerprint: 'corpus', path: 'unused', chunkCount: 2 };
	const ranked: LocalCandidate[] = chunks.map((chunk, index) => ({ ...chunk, score: 0.9 - index * 0.1 }));
	const retrieve = vi.fn(async () => ranked);
	const dependencies = { prepareCorpus: vi.fn(async () => corpus), getTargetIndexStatus: vi.fn(async () => status), retrieve };
	const ids = config.generation.targets.filter((t) => t.id !== 'gemini-3-1-flash-lite').map((t) => t.id);
	return { config, target, corpus, status, dependencies, ids };
}

	it('retrieves once, delivers identical evidence to three targets, and propagates citations', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const generate = vi.fn(async (_request: GenerationRequest) => ({ content: '{"basis":"records","answer":"Supported","citations":["S2","S1"]}' }));
		const report = await compareGenerationTargets(f.config, snapshot, f.ids, { ...f.dependencies, generationFactory: () => ({ generate }) });
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
		expect(generate).toHaveBeenCalledTimes(3);
		expect(new Set(generate.mock.calls.map(([r]) => r.contents)).size).toBe(1);
		expect(generate.mock.calls.map(([r]) => r.target.id)).toEqual(f.ids);
		expect(report.results.every((r) => r.snapshotHash === snapshot.hash && r.result?.status === 'answered')).toBe(true);
		expect(report.results[0].result?.sources.map((s) => s.citationId)).toEqual(['S1', 'S2']);
	});

	it('reuses a snapshot after credential/runtime changes without another query embedding', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		f.config.embedding.runtimeTargets = [f.config.embedding.targets[1]];
		f.config.embedding.targets[0].credentialSlot = 'rotated_slot';
		f.config.generation.runtimeTargetIds.reverse();
		const reused = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', snapshot, f.dependencies);
		expect(reused).toEqual(snapshot);
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
	});

	it('records one generator failure and continues explicit comparisons without fallback', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const generate = vi.fn().mockRejectedValueOnce(new GenerationProviderError('quota_exhausted', 'private provider error')).mockResolvedValue({ content: '{"basis":"records","answer":"Supported","citations":["S1"]}' });
		const report = await compareGenerationTargets(f.config, snapshot, f.ids, { ...f.dependencies, generationFactory: () => ({ generate }) });
		expect(generate).toHaveBeenCalledTimes(3);
		expect(report.results.map((r) => r.status)).toEqual(['failure', 'success', 'success']);
		expect(report.results[0].failureCategory).toBe('quota_exhausted');
		expect(JSON.stringify(report)).not.toContain('private provider error');
	});

	it('applies production citation validation to explicit results', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const report = await compareGenerationTargets(f.config, snapshot, [f.ids[0]], { ...f.dependencies, generationFactory: () => ({ generate: async () => ({ content: '{"basis":"records","answer":"Unsupported citation","citations":["S99"]}' }) }) });
		expect(report.results[0].result).toMatchObject({ status: 'citation_error', sources: [] });
	});

	it('reports missing generation credentials without borrowing embedding keys or calling providers', async () => {
		const f = fixture();
		f.config.credentials = { embedding_1: 'embedding-only-key' };
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const report = await compareGenerationTargets(f.config, snapshot, f.ids, f.dependencies);
		expect(report.results.map((r) => r.failureCategory)).toEqual(['configuration', 'configuration', 'configuration']);
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
		expect(JSON.stringify(report)).not.toContain('embedding-only-key');
	});
