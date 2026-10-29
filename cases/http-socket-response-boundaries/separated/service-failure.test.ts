import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidQuestionFailure, serviceFailure } from './service-failure.js';

afterEach(() => vi.restoreAllMocks());

describe('service failure boundary', () => {
	it('logs the safe diagnostic and returns a provider-neutral answer failure', () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const provider = Object.assign(new Error('Gemini answer generation failed.'), { status: 503 });
		const failure = serviceFailure('answer', provider);
		expect(failure).toEqual({
			status: 503,
			body: {
				code: 'ANSWER_UNAVAILABLE',
				error: '현재 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
			}
		});
		expect(log).toHaveBeenCalledWith('[Synethos] service operation failed', {
			operation: 'answer',
			errors: [{ name: 'Error', status: 503 }]
		});
		expect(JSON.stringify(failure)).not.toContain('Gemini');
	});

	it('provides a separate public contract for invalid questions', () => {
		expect(invalidQuestionFailure).toMatchObject({ status: 400, body: { code: 'INVALID_QUESTION' } });
	});
});
