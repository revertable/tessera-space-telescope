import { json } from '@sveltejs/kit';
import type { AnswerResult } from '../types.js';
import { invalidQuestionFailure } from './service-failure.js';

const publicJson = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/** Public HTTP policy only; request work and lease ownership stay in the route. */
export const askResponses = {
	unavailable() {
		return publicJson({ code: 'ASK_UNAVAILABLE', error: '현재 요청을 처리할 수 없습니다.' }, 503);
	},
	admission(rejection: { code: string; retryAfter: number }) {
		return publicJson({ code: rejection.code, error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, 429, { 'Retry-After': String(rejection.retryAfter) });
	},
	input(failure: { status: number; code: string }) {
		// Finish the error response before closing a potentially unfinished
		// body. Cancelling the input stream would reset the adapter-node socket.
		const headers: Record<string, string> = failure.status === 413 || failure.status === 408 ? { Connection: 'close' } : {};
		return publicJson({ code: failure.code, error: '질문 요청의 크기와 내용을 확인한 뒤 다시 시도해 주세요.' }, failure.status, headers);
	},
	invalidQuestion() {
		return publicJson(invalidQuestionFailure.body, invalidQuestionFailure.status);
	},
	generationTimeout() {
		return publicJson({ code: 'GENERATION_TIMEOUT', error: '답변 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' }, 504);
	},
	staleIndex() {
		return publicJson({ error: 'The knowledge index is missing or stale. Run the index build command.', code: 'INDEX_STALE' }, 409);
	},
	serviceFailure(failure: { status: number; body: { code: string; error: string } }) {
		return publicJson(failure.body, failure.status);
	},
	success(result: AnswerResult, credentials: Record<string, string>) {
		const serialized = JSON.stringify(result);
		// Fail closed if a credential accidentally enters a successful payload.
		if (Object.values(credentials ?? {}).some((key) => key && serialized.includes(JSON.stringify(key).slice(1, -1)))) {
			throw new Error('Unsafe answer payload.');
		}
		return publicJson(result);
	}
};
