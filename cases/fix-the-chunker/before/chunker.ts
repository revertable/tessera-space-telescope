import type { KnowledgeChunk } from '../types.js';
import type { LoadedSource } from './manifest.js';

export const CHUNKER_VERSION = 1;

function sections(markdown: string): Array<{ heading: string; text: string }> {
	const output: Array<{ heading: string; text: string }> = [];
	let heading = 'Document';
	let lines: string[] = [];
	const flush = () => {
		const text = lines.join('\n').trim();
		if (text) output.push({ heading, text });
		lines = [];
	};
	for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
		const match = /^(#{1,6})\s+(.+)$/.exec(line);
		if (match) {
			flush();
			heading = match[2].trim();
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
	return sections(source.content).flatMap(({ heading, text }) =>
		splitText(text, maxCharacters, overlap).map((part) => {
			sequence += 1;
			return {
				id: `${source.id}:${String(sequence).padStart(4, '0')}`,
				sourceId: source.id,
				title: source.title,
				section: heading,
				content: `# ${heading}\n\n${part}`,
				publicUrl: source.publicUrl ?? null
			};
		})
	);
}
