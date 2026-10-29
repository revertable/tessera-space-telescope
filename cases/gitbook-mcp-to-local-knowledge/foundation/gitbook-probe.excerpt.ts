import {
	GitBookMcpKnowledgeSource,
	type GitBookMcpCapabilities,
	type McpToolResult
} from './gitbook-mcp-source.js';

export const GITBOOK_PROBE_QUESTIONS = [
	'왜 우리는 공부하는가?',
	'AI를 개발에서 어떤 위치에 두고 있는가?',
	'Human Auditor가 의미하는 것은 무엇인가?',
	'Ride, Don\'t Race와 Why We Study는 어떤 관계인가?'
] as const;

const MAX_PAGES_PER_QUERY = 2;

export interface GitBookProbeSearch {
	question: string;
	result: McpToolResult;
	selectedPageUrls: string[];
	pages: Array<{ url: string; result: McpToolResult }>;
}

export interface GitBookProbeReport {
	observedAt: string;
	source: { id: string; endpoint: string };
	capabilities: GitBookMcpCapabilities;
	searches: GitBookProbeSearch[];
}

export async function probeGitBookSource(source: GitBookMcpKnowledgeSource): Promise<GitBookProbeReport> {
	const capabilities = await source.observeCapabilities();
	const searches: GitBookProbeSearch[] = [];
	const fetched = new Set<string>();

	for (const question of GITBOOK_PROBE_QUESTIONS) {
		const result = await source.search(question);
		const selectedPageUrls = publicPageUrls(result, source.endpoint)
			.filter((url) => !fetched.has(url))
			.slice(0, MAX_PAGES_PER_QUERY);
		const pages: Array<{ url: string; result: McpToolResult }> = [];
		for (const url of selectedPageUrls) {
			fetched.add(url);
			pages.push({ url, result: await source.getPage(url) });
		}
		searches.push({ question, result, selectedPageUrls, pages });
	}

	return {
		observedAt: new Date().toISOString(),
		source: { id: source.id, endpoint: source.endpoint.href },
		capabilities,
		searches
	};
}
