import type { MosaicConfig } from '../config.js';
import { parseGitBookSearchResults, type GitBookSearchHit } from '../knowledge/gitbook-search-results.js';
import { GitBookMcpKnowledgeSource } from '../knowledge/gitbook-mcp-source.js';
import { LocalKnowledgeSource } from '../knowledge/local-source.js';
import {
	createKnowledgeSource,
	type KnowledgeSourceFactoryDependencies
} from '../knowledge/source-factory.js';
import type { LocalCandidate } from './search.js';

export type SourceCandidateBatch =
	| {
		kind: 'local';
		knowledgeSourceId: string;
		candidates: LocalCandidate[];
	}
	| {
		kind: 'gitbook';
		knowledgeSourceId: string;
		hits: GitBookSearchHit[];
	};

export async function collectSourceCandidates(
	config: MosaicConfig,
	question: string,
	dependencies: KnowledgeSourceFactoryDependencies = {}
): Promise<SourceCandidateBatch[]> {
	const batches: SourceCandidateBatch[] = [];

	for (const settings of config.knowledge.sources) {
		if (!settings.enabled) continue;
		const source = createKnowledgeSource(settings, config, dependencies);

		if (source instanceof LocalKnowledgeSource) {
			batches.push({
				kind: 'local',
				knowledgeSourceId: source.id,
				candidates: await source.search(question)
			});
			continue;
		}

		if (source instanceof GitBookMcpKnowledgeSource) {
			try {
				const parsed = parseGitBookSearchResults(await source.search(question), source.endpoint);
				batches.push({
					kind: 'gitbook',
					knowledgeSourceId: source.id,
					hits: parsed.hits
				});
			} finally {
				await source.close();
			}
		}
	}

	return batches;
}
