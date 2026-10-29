import type { MosaicConfig } from '../../config.js';
import type { LocalCandidate } from '../search.js';
import {
	mergeIntentCoverage,
	retrieveWithIntentCoverage,
	type CoverageCandidate,
	type IntentCoverageResult,
	type QueryCandidateObservation,
	type RetrievalQueryRun
} from '../intent-coverage.js';
import { bankIdentity, contentHash, profileQuestions, validateQuestionBank, type BankQuestion, type EvidenceGroup, type QuestionBank, type TestProfile } from './question-bank.js';
import { prepareCorpus, type PreparedCorpus } from '../../indexing/corpus.js';
import { getTargetIndexStatus } from '../../indexing/indexer.js';
import { credentialConfigured } from '../../credentials.js';
import type { RetrievalSnapshot } from './snapshots.js';
export interface ExpectedEvidence { sourceId?: string; section?: string; alternatives?: EvidenceGroup['alternatives'] }
export interface RelevanceEvaluationCase { id: string; question: string; expectation: { kind: 'supported'; intents: Array<{ id: string; expectedEvidence: ExpectedEvidence }> } | { kind: 'unsupported' } }
export function questionEvaluationCase(question: BankQuestion): RelevanceEvaluationCase {
 const groups = question.evidenceGroups.filter(g => g.purpose === 'claim');
 return { id: question.questionId, question: question.question, expectation: groups.length ? { kind: 'supported', intents: groups.map(g => ({ id:g.id, expectedEvidence: { alternatives:g.alternatives } })) } : { kind:'unsupported' } };
}

export interface ScoreDistribution {
	count: number;
	min: number | null;
	median: number | null;
	max: number | null;
}

export interface EvaluationCandidateReport {
	rank: number;
	chunkId: string;
	sourceId: string;
	title: string;
	section: string;
	relevanceScore: number;
	publicUrl: string | null;
	excerpt: string;
}

export interface EvaluationIntentReport {
	id: string;
	expectedEvidence: ExpectedEvidence;
	originalQueryRank: number | null;
	finalCoverageRank: number | null;
	coveredAt5: boolean;
	coveredAt10: boolean;
}

export interface EvaluationRetrievalQueryReport {
	id: string;
	kind: 'original' | 'derived-intent';
	text: string;
	candidateCount: number;
	scores: {
		all: ScoreDistribution;
		top5: number[];
	};
}

export interface EvaluationQueryMatchReport {
	retrievalQueryId: string;
	retrievalQueryKind: 'original' | 'derived-intent';
	retrievalQueryText: string;
	queryRank: number;
	relevanceScore: number;
	excerpt: string;
}

export interface EvaluationCoverageCandidateReport {
	finalCoverageRank: number;
	identity: string;
	chunkId: string;
	sourceId: string;
	title: string;
	section: string;
	publicUrl: string | null;
	excerpt: string;
	placement: {
		retrievalQueryId: string;
		queryRank: number;
		relevanceScore: number;
	};
	representative: {
		retrievalQueryId: string;
		queryRank: number;
		relevanceScore: number;
	};
	queryMatches: EvaluationQueryMatchReport[];
}

export type EvaluationExpectationReport =
	| {
		kind: 'supported';
		recallAt5: number;
		recallAt10: number;
		intents: EvaluationIntentReport[];
	}
	| {
		kind: 'unsupported';
	};

export interface RelevanceEvaluationCaseReport {
	id: string;
	question: string;
	candidateCount: number;
	coverageCandidateCount: number;
	scores: {
		all: ScoreDistribution;
		top5: number[];
	};
	retrievalQueries: EvaluationRetrievalQueryReport[];
	expectation: EvaluationExpectationReport;
	topCandidates: EvaluationCandidateReport[];
	coverageTopCandidates: EvaluationCoverageCandidateReport[];
}

export interface RelevanceEvaluationReport {
	observedAt: string;
	embedding: {
		targetId: string;
		provider: string;
		model: string;
		dimensions: number;
	};
	retrieval: { kind: 'local-index'; mode: 'intent-coverage-diagnostic' };
	questionBank: ReturnType<typeof bankIdentity>;
	profile: { profileId:string; profileVersion:string; profileHash:string };
	cases: RelevanceEvaluationCaseReport[];
}

function round(value: number): number {
	return Number(value.toFixed(6));
}

function scoreDistribution(values: number[]): ScoreDistribution {
	if (values.length === 0) return { count: 0, min: null, median: null, max: null };
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const median = sorted.length % 2 === 1
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2;
	return {
		count: sorted.length,
		min: round(sorted[0]),
		median: round(median),
		max: round(sorted[sorted.length - 1])
	};
}

function expectedEvidenceRank(ranked: LocalCandidate[], expected: ExpectedEvidence): number | null {
 if (!expected.alternatives) {
  const index=ranked.findIndex(c => c.sourceId === expected.sourceId && (expected.section === undefined || c.section === expected.section));
  return index < 0 ? null : index + 1;
 }
 const complete=expected.alternatives.flatMap(alternative => {
  const ranks=alternative.map(ref => { const i=ranked.findIndex(c => c.id===ref.chunkId && c.sourceId===ref.sourceId && c.section===ref.section && contentHash(c.content)===ref.canonicalContentHash); return i<0?null:i+1; });
  return ranks.every((r): r is number => r!==null) ? [Math.max(...ranks)] : [];
 });
 return complete.length ? Math.min(...complete) : null;
}
function expectedCoverageRank(ranked: CoverageCandidate[], expected: ExpectedEvidence): number | null {
 return expectedEvidenceRank(ranked.map(c => c.representative.candidate),expected);
}
function recallAt(ranks: Array<number | null>, cutoff: number): number {
	return round(ranks.filter((rank) => rank !== null && rank <= cutoff).length / ranks.length);
}

function excerpt(content: string): string {
	return content.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function candidateReport(candidate: LocalCandidate, index: number): EvaluationCandidateReport {
	return {
		rank: index + 1,
		chunkId: candidate.id,
		sourceId: candidate.sourceId,
		title: candidate.title,
		section: candidate.section,
		relevanceScore: round(candidate.score),
		publicUrl: candidate.publicUrl,
		excerpt: excerpt(candidate.content)
	};
}

function scoreReport(ranked: LocalCandidate[]): EvaluationRetrievalQueryReport['scores'] {
	return {
		all: scoreDistribution(ranked.map((candidate) => candidate.score)),
		top5: ranked.slice(0, 5).map((candidate) => round(candidate.score))
	};
}

function retrievalQueryReport(run: RetrievalQueryRun): EvaluationRetrievalQueryReport {
	return {
		...run.query,
		candidateCount: run.ranked.length,
		scores: scoreReport(run.ranked)
	};
}

function queryMatchReport(observation: QueryCandidateObservation): EvaluationQueryMatchReport {
	return {
		retrievalQueryId: observation.retrievalQueryId,
		retrievalQueryKind: observation.retrievalQueryKind,
		retrievalQueryText: observation.retrievalQueryText,
		queryRank: observation.queryRank,
		relevanceScore: round(observation.relevanceScore),
		excerpt: excerpt(observation.candidate.content)
	};
}

function coverageCandidateReport(candidate: CoverageCandidate): EvaluationCoverageCandidateReport {
	const representative = candidate.representative.candidate;
	return {
		finalCoverageRank: candidate.finalCoverageRank,
		identity: candidate.identity,
		chunkId: representative.id,
		sourceId: representative.sourceId,
		title: representative.title,
		section: representative.section,
		publicUrl: representative.publicUrl,
		excerpt: excerpt(representative.content),
		placement: {
			retrievalQueryId: candidate.placement.retrievalQueryId,
			queryRank: candidate.placement.queryRank,
			relevanceScore: round(candidate.placement.relevanceScore)
		},
		representative: {
			retrievalQueryId: candidate.representative.retrievalQueryId,
			queryRank: candidate.representative.queryRank,
			relevanceScore: round(candidate.representative.relevanceScore)
		},
		queryMatches: candidate.observations.map(queryMatchReport)
	};
}

export function evaluateIntentCoverageCase(
	evaluationCase: RelevanceEvaluationCase,
	coverage: IntentCoverageResult
): RelevanceEvaluationCaseReport {
	const originalRun = coverage.runs.find(({ query }) => query.kind === 'original') ?? coverage.runs[0];
	const originalRanked = originalRun?.ranked ?? [];
	let expectation: EvaluationExpectationReport;
	if (evaluationCase.expectation.kind === 'unsupported') {
		expectation = { kind: 'unsupported' };
	} else {
		if (evaluationCase.expectation.intents.length === 0) {
			throw new Error(`Supported evaluation case ${evaluationCase.id} must define at least one intent.`);
		}
		const intents = evaluationCase.expectation.intents.map((intent) => {
			const originalQueryRank = expectedEvidenceRank(originalRanked, intent.expectedEvidence);
			const finalCoverageRank = expectedCoverageRank(coverage.candidates, intent.expectedEvidence);
			return {
				id: intent.id,
				expectedEvidence: intent.expectedEvidence,
				originalQueryRank,
				finalCoverageRank,
				coveredAt5: finalCoverageRank !== null && finalCoverageRank <= 5,
				coveredAt10: finalCoverageRank !== null && finalCoverageRank <= 10
			};
		});
		expectation = {
			kind: 'supported',
			recallAt5: recallAt(intents.map(({ finalCoverageRank }) => finalCoverageRank), 5),
			recallAt10: recallAt(intents.map(({ finalCoverageRank }) => finalCoverageRank), 10),
			intents
		};
	}
	return {
		id: evaluationCase.id,
		question: evaluationCase.question,
		candidateCount: originalRanked.length,
		coverageCandidateCount: coverage.candidates.length,
		scores: scoreReport(originalRanked),
		retrievalQueries: coverage.runs.map(retrievalQueryReport),
		expectation,
		topCandidates: originalRanked.slice(0, 10).map(candidateReport),
		coverageTopCandidates: coverage.candidates.slice(0, 10).map(coverageCandidateReport)
	};
}

export function evaluateRankedCase(
	evaluationCase: RelevanceEvaluationCase,
	ranked: LocalCandidate[]
): RelevanceEvaluationCaseReport {
	const query = { id: 'original', kind: 'original' as const, text: evaluationCase.question };
	const runs = [{ query, ranked }];
	return evaluateIntentCoverageCase(evaluationCase, {
		queries: [query],
		runs,
		candidates: mergeIntentCoverage(runs)
	});
}

export function evaluateSnapshotQuestion(question: BankQuestion, snapshot: RetrievalSnapshot) {
 if (question.questionId!==snapshot.caseId || question.question!==snapshot.question) throw new Error('Question/snapshot mismatch.');
 const expected = questionEvaluationCase(question);
 const report = evaluateRankedCase(expected,snapshot.ranked);
 const selected=snapshot.evidence.map(e => snapshot.ranked.find(c => c.id===e.id)!);
 const groups=question.evidenceGroups.filter(g => g.purpose==='claim');
 return { ...report, mode:'production-direct' as const, selectedEvidence:snapshot.evidence,
  selectedGroupCoverage:groups.map(g => ({ id:g.id,covered:expectedEvidenceRank(selected,{alternatives:g.alternatives})!==null })),
  missingExpectedEvidence:groups.filter(g => expectedEvidenceRank(selected,{alternatives:g.alternatives})===null).map(g => g.id) };
}
export async function runRelevanceEvaluation(config: MosaicConfig, bank: QuestionBank, profile: TestProfile, targetId: string,
 dependencies: { retrieve?:typeof retrieveWithIntentCoverage; getStatus?:typeof getTargetIndexStatus; corpus?:PreparedCorpus } = {}): Promise<RelevanceEvaluationReport> {
 const questions=profileQuestions(bank,profile);
 const target=config.embedding.targets.find(t => t.id===targetId);
 if (!target) throw new Error('Unknown diagnostic target.');
 const corpus=dependencies.corpus ?? await prepareCorpus(config);
 validateQuestionBank(bank,corpus);
 if(corpus.corpusFingerprint!==bank.corpusFingerprint) throw new Error('Diagnostic corpus mismatch.');
 const status=await (dependencies.getStatus ?? getTargetIndexStatus)(config,target,corpus);
 if(status.state!=='current' || !credentialConfigured(config.credentials,target.credentialSlot)) throw new Error('Selected diagnostic target is not ready.');
 const selectedConfig={...config,embedding:{...config.embedding,runtimeTargets:[target]}};
 const reports:RelevanceEvaluationCaseReport[]=[];
 for(const question of questions){
  const coverage=await (dependencies.retrieve ?? retrieveWithIntentCoverage)(selectedConfig,question.question);
  if(coverage.embeddingTarget && coverage.embeddingTarget.id!==target.id) throw new Error('Diagnostic target changed.');
  reports.push(evaluateIntentCoverageCase(questionEvaluationCase(question),coverage));
 }
 return { observedAt:new Date().toISOString(), embedding:{targetId:target.id,provider:target.provider,model:target.model,dimensions:target.dimensions},
 retrieval:{kind:'local-index',mode:'intent-coverage-diagnostic'}, questionBank:bankIdentity(bank),
 profile:{profileId:profile.profileId,profileVersion:profile.profileVersion,profileHash:profile.profileHash},cases:reports };
}
