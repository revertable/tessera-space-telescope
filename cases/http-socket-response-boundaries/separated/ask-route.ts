import { answerQuestion } from '$lib/server/answering/answer';
import { AskInputError, createAskProtection, readAskBody } from '$lib/server/api/ask-protection';
import { askResponses } from '$lib/server/api/ask-response';
import { serviceFailure } from '$lib/server/api/service-failure';
import { loadConfig } from '$lib/server/config';
import { GenerationTimeoutError } from '$lib/server/generation/orchestrator';
import { StaleIndexError, validateQuestion } from '$lib/server/retrieval/search';
import type { RequestHandler } from './$types';

export function _createAskHandler(protection = createAskProtection()): RequestHandler {
	return async ({ request, getClientAddress }) => {
		let address: string;
		try {
			address = getClientAddress();
			if (!address) throw new Error();
		} catch {
			return askResponses.unavailable();
		}
		const admission = protection.acquire(address);
		if ('code' in admission) {
			return askResponses.admission(admission);
		}
		let releaseWhenReturning = true;
		try {
			let question: string;
			try {
				const body = await readAskBody(request) as { question?: unknown } | null;
				question = validateQuestion(body?.question);
			} catch (error) {
				if (error instanceof AskInputError) return askResponses.input(error);
				return askResponses.invalidQuestion();
			}
			try {
				const config = loadConfig();
				const result = await answerQuestion(config, question);
				return askResponses.success(result, config.credentials);
			} catch (error) {
				if (error instanceof GenerationTimeoutError) {
					releaseWhenReturning = false;
					void error.settled.then(admission.release, admission.release);
					return askResponses.generationTimeout();
				}
				if (error instanceof StaleIndexError) return askResponses.staleIndex();
				const failure = serviceFailure('answer', error);
				return askResponses.serviceFailure(failure);
			}
		} finally {
			if (releaseWhenReturning) admission.release();
		}
	};
}

export const POST = _createAskHandler();
