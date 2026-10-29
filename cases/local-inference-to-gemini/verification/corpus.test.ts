import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { prepareCorpus } from './corpus.js';

describe('index fingerprint', () => {
	it('ignores generation model changes', async () => {
		const config = loadConfig();
		const first = await prepareCorpus(config);
		const changed = await prepareCorpus({ ...config, generation: { ...config.generation, model: 'another-model' } });
		expect(changed.fingerprint).toBe(first.fingerprint);
	});

	it('changes when the embedding model changes', async () => {
		const config = loadConfig();
		const first = await prepareCorpus(config);
		const changed = await prepareCorpus({ ...config, embedding: { ...config.embedding, model: 'another-embedding' } });
		expect(changed.fingerprint).not.toBe(first.fingerprint);
	});

	it('changes when the embedding dimensions change', async () => {
		const config = loadConfig();
		const first = await prepareCorpus(config);
		const changed = await prepareCorpus({ ...config, embedding: { ...config.embedding, outputDimensions: 1536 } });
		expect(changed.fingerprint).not.toBe(first.fingerprint);
	});
});
