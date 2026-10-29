import type { MosaicConfig } from '../config.js';
import { GitBookMcpKnowledgeSource, type GitBookMcpClientFactory } from './gitbook-mcp-source.js';
import { LocalKnowledgeSource, type LocalSearch } from './local-source.js';
import type { KnowledgeSource, KnowledgeSourceSettings } from './source.js';

export interface KnowledgeSourceFactoryDependencies {
	localSearch?: LocalSearch;
	gitbookClientFactory?: GitBookMcpClientFactory;
}

export function createKnowledgeSource(
	settings: KnowledgeSourceSettings,
	config: MosaicConfig,
	dependencies: KnowledgeSourceFactoryDependencies = {}
): KnowledgeSource {
	switch (`${settings.type}:${settings.provider}`) {
		case 'local:mosaic':
			return new LocalKnowledgeSource(settings, config, dependencies.localSearch);
		case 'mcp:gitbook':
			return new GitBookMcpKnowledgeSource(settings, dependencies.gitbookClientFactory);
		default:
			throw new Error(`Unsupported knowledge source: ${settings.type}/${settings.provider}`);
	}
}
