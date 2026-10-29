import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type MosaicConfig } from '../../config.js';
import type { GenerationRequest } from '../../generation/provider.js';
import * as search from '../search.js';
import * as embedding from '../../embedding/embeddings.js';
import * as indexer from '../../indexing/indexer.js';
import { buildAnswerContents } from '../../generation/answer-prompt.js';
import type { CanonicalSnapshot } from './canonical-snapshots.js';
import { identityHash } from './snapshots.js';
import {
	prepareCanonicalSnapshot, canonicalGenerationPlan, canonicalGenerationTargets,
	runCanonicalGeneration, writeCanonicalJson
} from './canonical-generation.js';

let config: MosaicConfig, snapshot: CanonicalSnapshot;
const directories: string[] = [];
beforeAll(async () => {
	config = loadConfig();
	config.credentials = Object.fromEntries(config.generation.targets.map(t => [t.credentialSlot, 'mock-secret-not-for-artifacts']));
	snapshot = await prepareCanonicalSnapshot(config);
});
beforeEach(() => {
	vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(search, 'searchLocalCandidatesForTarget').mockRejectedValue(new Error('Retrieval forbidden'));
	vi.spyOn(search, 'searchLocalCandidateBundle').mockRejectedValue(new Error('Retrieval forbidden'));
	vi.spyOn(embedding, 'embedQuestion').mockRejectedValue(new Error('Embedding forbidden'));
	vi.spyOn(indexer, 'getTargetIndexStatus').mockRejectedValue(new Error('Index checks forbidden'));
});
afterEach(async () => {
	try {
		for (const fn of [globalThis.fetch, search.searchLocalCandidatesForTarget, search.searchLocalCandidateBundle, embedding.embedQuestion, indexer.getTargetIndexStatus]) {
			expect(fn).not.toHaveBeenCalled();
		}
	} finally {
		vi.restoreAllMocks();
		const root = resolve(config.projectRoot, 'tmp/generation-only/runs');
		for (const path of directories.splice(0)) {
			if (!path.startsWith(root + sep)) throw new Error('Unsafe canonical test cleanup.');
			await rm(path, { recursive: true, force: true });
		}
	}
});

function runId() {
	const id = randomUUID(); directories.push(resolve(config.projectRoot, 'tmp/generation-only/runs', id)); return id;
}
const respond = async (request: GenerationRequest) => {
	const input = JSON.parse(request.contents);
	return {
		content: JSON.stringify({ basis: input.records.length ? 'records' : 'unsupported', answer: 'Mock answer', citations: input.records.length ? ['S1'] : [] }),
		metadata: { finishReason: 'stop', usage: { output_tokens: 12 } }
	};
};
const read = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

describe('generation-only comparison and artifacts', () => {
	it('plans and prepares inputs without an index, embedding or provider', async () => {
		const copy = structuredClone(config); copy.credentials = {}; copy.retrieval.indexDirectory = resolve(config.projectRoot, 'tmp/nonexistent-index');
		const fresh = await prepareCanonicalSnapshot(copy);
		expect(fresh).toEqual(snapshot);
		const plan = canonicalGenerationPlan(copy, fresh);
		expect(plan).toMatchObject({ mode: 'generation-only', execution: 'not-started', plannedEmbeddingCalls: 0, plannedGenerationCalls: 80, ready: false });
		expect(plan.targets.map(t => t.id)).toEqual(['gemini-3-5-flash-lite', 'groq-gpt-oss-120b']);
		expect(plan.blockers).toHaveLength(2);
	});

	it('compares all 40 identical inputs across 80 explicit mock calls and preserves inspectable artifacts', async () => {
		const generate = vi.fn(respond), id = runId();
		const completion = await runCanonicalGeneration(config, snapshot, 'a'.repeat(40), { runId: id, generationFactory: () => ({ generate }) });
		expect(completion).toMatchObject({ status: 'completed', completedCases: 40, successfulResults: 80, failedResults: 0, generationAttempts: 80 });
		expect(generate).toHaveBeenCalledTimes(80);
		const directory = resolve(config.projectRoot, completion.directory);
		const manifest = await read(resolve(directory, 'manifest.json'));
		const { manifestHash, ...data } = manifest;
		expect(manifestHash).toBe(identityHash(data));
		expect(manifest.snapshotHash).toBe(snapshot.hash);
		expect(manifest.questionBank).toEqual(snapshot.questionBank);
		expect(manifest.profile).toEqual(snapshot.profile);
		expect(manifest.targets.map((t: { options: object }) => t.options)).toEqual(config.generation.runtimeTargetIds.map(id => config.generation.targets.find(t => t.id === id)!.options));
		expect(JSON.stringify(manifest)).not.toContain('mock-secret');
		expect(await read(resolve(directory, 'snapshot.json'))).toEqual(snapshot);
		for (const [index, item] of snapshot.cases.entries()) {
			const left = generate.mock.calls[index * 2][0], right = generate.mock.calls[index * 2 + 1][0];
			expect(left.target.id).toBe('gemini-3-5-flash-lite');
			expect(right.target.id).toBe('groq-gpt-oss-120b');
			expect(left.contents).toBe(buildAnswerContents(item.question, item.evidence));
			expect(right.contents).toBe(left.contents);
			expect(right.systemInstruction).toBe(left.systemInstruction);
			expect(right.responseSchema).toEqual(left.responseSchema);
			expect(left.retryPolicy).toBe('none'); expect(right.retryPolicy).toBe('none');
			const artifact = await read(resolve(directory, 'results', item.caseId + '.json'));
			expect(artifact.sharedInputVerified).toBe(true);
			expect(artifact.snapshotHash).toBe(item.hash);
			for (const result of artifact.results) {
				expect(result.evidenceHash).toBe(item.evidenceHash);
				expect(result.promptHash).toBe(item.promptHash);
				expect(result.rawResponse.content).toBe(JSON.stringify(result.generated));
				expect(result.result.answer).toBe('Mock answer');
				expect(result.validation).toEqual({ json: true, schema: true, citations: true });
				expect(result.usage).toEqual({ output_tokens: 12 }); expect(result.finishReason).toBe('stop');
				expect(result.latencyMs).toBeGreaterThanOrEqual(0);
				expect(result.observations.requiredClaimCoverage).toEqual(item.expectations.requiredClaims.map(c => ({ claimId: c.claimId, status: 'pending' })));
				expect(result.observations.speakerSeparation).toBe('pending');
			}
		}
		await expect(writeCanonicalJson(resolve(directory, 'manifest.json'), {})).rejects.toMatchObject({ code: 'EEXIST' });
		await expect(runCanonicalGeneration(config, snapshot, 'a'.repeat(40), { runId: id, generationFactory: () => ({ generate }) })).rejects.toMatchObject({ code: 'EEXIST' });
		expect(generate).toHaveBeenCalledTimes(80);
	});

	it('retains malformed raw text and usage while continuing without retries or fallback', async () => {
		const generate = vi.fn(respond).mockResolvedValueOnce({ content: '{', metadata: { finishReason: 'length', usage: { output_tokens: 12 } } });
		const result = await runCanonicalGeneration(config, snapshot, 'b'.repeat(40), { runId: runId(), generationFactory: () => ({ generate }) });
		expect(result).toMatchObject({ status: 'completed-with-failures', successfulResults: 79, failedResults: 1, generationAttempts: 80 });
		const artifact = await read(resolve(config.projectRoot, result.directory, 'results/QB01.json'));
		expect(artifact.results[0]).toMatchObject({ status: 'failure', rawResponse: { content: '{' }, result: null, generated: null, finishReason: 'length' });
		expect(artifact.results[0].validation.json).toBe(false);
		expect(artifact.results[1].status).toBe('success');
	});

	it('records unavailable responses explicitly without inventing usage or leaking errors', async () => {
		const generate = vi.fn(respond).mockRejectedValueOnce(new Error('private provider message'));
		const result = await runCanonicalGeneration(config, snapshot, 'b'.repeat(40), { runId: runId(), generationFactory: () => ({ generate }) });
		const artifact = await read(resolve(config.projectRoot, result.directory, 'results/QB01.json'));
		expect(artifact.results[0]).toMatchObject({ rawResponse: null, usage: null, finishReason: null, generated: null, result: null });
		expect(artifact.results[0].unavailableResponseReason).toBeTruthy();
		expect(JSON.stringify(artifact)).not.toContain('private provider message');
	});

	it('validates the last question and both target credentials before the first provider call', async () => {
		const factory = vi.fn(() => ({ generate: vi.fn(respond) }));
		const bad = structuredClone(snapshot); bad.cases[39].question += ' changed';
		await expect(runCanonicalGeneration(config, bad, 'a'.repeat(40), { generationFactory: factory })).rejects.toThrow('Canonical snapshot');
		const copy = structuredClone(config), groq = copy.generation.targets.find(t => t.id === 'groq-gpt-oss-120b')!;
		delete copy.credentials[groq.credentialSlot];
		await expect(runCanonicalGeneration(copy, snapshot, 'a'.repeat(40), { generationFactory: factory })).rejects.toThrow('not ready');
		expect(factory).not.toHaveBeenCalled();
	});

	it('rejects target drift instead of silently following a new runtime matrix', () => {
		const copy = structuredClone(config); copy.generation.runtimeTargetIds.reverse();
		expect(() => canonicalGenerationTargets(copy)).toThrow('runtime contract');
		copy.generation.runtimeTargetIds.reverse(); copy.generation.targets.find(t => t.id === 'groq-gpt-oss-120b')!.model = 'different';
		expect(() => canonicalGenerationTargets(copy)).toThrow('identity changed');
	});
});
