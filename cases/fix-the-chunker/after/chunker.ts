import type { KnowledgeChunk } from '../types.js';
import type { LoadedSource } from './manifest.js';

export const CHUNKER_VERSION = 2;

interface Heading {
	level: number;
	text: string;
	documentTitle: boolean;
}

interface MarkdownSection {
	heading: string;
	ancestors: string[];
	documentTitle: boolean;
	text: string;
}

function sections(markdown: string): MarkdownSection[] {
	const output: MarkdownSection[] = [];
	let heading: Heading = { level: 1, text: 'Document', documentTitle: false };
	const headingStack: Heading[] = [];
	let firstHeadingSeen = false;
	let fence: { marker: string; length: number } | undefined;
	let lines: string[] = [];
	const flush = () => {
		const text = lines.join('\n').trim();
		if (text) {
			output.push({
				heading: heading.text,
				ancestors: headingStack.slice(0, -1)
					.filter((ancestor) => !ancestor.documentTitle)
					.map((ancestor) => ancestor.text),
				documentTitle: heading.documentTitle,
				text
			});
		}
		lines = [];
	};
	for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
		if (fence) {
			lines.push(line);
			const closing = /^ {0,3}(\x60{3,}|~{3,})[ \t]*$/.exec(line);
			if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
				fence = undefined;
			}
			continue;
		}
		const opening = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
		if (opening && (opening[1][0] !== '\x60' || !opening[2].includes('\x60'))) {
			fence = { marker: opening[1][0], length: opening[1].length };
			lines.push(line);
			continue;
		}
		const match = /^(#{1,6})\s+(.+)$/.exec(line);
		if (match) {
			flush();
			const level = match[1].length;
			// The initial H1 is the document title; later H1s remain section context.
			heading = { level, text: match[2].trim(), documentTitle: !firstHeadingSeen && level === 1 };
			firstHeadingSeen = true;
			while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
				headingStack.pop();
			}
			headingStack.push(heading);
		} else {
			lines.push(line);
		}
	}
	flush();
	return output;
}

function splitText(text: string, maxCharacters: number, overlap: number): string[] {
	if (text.length <= maxCharacters) return [text];
	const chunks: string[] = [];
	let start = 0;
	while (start < text.length) {
		let end = Math.min(start + maxCharacters, text.length);
		if (end < text.length) {
			const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf(' ', end));
			if (boundary > start + Math.floor(maxCharacters * 0.6)) end = boundary;
		}
		chunks.push(text.slice(start, end).trim());
		if (end >= text.length) break;
		start = Math.max(start + 1, end - overlap);
	}
	return chunks.filter(Boolean);
}

export function chunkSource(source: LoadedSource, maxCharacters: number, overlap: number): KnowledgeChunk[] {
	let sequence = 0;
	return sections(source.content).flatMap(({ heading, ancestors, documentTitle, text }) =>
		splitText(text, maxCharacters, overlap).map((part) => {
			sequence += 1;
			const prefix = documentTitle
				? ''
				: (ancestors.length ? ancestors.join(' > ') + '\n\n' : '') + '# ' + heading + '\n\n';
			return {
				id: source.id + ':' + String(sequence).padStart(4, '0'),
				sourceId: source.id,
				title: source.title,
				section: heading,
				content: prefix + part,
				publicUrl: source.publicUrl ?? null
			};
		})
	);
}
