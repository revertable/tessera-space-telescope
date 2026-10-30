import { describe, expect, it } from 'vitest';
import { chunkSource } from '../knowledge/chunker.js';
import { answerResponseSchema, answerSystemInstruction, buildAnswerContents } from './answer-prompt.js';

it('includes inherited section context with the public title only once', () => {
	const [chunk] = chunkSource({
		id: 'resume', file: 'approved/resume.md', title: 'Resume',
		publicUrl: null, absolutePath: 'unused',
		content: '# Resume\n## Project\n### Work\nBuilt a tool.'
	}, 1800, 240);
	const contents = buildAnswerContents('What was built?', [{
		...chunk, citationId: 'S1', score: 1, excerpt: chunk.content
	}]);
	expect(contents).toContain('<record id="S1">\nTitle: Resume\nSection: Work\nProject\n\n# Work\n\nBuilt a tool.\n</record>');
	expect(contents.match(/Resume/g)).toHaveLength(1);
});
