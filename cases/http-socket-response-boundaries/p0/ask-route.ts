import { json } from '@sveltejs/kit';
import { answerQuestion } from '$lib/server/answering/answer';
import { AskInputError, createAskProtection, readAskBody } from '$lib/server/api/ask-protection';
import { invalidQuestionFailure, serviceFailure } from '$lib/server/api/service-failure';
import { loadConfig } from '$lib/server/config';
import { GenerationTimeoutError } from '$lib/server/generation/orchestrator';
import { StaleIndexError, validateQuestion } from '$lib/server/retrieval/search';
import type { RequestHandler } from './$types';

const publicJson = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export function _createAskHandler(protection = createAskProtection()): RequestHandler {
	return async ({ request, getClientAddress }) => {
		let address: string;
		try {
			address = getClientAddress();
			if (!address) throw new Error();
		} catch {
			return publicJson({ code: 'ASK_UNAVAILABLE', error: '현재 요청을 처리할 수 없습니다.' }, 503);
		}
		const admission = protection.acquire(address);
		if ('code' in admission) {
			return publicJson({ code: admission.code, error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, 429, { 'Retry-After': String(admission.retryAfter) });
		}
		let releaseWhenReturning = true;
		try {
			let question: string;
			try {
				const body = await readAskBody(request) as { question?: unknown } | null;
				question = validateQuestion(body?.question);
			} catch (error) {
				if (error instanceof AskInputError) {
					// Finish the error response before closing a potentially unfinished
					// body. Cancelling the input stream here would reset the socket.
					const headers: Record<string, string> = error.status === 413 || error.status === 408 ? { Connection: 'close' } : {};
					return publicJson({ code: error.code, error: '질문 요청의 크기와 내용을 확인한 뒤 다시 시도해 주세요.' }, error.status, headers);
				}
				return publicJson(invalidQuestionFailure.body, invalidQuestionFailure.status);
			}
			try {
				const config = loadConfig();
				const result = await answerQuestion(config, question);
				const serialized = JSON.stringify(result);
				// Fail closed if a credential accidentally enters a successful payload.
				if (Object.values(config.credentials ?? {}).some((key) => key && serialized.includes(JSON.stringify(key).slice(1, -1)))) {
					throw new Error('Unsafe answer payload.');
				}
				return publicJson(result);
			} catch (error) {
				if (error instanceof GenerationTimeoutError) {
					releaseWhenReturning = false;
					void error.settled.then(admission.release, admission.release);
					return publicJson({ code: 'GENERATION_TIMEOUT', error: '답변 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' }, 504);
				}
				if (error instanceof StaleIndexError) return publicJson({ error: 'The knowledge index is missing or stale. Run the index build command.', code: 'INDEX_STALE' }, 409);
				const failure = serviceFailure('answer', error);
				return publicJson(failure.body, failure.status);
			}
		} finally {
			if (releaseWhenReturning) admission.release();
		}
	};
}

export const POST = _createAskHandler();
