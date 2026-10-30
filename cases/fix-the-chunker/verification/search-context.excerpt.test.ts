import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MosaicConfig } from '../config.js';
import { chunkSource } from '../knowledge/chunker.js';
import { embedQuestion } from '../embedding/embeddings.js';
import { prepareCorpus } from '../indexing/corpus.js';
import { getTargetIndexStatus } from '../indexing/indexer.js';
import { indexExists, readIndex } from '../indexing/store.js';
import type { Evidence, IndexedChunk } from '../types.js';
import {
	filterLocalCandidates,
	rankLocalCandidates,
	retrieveEligibleCandidates,
	searchKnowledge,
	searchLocalCandidateBundle,
	searchLocalCandidates,
	searchLocalCandidatesForTarget,
	selectLocalEvidence,
	selectSearchResponseEvidence
} from './search.js';

vi.mock('../embedding/embeddings.js', () => ({ embedQuestion: vi.fn() }));
vi.mock('../indexing/corpus.js', () => ({ prepareCorpus: vi.fn(), targetIndexFingerprint: vi.fn(() => 'fingerprint') }));

it('propagates inherited context to public evidence without an embedding call', () => {
	const [chunk] = chunkSource({
		id: 'resume', file: 'approved/resume.md', title: 'Resume',
		publicUrl: null, absolutePath: 'unused',
		content: '# Resume\n## Project\n### Tools\nRust.'
	}, 1800, 240);
	const [evidence] = selectSearchResponseEvidence([{ ...chunk, score: 0.8 }], 1);
	expect(evidence).toMatchObject({
		id: 'resume:0001', title: 'Resume', section: 'Tools', citationId: 'S1',
		content: 'Project\n\n# Tools\n\nRust.', excerpt: 'Project\n\n# Tools\n\nRust.'
	});
	expect(embedQuestion).not.toHaveBeenCalled();
});
