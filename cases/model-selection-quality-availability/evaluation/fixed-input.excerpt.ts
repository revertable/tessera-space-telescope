import type { MosaicConfig } from '../../config.js';
import { credentialConfigured } from '../../credentials.js';
import { groundedResult } from '../../answering/answer.js';
import { answerSystemInstruction, answerResponseSchema, buildAnswerContents } from '../../generation/answer-prompt.js';
import { generateGroundedAnswerForTarget, type GeneratedAnswer } from '../../generation/orchestrator.js';
import { createGenerationProviderFactory, getGenerationTarget, type GenerationProviderFactory } from '../../generation/provider-factory.js';
import { GenerationProviderError, type GenerationMetadata, type GenerationResponse } from '../../generation/provider.js';
import { parseGenerationOptions } from '../../generation/target-options.js';
import { prepareCorpus } from '../../indexing/corpus.js';
import { getTargetIndexStatus } from '../../indexing/indexer.js';
import type { AnswerResult, Evidence } from '../../types.js';
import { generationComparisonProfiles } from './profiles.js';
import { getSnapshotEmbeddingTarget, identityHash, questionHash, validateRetrievalSnapshot, type RetrievalSnapshot, type SnapshotDependencies } from './snapshots.js';

export interface GenerationComparisonResult {
	snapshotHash: string;
	generation: { targetId: string; provider: string; model: string; options: object };
	status: 'success' | 'failure';
	generated?: GeneratedAnswer;
	result?: AnswerResult;
	/** Adapter-returned answer text, including malformed JSON; never transport headers or reasoning. */
	rawResponse?: GenerationResponse;
	failureCategory?: string;
	claimReview: 'pending';
	latencyMs: number;
	metadata?: GenerationMetadata;
	providerError?: { category: string; httpStatus?: number; code?: string | number };
	promptHash: string;
	evidenceHash: string;
	citationOrder: string[];
	generationAttempts: number;
	validation: { json: boolean | null; schema: boolean | null; citations: boolean | null };
}

function responseValidation(response?: GenerationResponse) {
	if (response?.content === undefined) return { json: null, schema: null, citations: null };
	try {
		const value = JSON.parse(response.content);
		const schema = value !== null && typeof value === 'object' && !Array.isArray(value)
			&& Object.keys(value).length === 3 && Object.keys(value).every((key) => ['basis', 'answer', 'citations'].includes(key))
			&& ['system', 'records', 'unsupported'].includes(value.basis) && typeof value.answer === 'string'
			&& Array.isArray(value.citations) && value.citations.every((id: unknown) => typeof id === 'string');
		return { json: true, schema: Boolean(schema), citations: null as boolean | null };
	} catch { return { json: false, schema: false, citations: null }; }
}

export interface FixedGenerationInput {
	caseId: string;
	question: string;
	questionHash?: string;
	hash: string;
	evidence: Evidence[];
}

/** Callers validate their own snapshot contract before entering this shared explicit runner. */
export async function compareFixedGenerationInputs(
	config: MosaicConfig, snapshot: FixedGenerationInput, targetIds: string[],
	dependencies: { generationFactory?: GenerationProviderFactory } = {}
) {
	if (!targetIds.length || new Set(targetIds).size !== targetIds.length) throw new Error('Select distinct generation targets.');
	for (const id of targetIds) getGenerationTarget(config, id);
	const factory = dependencies.generationFactory ?? createGenerationProviderFactory(config);
	const results: GenerationComparisonResult[] = [];
	for (const id of targetIds) {
		const target = getGenerationTarget(config, id);
		const evidence = structuredClone(snapshot.evidence);
		const promptHash = identityHash({ systemInstruction: answerSystemInstruction, contents: buildAnswerContents(snapshot.question, evidence), responseSchema: answerResponseSchema });
		const base = { snapshotHash: snapshot.hash, promptHash, evidenceHash: identityHash(evidence), citationOrder: evidence.map((item) => item.citationId), generation: { targetId: target.id, provider: target.provider, model: target.model, options: structuredClone(target.options) }, claimReview: 'pending' as const };
		let response: GenerationResponse | undefined;
		let generationAttempts = 0;
		const observedFactory: GenerationProviderFactory = (selected) => {
			const provider = factory(selected);
			return { generate: async (request) => {
				generationAttempts++;
				if (identityHash({ systemInstruction: request.systemInstruction, contents: request.contents, responseSchema: request.responseSchema }) !== promptHash) throw new Error('Comparison prompt mismatch.');
				return provider.generate(request);
			} };
		};
		const start = performance.now();
		try {
			if (!dependencies.generationFactory && !credentialConfigured(config.credentials, target.credentialSlot)) throw new GenerationProviderError('configuration', 'Generation credential is missing.');
			const generated = await generateGroundedAnswerForTarget(config, target.id, snapshot.question, evidence, observedFactory, { retryPolicy: 'none', onResponse: (value) => { response = value; } });
			const result = groundedResult(evidence, generated);
			results.push({ ...base, status: 'success', rawResponse: response, generated, result, metadata: response?.metadata, latencyMs: Math.round(performance.now() - start), generationAttempts, validation: { ...responseValidation(response), citations: result.status !== 'citation_error' } });
		} catch (error) {
			const failure = error instanceof GenerationProviderError ? error : error instanceof Error && error.cause instanceof GenerationProviderError ? error.cause : undefined;
			results.push({ ...base, status: 'failure', rawResponse: response, failureCategory: failure?.category ?? 'generation_error', metadata: response?.metadata ?? failure?.metadata, providerError: failure ? { category: failure.category, httpStatus: failure.providerStatus, code: failure.providerCode } : undefined, latencyMs: Math.round(performance.now() - start), generationAttempts, validation: responseValidation(response) });
		}
		if (identityHash(evidence) !== base.evidenceHash) throw new Error('Comparison evidence was mutated.');
	}
	return {
		schemaVersion: 1, snapshotHash: snapshot.hash, caseId: snapshot.caseId,
		question: snapshot.question, questionHash: questionHash(snapshot.question),
		promptHash: results[0]?.promptHash, systemPromptHash: identityHash(answerSystemInstruction), schemaHash: identityHash(answerResponseSchema),
		sharedInputVerified: results.every((result) => result.snapshotHash === snapshot.hash && result.promptHash === results[0]?.promptHash && result.evidenceHash === identityHash(snapshot.evidence) && identityHash(result.citationOrder) === identityHash(snapshot.evidence.map((item) => item.citationId))),
		results
	};
}
