import { describe, expect, it, vi } from 'vitest';

import type { MosaicConfig } from '../config.js';

import type { LocalCandidate } from './search.js';

import {
	mergeIntentCoverage,
	retrieveWithIntentCoverage,
	type RetrievalQueryRun
} from './intent-coverage.js';

function local(id: string, score: number, section = id, content = section): LocalCandidate {
	return {
		id,
		sourceId: 'project',
		title: 'Project',
		section,
		content,
		publicUrl: null,
		score
	};
}

	it('searches the Local index once per planned query', async () => {
		const queries = [
			{ id: 'original', kind: 'original' as const, text: 'whole' },
			{ id: 'intent-1', kind: 'derived-intent' as const, text: 'part' }
		];
		const searchCandidates = vi.fn(async (
			_config: MosaicConfig,
			question: string
		): Promise<LocalCandidate[]> => [local(question, 0.5)]);

		const result = await retrieveWithIntentCoverage({} as MosaicConfig, 'ignored', {
			planQueries: () => queries,
			searchCandidates
		});

		expect(searchCandidates.mock.calls.map((call) => call[1])).toEqual(['whole', 'part']);
		expect(result.queries).toEqual(queries);
	});
