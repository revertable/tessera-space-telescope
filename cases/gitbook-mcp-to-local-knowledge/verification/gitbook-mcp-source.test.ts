import { describe, expect, it, vi } from 'vitest';
import {
	GitBookMcpKnowledgeSource,
	type GitBookMcpClient,
	type McpToolResult
} from './gitbook-mcp-source.js';

function fakeClient(): GitBookMcpClient {
	return {
		connect: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({
			tools: [
				{ name: 'searchDocumentation' },
				{ name: 'getPage' },
				{ name: 'askQuestion' },
				{ name: 'sendFeedback' }
			]
		}),
		callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] } as McpToolResult),
		getServerVersion: vi.fn().mockReturnValue({ name: 'gitbook', version: '0.1.0' }),
		getServerCapabilities: vi.fn().mockReturnValue({ tools: { listChanged: true } }),
		getInstructions: vi.fn().mockReturnValue(undefined),
		close: vi.fn().mockResolvedValue(undefined)
	};
}

describe('GitBookMcpKnowledgeSource', () => {
	it('exposes only searchDocumentation and getPage call paths', async () => {
		const client = fakeClient();
		const source = new GitBookMcpKnowledgeSource(
			{
				id: 'docs',
				type: 'mcp',
				provider: 'gitbook',
				endpoint: 'https://example.gitbook.io/docs/~gitbook/mcp',
				enabled: true
			},
			() => client
		);

		await source.search('study');
		await source.getPage('https://example.gitbook.io/docs/why-we-study');

		expect(client.callTool).toHaveBeenNthCalledWith(1, {
			name: 'searchDocumentation',
			arguments: { query: 'study' }
		});
		expect(client.callTool).toHaveBeenNthCalledWith(2, {
			name: 'getPage',
			arguments: { url: 'https://example.gitbook.io/docs/why-we-study' }
		});
		expect('sendFeedback' in source).toBe(false);
		expect('askQuestion' in source).toBe(false);
	});

	it('observes all advertised capabilities without calling them', async () => {
		const client = fakeClient();
		const source = new GitBookMcpKnowledgeSource(
			{
				id: 'docs',
				type: 'mcp',
				provider: 'gitbook',
				endpoint: 'https://example.gitbook.io/docs/~gitbook/mcp',
				enabled: true
			},
			() => client
		);

		const capabilities = await source.observeCapabilities();
		expect(capabilities.tools.map((tool) => tool.name)).toEqual([
			'searchDocumentation',
			'getPage',
			'askQuestion',
			'sendFeedback'
		]);
		expect(client.callTool).not.toHaveBeenCalled();
	});

	it('rejects cross-origin page reads and disabled sources', async () => {
		const disabled = new GitBookMcpKnowledgeSource(
			{
				id: 'docs',
				type: 'mcp',
				provider: 'gitbook',
				endpoint: 'https://example.gitbook.io/docs/~gitbook/mcp',
				enabled: false
			},
			() => fakeClient()
		);
		await expect(disabled.search('study')).rejects.toThrow('disabled');

		const enabled = new GitBookMcpKnowledgeSource(
			{
				id: 'docs',
				type: 'mcp',
				provider: 'gitbook',
				endpoint: 'https://example.gitbook.io/docs/~gitbook/mcp',
				enabled: true
			},
			() => fakeClient()
		);
		expect(() => enabled.getPage('https://attacker.example/page')).toThrow('configured documentation origin');
	});
});
