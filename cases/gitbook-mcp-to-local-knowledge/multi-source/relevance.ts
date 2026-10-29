import type { MosaicConfig } from '../config.js';
import { embedQuestionAndDocuments } from '../embedding/embeddings.js';
import { createEmbeddingProviderFactory, type EmbeddingProviderFactory } from '../embedding/provider-factory.js';
import type { GitBookSearchHit } from '../knowledge/gitbook-search-results.js';
import type { LocalCandidate } from './search.js';
import { cosineSimilarity } from './similarity.js';
import type { SourceCandidateBatch } from './source-candidates.js';

export type RankedSourceCandidate =
	| {
		kind: 'local';
		knowledgeSourceId: string;
		relevanceScore: number;
		candidate: LocalCandidate;
	}
	| {
		kind: 'gitbook';
		knowledgeSourceId: string;
		relevanceScore: number;
		hit: GitBookSearchHit;
	};

export async function rankSourceCandidates(
	config: MosaicConfig,
	question: string,
	batches: SourceCandidateBatch[],
	providerFactory: EmbeddingProviderFactory = createEmbeddingProviderFactory(config)
): Promise<RankedSourceCandidate[]> {
	const ranked: RankedSourceCandidate[] = [];
	const gitbookEntries: Array<{ knowledgeSourceId: string; hit: GitBookSearchHit }> = [];

	for (const batch of batches) {
		if (batch.kind === 'local') {
			ranked.push(...batch.candidates.map((candidate) => ({
				kind: 'local' as const,
				knowledgeSourceId: batch.knowledgeSourceId,
				relevanceScore: candidate.score,
				candidate
			})));
		} else {
			gitbookEntries.push(...batch.hits.map((hit) => ({
				knowledgeSourceId: batch.knowledgeSourceId,
				hit
			})));
		}
	}

	if (gitbookEntries.length > 0) {
		const { queryVector, documentVectors } = await embedQuestionAndDocuments(
			config,
			question,
			gitbookEntries.map(({ hit }) => hit),
			providerFactory
		);
		ranked.push(...gitbookEntries.map(({ knowledgeSourceId, hit }, index) => ({
			kind: 'gitbook' as const,
			knowledgeSourceId,
			relevanceScore: cosineSimilarity(queryVector, documentVectors[index]),
			hit
		})));
	}

	return ranked.sort((left, right) => right.relevanceScore - left.relevanceScore);
}
