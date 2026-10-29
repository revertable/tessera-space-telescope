import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { assertWithin, type MosaicConfig } from '../../config.js';
import { credentialConfigured } from '../../credentials.js';
import type { GenerationProviderFactory } from '../../generation/provider-factory.js';
import { getGenerationTarget } from '../../generation/provider-factory.js';
import { prepareCorpus } from '../../indexing/corpus.js';
import { loadQuestionBank, loadProfiles } from './question-bank.js';
import { createCanonicalSnapshot, validateCanonicalSnapshot, type CanonicalSnapshot } from './canonical-snapshots.js';
import { compareFixedGenerationInputs } from './run.js';
import { identityHash } from './snapshots.js';

const TARGETS = [
	['gemini-3-5-flash-lite', 'gemini', 'gemini-3.5-flash-lite'],
	['groq-gpt-oss-120b', 'groq', 'openai/gpt-oss-120b']
] as const;

export function canonicalGenerationTargets(config: MosaicConfig) {
	if (identityHash(config.generation.runtimeTargetIds) !== identityHash(TARGETS.map(([id]) => id))) {
		throw new Error('Canonical generation targets differ from the current runtime contract.');
	}
	return TARGETS.map(([id, provider, model]) => {
		const target = getGenerationTarget(config, id);
		if (target.provider !== provider || target.model !== model) throw new Error('Canonical generation target identity changed: ' + id);
		return { id, provider, model, options: structuredClone(target.options) };
	});
}

export async function prepareCanonicalSnapshot(config: MosaicConfig, profileId = 'full-40'): Promise<CanonicalSnapshot> {
	const corpus = await prepareCorpus(config);
	const bank = await loadQuestionBank(config, corpus);
	const profile = (await loadProfiles(config, bank)).find(p => p.profileId === profileId);
	if (!profile) throw new Error('Unknown canonical generation profile.');
	canonicalGenerationTargets(config);
	return createCanonicalSnapshot(bank, profile, corpus);
}

export async function verifyCanonicalSnapshot(config: MosaicConfig, value: unknown): Promise<CanonicalSnapshot> {
	const profileId = (value as Partial<CanonicalSnapshot> | null)?.profile?.profileId;
	if (typeof profileId !== 'string') throw new Error('Missing canonical snapshot profile identity.');
	const corpus = await prepareCorpus(config);
	const bank = await loadQuestionBank(config, corpus);
	const profile = (await loadProfiles(config, bank)).find(p => p.profileId === profileId);
	if (!profile) throw new Error('Unknown canonical generation profile.');
	return validateCanonicalSnapshot(value, bank, profile, corpus);
}

export function canonicalGenerationPlan(config: MosaicConfig, snapshot: CanonicalSnapshot) {
	const targets = canonicalGenerationTargets(config);
	const blockers = targets.filter(t => !credentialConfigured(config.credentials, getGenerationTarget(config, t.id).credentialSlot))
		.map(t => ({ targetId: t.id, reason: 'generation-credential-missing' }));
	return {
		mode: 'generation-only' as const, execution: 'not-started' as const,
		questionBank: snapshot.questionBank, profile: snapshot.profile, corpus: snapshot.corpus,
		snapshotHash: snapshot.hash, systemPromptHash: snapshot.systemPromptHash, schemaHash: snapshot.schemaHash,
		evidencePolicy: snapshot.evidencePolicy, targets, ready: blockers.length === 0, blockers,
		plannedEmbeddingCalls: 0, plannedGenerationCalls: snapshot.cases.length * targets.length,
		semanticReview: 'pending' as const
	};
}

export function canonicalArtifactRoot(config: MosaicConfig): string {
	return assertWithin(config.projectRoot, resolve(config.projectRoot, 'tmp/generation-only'), 'canonical evaluation artifacts');
}

export function canonicalSnapshotPath(config: MosaicConfig, filename: string): string {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(filename)) throw new Error('Use a plain canonical snapshot JSON filename.');
	const root = canonicalArtifactRoot(config);
	return assertWithin(root, resolve(root, 'snapshots', filename), 'canonical snapshot filename');
}

export async function writeCanonicalJson(path: string, value: unknown): Promise<void> {
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
}

export async function runCanonicalGeneration(
	config: MosaicConfig, value: unknown, gitHead: string,
	dependencies: { generationFactory?: GenerationProviderFactory; runId?: string } = {}
) {
	if (!/^[a-f0-9]{40}$/.test(gitHead)) throw new Error('An exact Git HEAD is required.');
	// Validate the entire bundle and both credentials before any provider is created or dispatched.
	const snapshot = await verifyCanonicalSnapshot(config, value);
	const executionConfig = structuredClone(config);
	const plan = canonicalGenerationPlan(executionConfig, snapshot);
	if (!plan.ready) throw new Error('Canonical generation is not ready: ' + plan.blockers.map(b => b.targetId).join(', '));
	const runId = dependencies.runId ?? randomUUID();
	if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(runId)) throw new Error('Invalid canonical run ID.');
	const root = canonicalArtifactRoot(config);
	const runs = assertWithin(root, resolve(root, 'runs'), 'canonical runs');
	const directory = assertWithin(runs, resolve(runs, runId), 'canonical run');
	await mkdir(runs, { recursive: true });
	await mkdir(directory); // No overwrite or automatic resume of a partial run.
	const manifestData = {
		schemaVersion: 1 as const, mode: 'generation-only' as const, runId, createdAt: new Date().toISOString(), gitHead,
		questionBank: snapshot.questionBank, profile: snapshot.profile, corpus: snapshot.corpus,
		snapshotHash: snapshot.hash, evidencePolicy: snapshot.evidencePolicy,
		systemPromptHash: snapshot.systemPromptHash, schemaHash: snapshot.schemaHash,
		targets: plan.targets, plannedGenerationCalls: plan.plannedGenerationCalls, plannedEmbeddingCalls: 0
	};
	const manifest = { ...manifestData, manifestHash: identityHash(manifestData) };
	let completedCases = 0, successfulResults = 0, failedResults = 0, generationAttempts = 0;
	try {
		await writeCanonicalJson(resolve(directory, 'manifest.json'), manifest);
		await writeCanonicalJson(resolve(directory, 'snapshot.json'), snapshot);
		for (const item of snapshot.cases) {
			const comparison = await compareFixedGenerationInputs(executionConfig, item, plan.targets.map(t => t.id), dependencies);
			if (!comparison.sharedInputVerified || comparison.promptHash !== item.promptHash
				|| comparison.results.some(r => r.evidenceHash !== item.evidenceHash)
				|| identityHash(canonicalGenerationTargets(executionConfig)) !== identityHash(plan.targets)) {
				throw new Error('Canonical generation input or target options changed.');
			}
			const artifact = {
				mode: 'generation-only', runId, manifestHash: manifest.manifestHash,
				questionBank: snapshot.questionBank, profile: snapshot.profile, corpus: snapshot.corpus,
				...comparison,
				results: comparison.results.map(result => ({
					...result, rawResponse: result.rawResponse ?? null,
					generated: result.generated ?? null, result: result.result ?? null,
					usage: result.metadata?.usage ?? null, finishReason: result.metadata?.finishReason ?? null,
					unavailableResponseReason: result.rawResponse ? null : (result.failureCategory ?? 'adapter-returned-no-response'),
					observations: {
						schemaValidity: result.validation.schema, citationValidity: result.validation.citations,
						requiredClaimCoverage: item.expectations.requiredClaims.map(claim => ({ claimId: claim.claimId, status: 'pending' })),
						forbiddenClaims: 'pending', unsupportedClaims: 'pending', unsupportedHandling: 'pending',
						falsePremiseCorrection: 'pending', partialSupport: 'pending',
						outputLanguage: 'pending', naming: 'pending', basis: 'pending',
						citationEvidenceAlignment: 'pending', speakerSeparation: 'pending', overinterpretation: 'pending'
					}
				}))
			};
			if (!/^QB\d{2}$/.test(item.caseId)) throw new Error('Unsafe canonical question ID.');
			await writeCanonicalJson(resolve(directory, 'results', item.caseId + '.json'), artifact);
			completedCases++;
			successfulResults += comparison.results.filter(r => r.status === 'success').length;
			failedResults += comparison.results.filter(r => r.status === 'failure').length;
			generationAttempts += comparison.results.reduce((sum, r) => sum + r.generationAttempts, 0);
		}
	} catch (error) {
		await writeCanonicalJson(resolve(directory, 'completion.json'), {
			status: 'aborted', runId, manifestHash: manifest.manifestHash,
			completedCases, successfulResults, failedResults, generationAttempts, finishedAt: new Date().toISOString()
		});
		throw error;
	}
	const completion = {
		status: failedResults ? 'completed-with-failures' : 'completed', runId, manifestHash: manifest.manifestHash,
		completedCases, successfulResults, failedResults, generationAttempts, finishedAt: new Date().toISOString()
	};
	await writeCanonicalJson(resolve(directory, 'completion.json'), completion);
	return { ...completion, directory: relative(config.projectRoot, directory).replaceAll('\\', '/') };
}
