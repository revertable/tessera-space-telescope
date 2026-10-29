import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingTarget, EmbeddingFailureKind } from './provider.js';
import { EmbeddingProviderError } from './provider.js';
import type { IndexStatus } from '../indexing/indexer.js';
import { EmbeddingTargetBlockedError, runEmbeddingTargetFallback } from './target-fallback.js';

function target(id: string): EmbeddingTarget {
	return { id, provider: 'synthetic', model: id, dimensions: 2, credentialSlot: id };
}

function current(target: EmbeddingTarget): IndexStatus {
	return { target, state: 'current', fingerprint: target.id, corpusFingerprint: 'corpus', path: target.id, chunkCount: 1 };
}

function transient(kind: EmbeddingFailureKind = 'rate_limit') {
	return new EmbeddingProviderError(kind, 'temporary failure', true);
}

describe('ordered embedding target fallback', () => {
	it('reaches a synthetic third target after fallbackable provider failures', async () => {
		const targets = ['primary', 'fallback', 'tertiary'].map(target);
		const operation = vi.fn(async (item: EmbeddingTarget) => {
			if (item.id !== 'tertiary') throw transient();
			return item.id;
		});
		await expect(runEmbeddingTargetFallback(
			targets.map(current),
			Object.fromEntries(targets.map(({ id }) => [id, 'configured'])),
			operation
		)).resolves.toMatchObject({ target: { id: 'tertiary' }, value: 'tertiary' });
		expect(operation.mock.calls.map(([item]) => item.id)).toEqual(['primary', 'fallback', 'tertiary']);
	});

	it('does not hide a current-index credential blocker', async () => {
		const primary = target('primary');
		const fallback = target('fallback');
		await expect(runEmbeddingTargetFallback(
			[current(primary), current(fallback)],
			{ fallback: 'configured' },
			async () => 'unused'
		)).rejects.toBeInstanceOf(EmbeddingTargetBlockedError);
	});
});
