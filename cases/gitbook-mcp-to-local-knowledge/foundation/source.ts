export type KnowledgeSourceType = 'local' | 'mcp';

export interface KnowledgeSourceSettings {
	id: string;
	type: KnowledgeSourceType;
	provider: string;
	endpoint: string | null;
	enabled: boolean;
}

export interface KnowledgeSource<TResult = unknown> {
	readonly id: string;
	readonly type: KnowledgeSourceType;
	readonly provider: string;
	readonly enabled: boolean;
	search(question: string): Promise<TResult>;
}
