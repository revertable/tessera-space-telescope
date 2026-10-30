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

describe('chunkSource', () => {
	it('preserves source and section identity', () => {
		const chunks = chunkSource(source, 200, 20);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toMatchObject({ id: 'resume:0001', sourceId: 'resume', section: 'Experience' });
		expect(chunks[1].content).toContain('Svelte and retrieval');
	});

	it('splits long sections without losing the source id', () => {
		const chunks = chunkSource({ ...source, content: `# Long\n${'evidence '.repeat(100)}` }, 200, 20);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.every((chunk) => chunk.sourceId === 'resume')).toBe(true);
	});
});

describe('Markdown hierarchy and fences', () => {
	it('retains the first H1 boundary without repeating its title in content', () => {
		const chunks = chunkSource({ ...source, content: '# Resume\nIntroduction.\n## Skills\nTools.' }, 200, 20);
		expect(chunks).toMatchObject([
			{ id: 'resume:0001', section: 'Resume', content: 'Introduction.' },
			{ id: 'resume:0002', section: 'Skills', content: '# Skills\n\nTools.' }
		]);
		expect(chunks.every((chunk) => chunk.title === 'Resume')).toBe(true);
	});

	it('inherits category and project context without leaking sibling headings', () => {
		const chunks = chunkSource({ ...source, content: '# Resume\nIntroduction.\n# Contracts\n## Alpha\nPeriod and role.\n### Work\nAlpha work.\n### Tools\nJava.\n## Beta\n### Work\nBeta work.\n# Employment\n## Gamma\n### Tools\nRust.' }, 1000, 20);
		expect(chunks.map((chunk) => chunk.section)).toEqual(['Resume', 'Alpha', 'Work', 'Tools', 'Work', 'Tools']);
		expect(chunks.slice(2).map((chunk) => chunk.content)).toEqual([
			'Contracts > Alpha\n\n# Work\n\nAlpha work.',
			'Contracts > Alpha\n\n# Tools\n\nJava.',
			'Contracts > Beta\n\n# Work\n\nBeta work.',
			'Employment > Gamma\n\n# Tools\n\nRust.'
		]);
	});

	it('supports skipped heading levels and resets sibling ancestry', () => {
		const chunks = chunkSource({ ...source, content: '# Resume\n## First\n#### Detail\nOne.\n## Second\n### Detail\nTwo.' }, 200, 20);
		expect(chunks.map((chunk) => chunk.content)).toEqual([
			'First\n\n# Detail\n\nOne.', 'Second\n\n# Detail\n\nTwo.'
		]);
	});

	it('does not remove a first H2 or a later H1 as a document title', () => {
		const chunks = chunkSource({ ...source, content: '## First\nOne.\n# Second\nTwo.' }, 200, 20);
		expect(chunks.map((chunk) => chunk.content)).toEqual(['# First\n\nOne.', '# Second\n\nTwo.']);
	});

	it('preserves the default section for heading-free text', () => {
		expect(chunkSource({ ...source, content: 'Plain evidence.' }, 200, 20)).toMatchObject([
			{ id: 'resume:0001', section: 'Document', content: '# Document\n\nPlain evidence.' }
		]);
	});

	it('adds context after splitting without changing body splits or IDs', () => {
		const body = 'evidence '.repeat(100);
		const plain = chunkSource({ ...source, content: '# Work\n' + body }, 200, 20);
		const nested = chunkSource({ ...source, content: '# Resume\n## Project\n### Work\n' + body }, 200, 20);
		expect(plain.length).toBeGreaterThan(1);
		expect(nested.map((chunk) => chunk.id)).toEqual(plain.map((chunk) => chunk.id));
		expect(nested.map((chunk) => chunk.content)).toEqual(plain.map((chunk) => 'Project\n\n# Work\n\n' + chunk.content));
	});

	it.each([String.fromCharCode(96).repeat(3), '~~~'])('keeps %s fenced headings in their real section and out of the stack', (fence) => {
		const body = 'Before.\n   ' + fence + 'markdown\n# Fake\n## Wrong\n   ' + fence + '\nAfter.';
		const chunks = chunkSource({ ...source, content: '# Resume\n## Example\n' + body + '\n### Child\nFacts.' }, 1000, 20);
		expect(chunks.map((chunk) => chunk.section)).toEqual(['Example', 'Child']);
		expect(chunks.map((chunk) => chunk.content)).toEqual([
			'# Example\n\n' + body, 'Example\n\n# Child\n\nFacts.'
		]);
	});

	it('requires a matching marker, sufficient length, and a clean closing line', () => {
		const tick = String.fromCharCode(96);
		const body = [tick.repeat(4), '# Literal one', tick.repeat(3), '# Literal two', '~~~~', '## Literal three', tick.repeat(4) + ' trailing text', '# Literal four', tick.repeat(5)].join('\n');
		const chunks = chunkSource({ ...source, content: '# Resume\n## Example\n' + body + '\n### Child\nFacts.' }, 1000, 20);
		expect(chunks.map((chunk) => chunk.section)).toEqual(['Example', 'Child']);
		expect(chunks[0].content).toBe('# Example\n\n' + body);
		expect(chunks[1].content).toBe('Example\n\n# Child\n\nFacts.');
	});

	it('keeps an unclosed fence in its original section', () => {
		const body = '~~~\n# Literal\n## Still literal\n### Also literal';
		expect(chunkSource({ ...source, content: '# Resume\n## Example\n' + body }, 1000, 20)).toMatchObject([
			{ section: 'Example', content: '# Example\n\n' + body }
		]);
	});

	it('splits a long fenced body without interpreting embedded headings', () => {
		const fence = String.fromCharCode(96).repeat(3);
		const body = fence + '\n' + '# Literal\nexample data\n'.repeat(30) + fence;
		const chunks = chunkSource({ ...source, content: '# Resume\n## Example\n' + body }, 200, 20);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.every((chunk) => chunk.section === 'Example')).toBe(true);
		expect(chunks[0].content).toContain(fence + '\n# Literal');
		expect(chunks.at(-1)?.content.endsWith(fence)).toBe(true);
	});

	it('preserves the existing CRLF normalization with fences and ancestry', () => {
		expect(chunkSource({ ...source, content: '# Resume\r\n## Project\r\n### Work\r\n~~~\r\n# Literal\r\n~~~' }, 1000, 20)[0].content)
			.toBe('Project\n\n# Work\n\n~~~\n# Literal\n~~~');
	});

	it('does not open a backtick fence with a backtick in its info string', () => {
		const tick = String.fromCharCode(96);
		const invalid = tick.repeat(3) + ' invalid' + tick + 'info';
		const chunks = chunkSource({ ...source, content: '# Resume\n## Example\n' + invalid + '\n# Real section\nFacts.' }, 1000, 20);
		expect(chunks.map((chunk) => chunk.section)).toEqual(['Example', 'Real section']);
		expect(chunks[0].content).toContain(invalid);
	});
});
