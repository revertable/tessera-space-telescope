import type { McpToolResult } from './gitbook-mcp-source.js';

export interface GitBookSearchHit {
	title: string;
	content: string;
	publicUrl: string;
	resultIndex: number;
}

export interface GitBookSearchParseResult {
	hits: GitBookSearchHit[];
	rejectedCount: number;
}

function siteRootPath(endpoint: URL): string {
	const endpointPath = endpoint.pathname.replace(/\/$/, '');
	const suffix = '/~gitbook/mcp';
	if (endpoint.protocol !== 'https:' || !endpointPath.endsWith(suffix)) {
		throw new Error('GitBook MCP endpoint must identify an HTTPS Site root.');
	}
	return `${endpointPath.slice(0, -suffix.length)}/`;
}

function publicPageUrl(link: string, endpoint: URL, rootPath: string): string | null {
	try {
		const url = new URL(link);
		if (
			url.protocol !== 'https:' ||
			url.origin !== endpoint.origin ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!url.pathname.startsWith(rootPath) ||
			/%(?:2e|2f|5c)/i.test(url.pathname) ||
			url.pathname.split('/').some((segment) => segment.toLowerCase() === '~gitbook')
		) return null;
		return url.href;
	} catch {
		return null;
	}
}

function parseTextBlock(value: unknown, resultIndex: number, endpoint: URL, rootPath: string): GitBookSearchHit | null {
	if (!value || typeof value !== 'object') return null;
	const block = value as { type?: unknown; text?: unknown };
	if (block.type !== 'text' || typeof block.text !== 'string') return null;
	const lines = block.text.replace(/\r\n/g, '\n').split('\n');
	const title = /^Title:[ \t]*(.+)$/.exec(lines[0] ?? '')?.[1]?.trim();
	const link = /^Link:[ \t]*(.+)$/.exec(lines[1] ?? '')?.[1]?.trim();
	const firstContentLine = /^Content:[ \t]*(.*)$/.exec(lines[2] ?? '')?.[1];
	if (!title || !link || firstContentLine === undefined) return null;
	const content = [firstContentLine, ...lines.slice(3)].join('\n').trim();
	const publicUrl = publicPageUrl(link, endpoint, rootPath);
	if (!content || !publicUrl) return null;
	return { title, content, publicUrl, resultIndex };
}

export function parseGitBookSearchResults(result: McpToolResult, endpoint: URL): GitBookSearchParseResult {
	const rootPath = siteRootPath(endpoint);
	if (result.isError || !Array.isArray(result.content)) {
		throw new Error('GitBook MCP search result has an invalid shape.');
	}
	const hits: GitBookSearchHit[] = [];
	let rejectedCount = 0;
	for (const [resultIndex, block] of result.content.entries()) {
		const hit = parseTextBlock(block, resultIndex, endpoint, rootPath);
		if (hit) hits.push(hit);
		else rejectedCount += 1;
	}
	if (result.content.length > 0 && hits.length === 0) {
		throw new Error('GitBook MCP search result contains no usable entries.');
	}
	return { hits, rejectedCount };
}
