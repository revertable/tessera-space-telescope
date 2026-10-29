import type { PreparedCorpus } from '../../indexing/corpus.js';
import type { Evidence } from '../../types.js';
import { answerSystemInstruction, answerResponseSchema, buildAnswerContents } from '../../generation/answer-prompt.js';
import {
	bankIdentity, profileQuestions, validateQuestionBank, contentHash,
	type BankIdentity, type BankQuestion, type EvidenceReference, type QuestionBank, type TestProfile
} from './question-bank.js';
import { identityHash, questionHash } from './snapshots.js';

export const CANONICAL_EVIDENCE_POLICY = 'qb-single-alternative-full-chunk-v1' as const;
export interface CanonicalCase {
	caseId: string;
	question: string;
	questionHash: string;
	evidence: Evidence[];
	bindings: Array<{ groupId: string; purpose: 'claim' | 'related'; refs: Array<EvidenceReference & { citationId: string }> }>;
	expectations: Pick<BankQuestion, 'answerability' | 'expectedBasis' | 'requiredClaims' | 'forbiddenClaims' |
		'unverifiableClaims' | 'absenceAudit' | 'namingContract' | 'expectedAnswerLanguage'>;
	semanticReview: 'pending';
	evidenceHash: string;
	promptHash: string;
	hash: string;
}
export interface CanonicalSnapshot {
	schemaVersion: 1;
	mode: 'generation-only';
	evidencePolicy: typeof CANONICAL_EVIDENCE_POLICY;
	questionBank: BankIdentity;
	profile: { profileId: string; profileVersion: string; profileHash: string; questionIds: string[] };
	corpus: { fingerprint: string; sourceCount: number; chunkCount: number };
	systemPromptHash: string;
	schemaHash: string;
	cases: CanonicalCase[];
	hash: string;
}

export function createCanonicalSnapshot(bank: QuestionBank, profile: TestProfile, corpus: PreparedCorpus): CanonicalSnapshot {
	validateQuestionBank(bank, corpus);
	const questions = profileQuestions(bank, profile);
	const chunks = new Map(corpus.chunks.map(chunk => [chunk.id, chunk]));
	const cases = questions.map(question => {
		const evidence: Evidence[] = [];
		const citations = new Map<string, string>();
		const bindings = question.evidenceGroups.map(group => {
			if (group.alternatives.length !== 1) {
				throw new Error(`Canonical evidence selection is ambiguous: ${question.questionId}/${group.id}.`);
			}
			const refs = group.alternatives[0].map(ref => {
				const chunk = chunks.get(ref.chunkId);
				if (!chunk || chunk.sourceId !== ref.sourceId || chunk.section !== ref.section
					|| contentHash(chunk.content) !== ref.canonicalContentHash || !chunk.content.includes(ref.quote)) {
					throw new Error(`Canonical evidence mismatch: ${question.questionId}/${group.id}.`);
				}
				let citationId = citations.get(chunk.id);
				if (!citationId) {
					citationId = `S${evidence.length + 1}`;
					citations.set(chunk.id, citationId);
					// Zero is an unranked adapter sentinel, not a similarity or confidence score.
					evidence.push({ ...structuredClone(chunk), citationId, score: 0, excerpt: chunk.content.slice(0, 360) });
				}
				return { ...structuredClone(ref), citationId };
			});
			return { groupId: group.id, purpose: group.purpose, refs };
		});
		for (const claim of question.requiredClaims) {
			if (!claim.evidenceGroupIds.every(id => bindings.some(group => group.groupId === id && group.purpose === 'claim' && group.refs.length))) {
				throw new Error(`Canonical claim evidence is incomplete: ${question.questionId}/${claim.claimId}.`);
			}
		}
		const { answerability, expectedBasis, requiredClaims, forbiddenClaims, unverifiableClaims, absenceAudit, namingContract, expectedAnswerLanguage } = question;
		const data = {
			caseId: question.questionId, question: question.question, questionHash: questionHash(question.question),
			evidence, bindings,
			expectations: structuredClone({ answerability, expectedBasis, requiredClaims, forbiddenClaims, unverifiableClaims, absenceAudit, namingContract, expectedAnswerLanguage }),
			semanticReview: 'pending' as const,
			evidenceHash: identityHash(evidence),
			promptHash: identityHash({ systemInstruction: answerSystemInstruction, contents: buildAnswerContents(question.question, evidence), responseSchema: answerResponseSchema })
		};
		return { ...data, hash: identityHash(data) };
	});
	const data = {
		schemaVersion: 1 as const, mode: 'generation-only' as const, evidencePolicy: CANONICAL_EVIDENCE_POLICY,
		questionBank: bankIdentity(bank),
		profile: { profileId: profile.profileId, profileVersion: profile.profileVersion, profileHash: profile.profileHash, questionIds: [...profile.questionIds] },
		corpus: { fingerprint: corpus.corpusFingerprint, sourceCount: Object.keys(corpus.documentHashes).length, chunkCount: corpus.chunks.length },
		systemPromptHash: identityHash(answerSystemInstruction), schemaHash: identityHash(answerResponseSchema), cases
	};
	return { ...data, hash: identityHash(data) };
}

/** Rebuild the expected input from the current approved records, not from caller-supplied hashes. */
export function validateCanonicalSnapshot(value: unknown, bank: QuestionBank, profile: TestProfile, corpus: PreparedCorpus): CanonicalSnapshot {
	const expected = createCanonicalSnapshot(bank, profile, corpus);
	if (identityHash(value) !== identityHash(expected)) throw new Error('Canonical snapshot differs from current QB/profile/corpus/prompt or evidence order.');
	return expected;
}
