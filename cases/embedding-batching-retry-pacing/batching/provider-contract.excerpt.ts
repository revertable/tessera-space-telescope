export interface EmbeddingTarget {
	id: string;
	provider: string;
	model: string;
	dimensions: number;
	credentialSlot: string;
}

export interface EmbeddingQueryRequest {
	target: EmbeddingTarget;
	query: string;
}

export interface EmbeddingDocument {
	title: string;
	content: string;
}

export interface EmbeddingDocumentsRequest {
	target: EmbeddingTarget;
	documents: EmbeddingDocument[];
}

export interface EmbeddingDocumentBatching {
	preferredBatchSize: number;
	maximumBatchSize?: number;
}

export interface EmbeddingProvider {
	readonly documentBatching?: Readonly<EmbeddingDocumentBatching>;
	embedQuery(request: EmbeddingQueryRequest): Promise<number[]>;
	embedDocuments(request: EmbeddingDocumentsRequest): Promise<number[][]>;
}
