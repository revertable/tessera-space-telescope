import type { EmbeddingTarget } from './provider.js';
import { isFallbackableEmbeddingFailure } from './failure.js';
import type { IndexStatus } from '../indexing/indexer.js';
import { targetReachabilityDecision, type TargetReachabilityDecision } from './reachability.js';

export class EmbeddingTargetBlockedError extends Error {
	constructor(
		public readonly targetId: string,
		public readonly reason: Extract<TargetReachabilityDecision, { kind: 'blocker' }>['reason']
	) {
		super(`Embedding target ${targetId} is blocked: ${reason}.`);
		this.name = 'EmbeddingTargetBlockedError';
	}
}

export class NoReachableEmbeddingTargetError extends Error {
	constructor() {
		super('No configured embedding target is reachable.');
		this.name = 'NoReachableEmbeddingTargetError';
	}
}

export async function runEmbeddingTargetFallback<T>(
	statuses: IndexStatus[],
	credentials: Record<string, string>,
	operation: (target: EmbeddingTarget) => Promise<T>
): Promise<{ target: EmbeddingTarget; value: T }> {
	let lastFallbackFailure: unknown;
	for (const status of statuses) {
		const decision = targetReachabilityDecision(status, credentials);
		if (decision.kind === 'fallback') continue;
		if (decision.kind === 'blocker') {
			throw new EmbeddingTargetBlockedError(status.target.id, decision.reason);
		}
		try {
			return { target: status.target, value: await operation(status.target) };
		} catch (error) {
			if (!isFallbackableEmbeddingFailure(error)) throw error;
			lastFallbackFailure = error;
		}
	}
	if (lastFallbackFailure) throw lastFallbackFailure;
	throw new NoReachableEmbeddingTargetError();
}
