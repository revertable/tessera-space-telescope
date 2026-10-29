import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { KnowledgeSource, KnowledgeSourceSettings } from './source.js';

export type AllowedGitBookTool = 'searchDocumentation' | 'getPage';

export interface McpToolDescription {
	name: string;
	description?: string;
	inputSchema?: unknown;
}

export interface McpToolResult {
	content?: unknown[];
	structuredContent?: unknown;
	isError?: boolean;
	[key: string]: unknown;
}

export interface GitBookMcpCapabilities {
	serverVersion: unknown;
	serverCapabilities: unknown;
	instructions: unknown;
	tools: McpToolDescription[];
}

export interface GitBookMcpClient {
	connect(): Promise<void>;
	listTools(): Promise<{ tools: McpToolDescription[] }>;
	callTool(request: {
		name: AllowedGitBookTool;
		arguments: Record<string, unknown>;
	}): Promise<McpToolResult>;
	getServerVersion(): unknown;
	getServerCapabilities(): unknown;
	getInstructions(): unknown;
	close(): Promise<void>;
}

export type GitBookMcpClientFactory = (endpoint: URL) => GitBookMcpClient;

function defaultClientFactory(endpoint: URL): GitBookMcpClient {
	const client = new Client({ name: 'mosaic-gitbook-probe', version: '0.1.0' });
	const transport = new StreamableHTTPClientTransport(endpoint);
	return {
		connect: () => client.connect(transport),
		listTools: async () => (await client.listTools()) as { tools: McpToolDescription[] },
		callTool: async (request) => (await client.callTool(request)) as McpToolResult,
		getServerVersion: () => client.getServerVersion(),
		getServerCapabilities: () => client.getServerCapabilities(),
		getInstructions: () => client.getInstructions(),
		close: () => client.close()
	};
}

export class GitBookMcpKnowledgeSource implements KnowledgeSource<McpToolResult> {
	readonly type = 'mcp' as const;
	readonly id: string;
	readonly provider: string;
	readonly enabled: boolean;
	readonly endpoint: URL;
	private client: GitBookMcpClient | undefined;
	private connected = false;

	constructor(
		settings: KnowledgeSourceSettings,
		private readonly clientFactory: GitBookMcpClientFactory = defaultClientFactory
	) {
		if (settings.type !== 'mcp' || settings.provider !== 'gitbook' || !settings.endpoint) {
			throw new Error('GitBookMcpKnowledgeSource requires an mcp/gitbook source with an endpoint.');
		}
		this.id = settings.id;
		this.provider = settings.provider;
		this.enabled = settings.enabled;
		this.endpoint = new URL(settings.endpoint);
		if (this.endpoint.protocol !== 'https:') throw new Error('GitBook MCP endpoint must use HTTPS.');
	}

	private async getClient(): Promise<GitBookMcpClient> {
		if (!this.enabled) throw new Error(`Knowledge source ${this.id} is disabled.`);
		this.client ??= this.clientFactory(this.endpoint);
		if (!this.connected) {
			await this.client.connect();
			this.connected = true;
		}
		return this.client;
	}

	private async callAllowedTool(
		name: AllowedGitBookTool,
		args: Record<string, unknown>
	): Promise<McpToolResult> {
		const client = await this.getClient();
		const result = await client.callTool({ name, arguments: args });
		if (result.isError) throw new Error(`GitBook MCP tool ${name} returned an error.`);
		return result;
	}

	search(question: string): Promise<McpToolResult> {
		const query = question.trim();
		if (!query) throw new Error('GitBook documentation query must not be empty.');
		return this.callAllowedTool('searchDocumentation', { query });
	}

	getPage(pageUrl: string): Promise<McpToolResult> {
		const url = new URL(pageUrl);
		if (url.protocol !== 'https:' || url.origin !== this.endpoint.origin) {
			throw new Error('GitBook page URL must be HTTPS and use the configured documentation origin.');
		}
		return this.callAllowedTool('getPage', { url: url.href });
	}

	async observeCapabilities(): Promise<GitBookMcpCapabilities> {
		const client = await this.getClient();
		const listed = await client.listTools();
		return {
			serverVersion: client.getServerVersion(),
			serverCapabilities: client.getServerCapabilities(),
			instructions: client.getInstructions(),
			tools: listed.tools
		};
	}

	async close(): Promise<void> {
		if (!this.client) return;
		await this.client.close();
		this.client = undefined;
		this.connected = false;
	}
}
