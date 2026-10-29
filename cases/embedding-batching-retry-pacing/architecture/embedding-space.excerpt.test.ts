import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import {
	EMBEDDING_INPUT_VERSION,
	embeddingSpaceIdentity,
	prepareCorpus,
	targetIndexFingerprint
} from './corpus.js';

	it('ignores generation target changes', async () => {
		const config = loadConfig();
		const first = await prepareCorpus(config);
		const changed = await prepareCorpus({
			...config,
			generation: {
				...config.generation,
				targets: [{ provider: 'another-provider', model: 'another-model' }]
			}
		});
		expect(changed.corpusFingerprint).toBe(first.corpusFingerprint);
	});

	it('keeps persistent index identity independent of runtime target metadata and priority', async () => {
		const config = loadConfig();
		const corpus = await prepareCorpus(config);
		const target = config.embedding.targets[0];
		const expected = targetIndexFingerprint(corpus.corpusFingerprint, target);
		expect(targetIndexFingerprint(corpus.corpusFingerprint, {
			...target,
			id: 'renamed-runtime-role',
			credentialSlot: 'rotated_credential'
		})).toBe(expected);
		const reordered = [...config.embedding.targets].reverse();
		const sameSpace = reordered.find(({ provider, model, dimensions }) => (
			provider === target.provider && model === target.model && dimensions === target.dimensions
		));
		expect(targetIndexFingerprint(corpus.corpusFingerprint, sameSpace!)).toBe(expected);
	});

	it('includes the embedding input contract and corpus in artifact identity', async () => {
		const config = loadConfig();
		const corpus = await prepareCorpus(config);
		const target = config.embedding.targets[0];
		expect(embeddingSpaceIdentity(target)).toEqual({
			provider: target.provider,
			model: target.model,
			dimensions: target.dimensions,
			embeddingInputVersion: EMBEDDING_INPUT_VERSION
		});
		expect(targetIndexFingerprint(corpus.corpusFingerprint, target, EMBEDDING_INPUT_VERSION + 1))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, target));
		expect(targetIndexFingerprint('another-corpus', target))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, target));
	});

	it('keeps corpus identity independent while target index identity changes with the provider', async () => {
		const config = loadConfig();
		const corpus = await prepareCorpus(config);
		const target = config.embedding.targets[0];
		expect(targetIndexFingerprint(corpus.corpusFingerprint, { ...target, provider: 'another-provider' }))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, target));
	});

	it('changes target index identity when the embedding model changes', async () => {
		const config = loadConfig();
		const corpus = await prepareCorpus(config);
		const target = config.embedding.targets[0];
		expect(targetIndexFingerprint(corpus.corpusFingerprint, { ...target, model: 'another-embedding' }))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, target));
	});

	it('changes target index identity when the embedding dimensions change', async () => {
		const config = loadConfig();
		const corpus = await prepareCorpus(config);
		const target = config.embedding.targets[0];
		expect(targetIndexFingerprint(corpus.corpusFingerprint, { ...target, dimensions: 1536 }))
			.not.toBe(targetIndexFingerprint(corpus.corpusFingerprint, target));
	});
