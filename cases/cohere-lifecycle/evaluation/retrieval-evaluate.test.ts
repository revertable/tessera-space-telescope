import { describe, expect, it } from 'vitest';
import type { LocalCandidate } from '../search.js';
import { mergeIntentCoverage, type IntentCoverageResult } from '../intent-coverage.js';
import type { RelevanceEvaluationCase } from './evaluate.js';
import { evaluateIntentCoverageCase, evaluateRankedCase } from './evaluate.js';

function local(
	id: string,
	score: number,
	sourceId = 'project',
	section = 'Section',
	publicUrl: string | null = null
): LocalCandidate {
	return {
		id,
		sourceId,
		title: 'Document',
		section,
		content: `# ${section}\n\n${id} content`,
		publicUrl,
		score
	};
}

describe('Local relevance evaluation', () => {
	it('reports Local scores and matches section-specific expected evidence', () => {
		const evaluationCase: RelevanceEvaluationCase = {
			id: 'local-section',
			question: 'question',
			expectation: {
				kind: 'supported',
				intents: [{
					id: 'section',
					expectedEvidence: { sourceId: 'expected', section: 'Target' }
				}]
			}
		};
		const report = evaluateRankedCase(evaluationCase, [
			local('other:0001', 0.8),
			local('expected:0001', 0.6, 'expected', 'Target', 'https://example.com/page')
		]);

		expect(report.expectation).toMatchObject({
			kind: 'supported',
			recallAt5: 1,
			intents: [{ originalQueryRank: 2, finalCoverageRank: 2 }]
		});
		expect(report.scores).toEqual({
			all: { count: 2, min: 0.6, median: 0.7, max: 0.8 },
			top5: [0.8, 0.6]
		});
		expect(report.topCandidates[1]).toMatchObject({
			chunkId: 'expected:0001',
			sourceId: 'expected',
			section: 'Target',
			relevanceScore: 0.6,
			publicUrl: 'https://example.com/page'
		});
	});

	it('matches former page-level expectations by Local source id and uses coverage rank', () => {
		const evaluationCase: RelevanceEvaluationCase = {
			id: 'local-document',
			question: 'whole question',
			expectation: {
				kind: 'supported',
				intents: [{
					id: 'document',
					expectedEvidence: { sourceId: 'cosmic-horizon-kr-page' }
				}]
			}
		};
		const runs = [
			{
				query: { id: 'original', kind: 'original' as const, text: 'whole question' },
				ranked: [
					local('other:0001', 0.9),
					local('cosmic-horizon-kr-page:0001', 0.4, 'cosmic-horizon-kr-page', 'First')
				]
			},
			{
				query: { id: 'intent-1', kind: 'derived-intent' as const, text: 'page intent' },
				ranked: [
					local('cosmic-horizon-kr-page:0002', 0.95, 'cosmic-horizon-kr-page', 'Second'),
					local('other:0001', 0.3)
				]
			}
		];
		const coverage: IntentCoverageResult = {
			queries: runs.map(({ query }) => query),
			runs,
			candidates: mergeIntentCoverage(runs)
		};
		const report = evaluateIntentCoverageCase(evaluationCase, coverage);

		expect(report.expectation).toMatchObject({
			kind: 'supported',
			intents: [{ originalQueryRank: 2, finalCoverageRank: 1 }]
		});
		expect(report.coverageTopCandidates[0]).toMatchObject({
			identity: 'local:cosmic-horizon-kr-page:0002',
			sourceId: 'cosmic-horizon-kr-page',
			placement: { retrievalQueryId: 'intent-1', queryRank: 1, relevanceScore: 0.95 }
		});
	});

	it('keeps unsupported cases observational', () => {
		const report = evaluateRankedCase({
			id: 'unsupported',
			question: 'unknown',
			expectation: { kind: 'unsupported' }
		}, [local('related:0001', 0.8)]);

		expect(report.expectation).toEqual({ kind: 'unsupported' });
		expect(report.topCandidates).toHaveLength(1);
	});
});
import { contentHash } from './question-bank.js';
describe('alternative evidence group recall',()=>{
 it('counts OR alternatives once and requires every AND member at its worst rank',()=>{
  const a=local('a',0.9,'en','A'), b=local('b',0.8,'kr','B'), c=local('c',0.7,'kr','C');
  const ref=(x:LocalCandidate)=>({sourceId:x.sourceId,section:x.section,chunkId:x.id,canonicalContentHash:contentHash(x.content),quote:x.content});
  const item:RelevanceEvaluationCase={id:'synthetic',question:'synthetic compound',expectation:{kind:'supported',intents:[{id:'g',expectedEvidence:{alternatives:[[ref(a)],[ref(b),ref(c)]]}}]}};
  const or=evaluateRankedCase(item,[a,b,c]);expect(or.expectation).toMatchObject({recallAt5:1,intents:[{originalQueryRank:1}]});
  const and=evaluateRankedCase(item,[b,c]);expect(and.expectation).toMatchObject({intents:[{originalQueryRank:2}]});
  const incomplete=evaluateRankedCase(item,[b]);expect(incomplete.expectation).toMatchObject({recallAt5:0,intents:[{originalQueryRank:null}]});
  const changed=evaluateRankedCase(item,[{...a,content:'changed'}]);expect(changed.expectation).toMatchObject({recallAt5:0});
 });
});

import { loadConfig } from '../../config.js';
import { prepareCorpus } from '../../indexing/corpus.js';
import { getTargetIndexStatus } from '../../indexing/indexer.js';
import { loadQuestionBank, loadProfiles } from './question-bank.js';
import { evaluateSnapshotQuestion, runRelevanceEvaluation } from './evaluate.js';
import { identityHash, questionHash } from './snapshots.js';
import { vi } from 'vitest';
describe('shared bank diagnostic regression and direct observation separation',()=>{
 it('uses profile questions and one explicit target while preserving original/intent recall without live queries',async()=>{
  const config=loadConfig(),corpus=await prepareCorpus(config),bank=await loadQuestionBank(config,corpus);
  const profile=(await loadProfiles(config,bank)).find(p=>p.profileId==='retrieval-compound-5')!;
  const target=config.embedding.targets[0];config.credentials={[target.credentialSlot]:'mock'};
  const retrieve=vi.fn(async()=>({queries:[],runs:[],candidates:[],embeddingTarget:target}));
  const report=await runRelevanceEvaluation(config,bank,profile,target.id,{corpus,retrieve});
  expect(report.retrieval.mode).toBe('intent-coverage-diagnostic');expect(report.cases.map(c=>c.id)).toEqual(profile.questionIds);
  expect(retrieve.mock.calls).toHaveLength(5);
  const fail=vi.fn(async()=>({queries:[],runs:[],candidates:[]}));
  await expect(runRelevanceEvaluation(config,bank,profile,config.embedding.targets[1].id,{corpus,retrieve:fail})).rejects.toThrow('not ready');
  expect(fail).not.toHaveBeenCalled();
 });
 it('keeps selected/missing direct evidence separate from diagnostic merged coverage',async()=>{
  const config=loadConfig(),corpus=await prepareCorpus(config),bank=await loadQuestionBank(config,corpus),q=bank.questions[0];
  const target=config.embedding.targets[0],status=await getTargetIndexStatus(config,target,corpus);
  const data={schemaVersion:1 as const,corpusFingerprint:corpus.corpusFingerprint,indexFingerprint:status.fingerprint,
   embeddingTarget:{id:target.id,provider:target.provider,model:target.model,dimensions:target.dimensions},
   caseId:q.questionId,question:q.question,questionHash:questionHash(q.question),selection:{minimumScore:0.25,topK:5},
   ranked:corpus.chunks.map(c=>({...c,score:0})),evidence:[]};
  const report=evaluateSnapshotQuestion(q,{...data,hash:identityHash(data)});
  expect(report.mode).toBe('production-direct');expect(report.missingExpectedEvidence).toEqual(['e1']);
  expect(report.selectedGroupCoverage).toEqual([{id:'e1',covered:false}]);
 });
});
