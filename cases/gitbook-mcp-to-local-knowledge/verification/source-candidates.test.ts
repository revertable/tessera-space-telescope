import { describe, expect, it, vi } from 'vitest';
import type { MosaicConfig } from '../config.js';
import type { GitBookMcpClient } from '../knowledge/gitbook-mcp-source.js';
import { collectSourceCandidates } from './source-candidates.js';

describe('collectSourceCandidates', () => {
	it('collects enabled source results with their original ranking signals and configured provenance', async () => {
		const localCandidates = [{
			id: 'resume:0001',
			sourceId: 'resume',
			title: 'Resume',
			section: 'Work',
			content: '# Work\n\nBuilt a telescope.',
			publicUrl: 'https://example.com/resume',
			score: 0.9
		}];
		const localSearch = vi.fn().mockResolvedValue(localCandidates);
		const client: GitBookMcpClient = {
			connect: vi.fn().mockResolvedValue(undefined),
			listTools: vi.fn(),
			callTool: vi.fn().mockResolvedValue({
				content: [
					{ type: 'image' },
					{
						type: 'text',
						text: 'Title: Why We Study\nLink: https://example.gitbook.io/docs/why-we-study\nContent: Study with purpose.'
					}
				]
			}),
			getServerVersion: vi.fn(),
			getServerCapabilities: vi.fn(),
			getInstructions: vi.fn(),
			close: vi.fn().mockResolvedValue(undefined)
		};
		const config = {
			knowledge: {
				sources: [
					{ id: 'local-approved', type: 'local', provider: 'mosaic', endpoint: null, enabled: true },
					{
						id: 'docs-approved',
						type: 'mcp',
						provider: 'gitbook',
						endpoint: 'https://example.gitbook.io/docs/~gitbook/mcp',
						enabled: true
					},
					{ id: 'local-disabled', type: 'local', provider: 'mosaic', endpoint: null, enabled: false }
				]
			}
		} as MosaicConfig;

		const batches = await collectSourceCandidates(config, 'Why study?', {
			localSearch,
			gitbookClientFactory: () => client
		});

		expect(batches).toEqual([
			{
				kind: 'local',
				knowledgeSourceId: 'local-approved',
				candidates: localCandidates
			},
			{
				kind: 'gitbook',
				knowledgeSourceId: 'docs-approved',
				hits: [{
					title: 'Why We Study',
					content: 'Study with purpose.',
					publicUrl: 'https://example.gitbook.io/docs/why-we-study',
					resultIndex: 1
				}]
			}
		]);
		expect(localSearch).toHaveBeenCalledOnce();
		expect(localSearch).toHaveBeenCalledWith(config, 'Why study?');
		expect(client.callTool).toHaveBeenCalledWith({
			name: 'searchDocumentation',
			arguments: { query: 'Why study?' }
		});
		expect(client.close).toHaveBeenCalledOnce();
		expect(batches.every((batch) => !('citationId' in batch))).toBe(true);
		expect(batches[0]?.kind === 'local' && batches[0].candidates[0]?.sourceId).toBe('resume');
		expect(batches[0]?.kind === 'local' && batches[0].candidates[0]?.score).toBe(0.9);
		expect(batches[1]?.kind === 'gitbook' && 'score' in batches[1].hits[0]!).toBe(false);
	});
});
