import { describe, expect, it, vi } from 'vitest';
import type { AnswerResult } from '../types.js';
import { askResponses } from './ask-response.js';
import { serviceFailure } from './service-failure.js';

const result: AnswerResult = { status: 'answered', answer: 'public answer', sources: [] };

describe('ask public HTTP response policy', () => {
	it('preserves fixed public failure contracts and no-store on every response', async () => {
		const cases = [
			[askResponses.unavailable(), 503, { code: 'ASK_UNAVAILABLE', error: '현재 요청을 처리할 수 없습니다.' }],
			[askResponses.invalidQuestion(), 400, { code: 'INVALID_QUESTION', error: '질문 내용을 확인한 뒤 다시 시도해 주세요.' }],
			[askResponses.generationTimeout(), 504, { code: 'GENERATION_TIMEOUT', error: '답변 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' }],
			[askResponses.staleIndex(), 409, { error: 'The knowledge index is missing or stale. Run the index build command.', code: 'INDEX_STALE' }]
		] as const;
		for (const [response, status, body] of cases) {
			expect(response.status).toBe(status);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(response.headers.get('connection')).toBeNull();
			expect(response.headers.get('retry-after')).toBeNull();
			expect(await response.json()).toEqual(body);
		}
	});

	it.each(['ASK_RATE_LIMITED', 'ASK_BUSY'])('preserves admission code %s and the computed Retry-After', async (code) => {
		const response = askResponses.admission({ code, retryAfter: 27 });
		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('27');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ code, error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
	});

	it.each([[413, 'REQUEST_TOO_LARGE'], [408, 'REQUEST_TIMEOUT'], [400, 'INVALID_QUESTION']] as const)('preserves body failure %s with close only for 413/408', async (status, code) => {
		const response = askResponses.input({ status, code });
		expect(response.status).toBe(status);
		expect(response.headers.get('connection')).toBe(status === 400 ? null : 'close');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ code, error: '질문 요청의 크기와 내용을 확인한 뒤 다시 시도해 주세요.' });
	});

	it('serializes provider-neutral service failure with no-store', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const response = askResponses.serviceFailure(serviceFailure('answer', new Error('synthetic-secret')));
			expect(response.status).toBe(503);
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(await response.json()).toEqual({ code: 'ANSWER_UNAVAILABLE', error: '현재 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
			expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-secret');
		} finally { log.mockRestore(); }
	});

	it('returns the unchanged successful payload with no-store', async () => {
		const response = askResponses.success(result, { empty: '', generation: 'synthetic-secret' });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual(result);
	});

	it.each(['synthetic-secret', 'synthetic-"secret\\\n'])('fails closed for JSON-escaped credentials anywhere in the payload %#', (secret) => {
		const credentials = { generation: secret };
		expect(() => askResponses.success({ ...result, answer: `prefix ${secret} suffix` }, credentials)).toThrow('Unsafe answer payload.');
		const sources: AnswerResult['sources'] = [{ citationId: 'c1', sourceId: 's1', title: 'public', section: 'public', excerpt: secret, publicUrl: null, score: 1 }];
		expect(() => askResponses.success({ ...result, sources }, credentials)).toThrow('Unsafe answer payload.');
	});
});
