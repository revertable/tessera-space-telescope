import { safeServiceDiagnostic, type ServiceOperation } from '../observability/safe-diagnostics.js';

const publicFailures = {
	answer: {
		status: 503,
		body: {
			code: 'ANSWER_UNAVAILABLE',
			error: '현재 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
		}
	},
	search: {
		status: 503,
		body: {
			code: 'SEARCH_UNAVAILABLE',
			error: '현재 관련 자료를 검색하지 못했습니다. 잠시 후 다시 시도해 주세요.'
		}
	}
} as const;

export const invalidQuestionFailure = {
	status: 400,
	body: {
		code: 'INVALID_QUESTION',
		error: '질문 내용을 확인한 뒤 다시 시도해 주세요.'
	}
} as const;

export function serviceFailure(operation: ServiceOperation, error: unknown) {
	console.error('[Synethos] service operation failed', safeServiceDiagnostic(operation, error));
	return publicFailures[operation];
}
