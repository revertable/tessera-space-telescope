import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config.js';
import { prepareCorpus, type PreparedCorpus } from '../../indexing/corpus.js';
import { buildAnswerContents } from '../../generation/answer-prompt.js';
import { loadQuestionBank, loadProfiles, questionBankHash, type QuestionBank, type TestProfile } from './question-bank.js';
import { createCanonicalSnapshot, validateCanonicalSnapshot, type CanonicalSnapshot } from './canonical-snapshots.js';
import { identityHash } from './snapshots.js';

let corpus: PreparedCorpus, bank: QuestionBank, profile: TestProfile, snapshot: CanonicalSnapshot;
beforeAll(async () => {
	const config = loadConfig();
	corpus = await prepareCorpus(config);
	bank = await loadQuestionBank(config, corpus);
	profile = (await loadProfiles(config, bank)).find(p => p.profileId === 'full-40')!;
	snapshot = createCanonicalSnapshot(bank, profile, corpus);
});
beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden')); });
afterEach(() => { try { expect(globalThis.fetch).not.toHaveBeenCalled(); } finally { vi.restoreAllMocks(); } });

function editedBank(edit: (copy: QuestionBank) => void) {
	const copy = structuredClone(bank); edit(copy); copy.questionBankHash = questionBankHash(copy);
	// Rebind the profile identity so the tested failure is in the evidence, not stale membership.
	const rebound = { ...profile, questionBankHash: copy.questionBankHash };
	return { copy, rebound };
}

describe('canonical QB evidence snapshots', () => {
	it('reproduces all 40 ordered inputs and validates every group against full current chunks', () => {
		expect(snapshot.corpus).toMatchObject({ sourceCount: 27, chunkCount: 372 });
		expect(snapshot.cases.map(c => c.caseId)).toEqual(profile.questionIds);
		expect(snapshot.cases.flatMap(c => c.bindings)).toHaveLength(47);
		expect(createCanonicalSnapshot(bank, profile, corpus)).toEqual(snapshot);
		expect(validateCanonicalSnapshot(JSON.parse(JSON.stringify(snapshot)), bank, profile, corpus)).toEqual(snapshot);
		for (const item of snapshot.cases) {
			for (const [index, record] of item.evidence.entries()) {
				const chunk = corpus.chunks.find(c => c.id === record.id)!;
				expect(record).toMatchObject(chunk);
				expect(record.citationId).toBe(`S${index + 1}`);
				expect(record.score).toBe(0);
			}
			const input = JSON.parse(buildAnswerContents(item.question, item.evidence));
			expect(Object.keys(input)).toEqual(['question', 'records']);
			expect(input.records).toEqual(item.evidence.map(r => ({ id: r.citationId, title: r.title, section: r.section, content: r.content })));
			expect(item.semanticReview).toBe('pending');
		}
	});

	it('preserves empty, related-only, partial and premise-correcting evidence without adding records', () => {
		for (const id of ['QB23', 'QB24', 'QB40']) {
			const item = snapshot.cases.find(c => c.caseId === id)!;
			expect(item.evidence).toEqual([]);
			expect(item.expectations.expectedBasis.corpus).toBe('unsupported');
		}
		for (const id of ['QB08', 'QB16', 'QB28', 'QB31', 'QB32']) {
			const item = snapshot.cases.find(c => c.caseId === id)!;
			expect(item.bindings.every(g => g.purpose === 'related')).toBe(true);
			expect(item.evidence.length).toBeGreaterThan(0);
			expect(item.expectations.requiredClaims).toEqual([]);
		}
		const partial = snapshot.cases.find(c => c.caseId === 'QB12')!;
		expect(partial.expectations.answerability).toBe('partially-supported');
		expect(partial.expectations.unverifiableClaims.length).toBeGreaterThan(0);
		expect(partial.evidence.map(e => e.id)).toEqual(['synethos-overview:0015']);
		for (const id of ['QB25', 'QB26', 'QB27']) {
			const item = snapshot.cases.find(c => c.caseId === id)!;
			expect(item.expectations.answerability).toBe('false-premise');
			expect(item.bindings.every(g => g.purpose === 'claim')).toBe(true);
		}
	});

	it('deduplicates a chunk across claim groups while retaining both bindings', async () => {
		const { copy, rebound } = editedBank(b => {
			const q = b.questions[0], group = structuredClone(q.evidenceGroups[0]);
			group.id = 'shared'; q.evidenceGroups.push(group);
			q.requiredClaims[0].evidenceGroupIds.push('shared');
		});
		const { profileHash } = await import('./question-bank.js'); rebound.profileHash = profileHash(rebound);
		const item = createCanonicalSnapshot(copy, rebound, corpus).cases[0];
		expect(item.evidence).toHaveLength(1);
		expect(item.bindings).toHaveLength(2);
		expect(item.bindings.map(g => g.refs[0].citationId)).toEqual(['S1', 'S1']);
	});

	it('refuses ambiguous alternatives instead of selecting the first', async () => {
		const { copy, rebound } = editedBank(b => {
			const group = b.questions[0].evidenceGroups[0]; group.alternatives.push(structuredClone(group.alternatives[0]));
		});
		const { profileHash } = await import('./question-bank.js'); rebound.profileHash = profileHash(rebound);
		expect(() => createCanonicalSnapshot(copy, rebound, corpus)).toThrow('ambiguous: QB01/e1');
	});

	it.each(['chunkId', 'sourceId', 'section', 'canonicalContentHash', 'quote'] as const)('rejects invalid QB reference %s', key => {
		const { copy, rebound } = editedBank(b => { b.questions[0].evidenceGroups[0].alternatives[0][0][key] = 'missing'; });
		expect(() => createCanonicalSnapshot(copy, rebound, corpus)).toThrow('evidence');
	});

	it('exposes a missing supporting group before snapshot generation', () => {
		const { copy, rebound } = editedBank(b => { b.questions[0].requiredClaims[0].evidenceGroupIds = ['missing']; });
		expect(() => createCanonicalSnapshot(copy, rebound, corpus)).toThrow('group');
	});

	it.each(['corpus', 'profile', 'question', 'record', 'order', 'citation', 'prompt', 'expectation'])('rejects rehashed %s drift', kind => {
		const copy = structuredClone(snapshot), item = copy.cases.find(c => c.caseId === 'QB10')!;
		if (kind === 'corpus') copy.corpus.fingerprint = 'changed';
		if (kind === 'profile') copy.profile.profileHash = 'changed';
		if (kind === 'question') item.question += ' changed';
		if (kind === 'record') item.evidence[0].content += ' changed';
		if (kind === 'order') item.evidence.reverse();
		if (kind === 'citation') item.evidence[0].citationId = 'S99';
		if (kind === 'prompt') copy.systemPromptHash = 'changed';
		if (kind === 'expectation') item.expectations.requiredClaims[0].text += ' changed';
		for (const c of copy.cases) { const { hash: _hash, ...data } = c; c.hash = identityHash(data); }
		const { hash: _hash, ...data } = copy; copy.hash = identityHash(data);
		expect(() => validateCanonicalSnapshot(copy, bank, profile, corpus)).toThrow('Canonical snapshot');
	});
});
