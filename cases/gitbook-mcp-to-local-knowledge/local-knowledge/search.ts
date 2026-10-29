import type { MosaicConfig } from '../config.js';
import { embedQuestion } from '../embedding/embeddings.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from '../embedding/provider-factory.js';
import type { EmbeddingTarget } from '../embedding/provider.js';
import { NoReachableEmbeddingTargetError, runEmbeddingTargetFallback } from '../embedding/target-fallback.js';
import { prepareCorpus, targetIndexFingerprint, type PreparedCorpus } from '../indexing/corpus.js';
import { getTargetIndexStatus } from '../indexing/indexer.js';
import { indexExists, readIndex } from '../indexing/store.js';
import type { Evidence, IndexedChunk, KnowledgeChunk } from '../types.js';
import { cosineSimilarity } from './similarity.js';

export interface LocalCandidate extends KnowledgeChunk {
	score: number;
}

export class StaleIndexError extends Error {
	constructor() {
		super('The knowledge index is missing or stale. Run the index build command.');
		this.name = 'StaleIndexError';
	}
}

export class InvalidIndexError extends Error {
	constructor(public readonly targetId: string, reason: string) {
		super(`The knowledge index for ${targetId} is not usable: ${reason}.`);
		this.name = 'InvalidIndexError';
	}
}

export function validateQuestion(input: unknown): string {
	if (typeof input !== 'string') throw new Error('Question must be a string.');
	const question = input.trim();
	if (question.length < 2 || question.length > 1000) throw new Error('Question must be between 2 and 1000 characters.');
	return question;
}

export function rankLocalCandidates(chunks: IndexedChunk[], queryVector: number[]): LocalCandidate[] {
	return chunks
		.map(({ vector, ...chunk }) => ({ ...chunk, score: cosineSimilarity(queryVector, vector) }))
		.sort((left, right) => right.score - left.score);
}

export function filterLocalCandidates(candidates: LocalCandidate[], minimumScore: number): LocalCandidate[] {
	return candidates.filter(({ score }) => score >= minimumScore);
}

export async function searchLocalCandidatesForTarget(
	config: MosaicConfig,
	target: EmbeddingTarget,
	question: string,
	prepared?: PreparedCorpus,
	providerFactory: EmbeddingProviderFactory = createEmbeddingProviderFactory(config)
): Promise<LocalCandidate[]> {
	const corpus = prepared ?? await prepareCorpus(config);
	if (corpus.chunks.length === 0) return [];
	const fingerprint = targetIndexFingerprint(corpus.corpusFingerprint, target);
	if (!(await indexExists(config, target, fingerprint))) throw new StaleIndexError();
	const index = await readIndex(config, target, fingerprint);
	const queryVector = await embedQuestion(config, target, question, providerFactory);
	if (queryVector.length !== index.vectorDimension) throw new InvalidIndexError(target.id, 'dimension mismatch');
	return rankLocalCandidates(index.chunks, queryVector);
}

export interface QueryBundleResult {
	target: EmbeddingTarget;
	ranked: LocalCandidate[][];
}

export async function searchLocalCandidateBundle(
	config: MosaicConfig,
	questions: string[],
	providerFactory: EmbeddingProviderFactory = createEmbeddingProviderFactory(config)
): Promise<QueryBundleResult> {
	const corpus = await prepareCorpus(config);
	if (corpus.chunks.length === 0) return { target: config.embedding.targets[0], ranked: questions.map(() => []) };
	const statuses = [];
	for (const target of config.embedding.targets) {
		statuses.push(await getTargetIndexStatus(config, target, corpus));
	}
	try {
		const result = await runEmbeddingTargetFallback(statuses, config.credentials, async (target) => {
			const ranked: LocalCandidate[][] = [];
			for (const question of questions) {
				ranked.push(await searchLocalCandidatesForTarget(config, target, question, corpus, providerFactory));
			}
			return ranked;
		});
		return { target: result.target, ranked: result.value };
	} catch (error) {
		if (error instanceof NoReachableEmbeddingTargetError) throw new StaleIndexError();
		throw error;
	}
}

export async function searchLocalCandidates(config: MosaicConfig, question: string): Promise<LocalCandidate[]> {
	return (await searchLocalCandidateBundle(config, [question])).ranked[0];
}

export function selectLocalEvidence(candidates: LocalCandidate[], topK: number): Evidence[] {
	return candidates
		.slice(0, topK)
		.map((candidate, position) => ({
			id: candidate.id,
			sourceId: candidate.sourceId,
			title: candidate.title,
			section: candidate.section,
			content: candidate.content,
			publicUrl: candidate.publicUrl,
			citationId: `S${position + 1}`,
			score: candidate.score,
			excerpt: candidate.content.replace(/^# .+\n+/, '').slice(0, 360)
		}));
}

export async function searchKnowledge(config: MosaicConfig, question: string): Promise<Evidence[]> {
	const candidates = await searchLocalCandidates(config, question);
	return selectLocalEvidence(
		filterLocalCandidates(candidates, config.retrieval.minimumScore),
		config.retrieval.topK
	);
}
