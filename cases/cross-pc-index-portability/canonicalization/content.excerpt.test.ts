import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CHUNKER_VERSION } from '../knowledge/chunker.js';
import { loadConfig } from '../config.js';
import { loadApprovedSources } from '../knowledge/manifest.js';
import { canonicalSourceContent } from '../knowledge/content.js';
import {
	EMBEDDING_INPUT_VERSION,
	embeddingSpaceIdentity,
	prepareCorpus,
	targetIndexFingerprint
} from './corpus.js';

	it('normalizes only line endings and preserves Unicode, spaces and trailing blank lines', () => {
		const lf = '# Cafe\u0301\n\n  Korean 한글 with trailing spaces  \n\n';
		const variants = [
			lf,
			lf.replace(/\n/g, '\r\n'),
			lf.replace(/\n/g, '\r'),
			'# Cafe\u0301\r\n\r  Korean 한글 with trailing spaces  \n\r\n'
		];
		const identity = (content: string) => createHash('sha256').update(canonicalSourceContent(content)).digest('hex');
		for (const content of variants) {
			expect(canonicalSourceContent(content)).toBe(lf);
			expect(identity(content)).toBe(identity(lf));
		}
		expect(identity(lf.replace('  Korean', 'Korean'))).not.toBe(identity(lf));
		expect(identity(lf.normalize('NFC'))).not.toBe(identity(lf));
	});
