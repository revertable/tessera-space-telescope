import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config.js';
import { GenerationProviderError, type GenerationRequest } from '../../generation/provider.js';
import { prepareRetrievalSnapshot, identityHash, type RetrievalSnapshot } from './snapshots.js';
import { generationComparisonConfig, compareGenerationTargets } from './run.js';
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
	// Keep this two-target fixture independent of additional evaluation-only registry entries.
	const ids = [...config.generation.runtimeTargetIds];
	return { config, target, corpus, status, dependencies, ids };
}

function rehash(snapshot: RetrievalSnapshot) {
	const { hash: _hash, ...data } = snapshot;
	snapshot.hash = identityHash(data);
}

	it('applies comparison limits without changing production and retains incomplete-response metadata', async () => {
		const f = fixture();
		const original = structuredClone(f.config.generation);
		const config = generationComparisonConfig(f.config, Object.fromEntries(f.ids.map((id, index) => [id, { maxOutputTokens: index === 1 ? 900 : 8192 }])));
		expect(f.config.generation).toEqual(original);
		expect(config.generation.runtimeTargetIds).toEqual(original.runtimeTargetIds);
		const snapshot = await prepareRetrievalSnapshot(config, f.target.id, 'case-one', '한국어 질문?', undefined, f.dependencies);
		const metadata = { finishReason: 'MAX_TOKENS', usage: { tokens: { output_tokens: 8192 } }, httpStatus: 200 };
		const generate = vi.fn().mockRejectedValueOnce(new GenerationProviderError('invalid_response', 'private', 200, undefined, undefined, metadata)).mockResolvedValue({ content: '{"basis":"records","answer":"답변","citations":["S1"]}', metadata: { finishReason: 'stop', usage: { completion_tokens: 40 } } });
		const report = await compareGenerationTargets(config, snapshot, f.ids, { ...f.dependencies, generationFactory: () => ({ generate }) });
		expect(generate.mock.calls.map(([request]) => request.maxOutputTokens)).toEqual([8192, 900]);
		expect(generate.mock.calls.every(([request]) => request.retryPolicy === 'none')).toBe(true);
		expect(report.results[0].metadata).toEqual(metadata);
		expect(report.results[1].validation).toEqual({ json: true, schema: true, citations: true });
		expect(report.results.every((result) => result.generationAttempts === 1)).toBe(true);
		expect(report.sharedInputVerified).toBe(true);
		expect(report.questionHash).toEqual(snapshot.questionHash);
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
	});
	it('retains usage even when the returned JSON cannot be parsed', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const report = await compareGenerationTargets(f.config, snapshot, [f.ids[0]], { ...f.dependencies, generationFactory: () => ({ generate: async () => ({ content: '{', metadata: { finishReason: 'MAX_TOKENS', usage: { totalTokenCount: 88 } } }) }) });
		expect(report.results[0]).toMatchObject({ status: 'failure', metadata: { usage: { totalTokenCount: 88 } }, validation: { json: false, schema: false, citations: null } });
		expect(report.results[0].rawResponse?.content).toBe('{');
	});
	it('retrieves once, delivers identical evidence to two targets, and propagates citations', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const generate = vi.fn(async (_request: GenerationRequest) => ({ content: '{"basis":"records","answer":"Supported","citations":["S2","S1"]}' }));
		const report = await compareGenerationTargets(f.config, snapshot, f.ids, { ...f.dependencies, generationFactory: () => ({ generate }) });
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
		expect(generate).toHaveBeenCalledTimes(2);
		expect(generate.mock.calls.map(([request]) => request.maxOutputTokens)).toEqual([32768, 4096]);
		expect(new Set(generate.mock.calls.map(([r]) => r.contents)).size).toBe(1);
		expect(report.results.every(r => r.rawResponse?.content === '{"basis":"records","answer":"Supported","citations":["S2","S1"]}')).toBe(true);
		expect(generate.mock.calls.map(([r]) => r.target.id)).toEqual(f.ids);
		expect(report.results.every((r) => r.snapshotHash === snapshot.hash && r.result?.status === 'answered')).toBe(true);
		expect(report.results[0].result?.sources.map((s) => s.citationId)).toEqual(['S1', 'S2']);
	});

	it('records one generator failure and continues explicit comparisons without fallback', async () => {
		const f = fixture();
		const snapshot = await prepareRetrievalSnapshot(f.config, f.target.id, 'case-one', 'Question?', undefined, f.dependencies);
		const generate = vi.fn().mockRejectedValueOnce(new GenerationProviderError('quota_exhausted', 'private provider error')).mockResolvedValue({ content: '{"basis":"records","answer":"Supported","citations":["S1"]}' });
		const report = await compareGenerationTargets(f.config, snapshot, f.ids, { ...f.dependencies, generationFactory: () => ({ generate }) });
		expect(generate).toHaveBeenCalledTimes(2);
		expect(report.results.map((r) => r.status)).toEqual(['failure', 'success']);
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
		expect(report.results.map((r) => r.failureCategory)).toEqual(['configuration', 'configuration']);
		expect(f.dependencies.retrieve).toHaveBeenCalledOnce();
		expect(JSON.stringify(report)).not.toContain('embedding-only-key');
	});
