import { describe, expect, it } from 'vitest';
import { chunkSource } from './chunker.js';

const source = {
	id: 'resume',
	file: 'approved/resume.md',
	title: 'Resume',
	publicUrl: null,
	absolutePath: 'unused',
	content: '# Experience\nBuilt a telescope.\n\n## Skills\nSvelte and retrieval.'
};


	it('preserves IDs, order, metadata and content across LF, CRLF, CR and mixed input', () => {
		const content = [
			'# Title', '', 'Introduction.', '', '## Parent', '', '### Child', '',
			'한국어 text '.repeat(100), '', '\x60\x60\x60markdown', '# Fenced heading', '\x60\x60\x60', '', '## Tail', '', 'End.'
		].join('\n');
		const input = { ...source, content };
		const expected = chunkSource(input, 300, 40);
		expect(expected.length).toBeGreaterThan(3);
		let position = 0;
		for (const variant of [
			content,
			content.replace(/\n/g, '\r\n'),
			content.replace(/\n/g, '\r'),
			content.replace(/\n/g, () => ['\n', '\r', '\r\n'][position++ % 3])
		]) {
			expect(chunkSource({ ...input, content: variant }, 300, 40)).toEqual(expected);
		}
	});
