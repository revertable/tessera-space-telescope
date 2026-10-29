import type { MosaicConfig } from '../config.js';
import type { Evidence } from '../types.js';
import {
	answerResponseSchema,
	answerSystemInstruction,
	buildAnswerContents,
	type AnswerBasis,
	type GeneratedAnswer
} from './answer-prompt.js';
import { createGenerationProviderFactory, getGenerationTarget, type GenerationProviderFactory } from './provider-factory.js';
import { GenerationProviderError, type GenerationResponse } from './provider.js';

export interface ExplicitGenerationDiagnostics {
	retryPolicy?: 'none';
	onResponse?: (response: GenerationResponse) => void;
}

export type { GeneratedAnswer } from './answer-prompt.js';

const answerBases = new Set<AnswerBasis>(['system', 'records', 'unsupported']);

export class GenerationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'GenerationError';
	}
}

interface GenerationAttemptDiagnostic {
	generationTargetId: string;
	generationAttempt: number;
	generationProvider: string;
	generationModel: string;
	isFallbackAttempt: boolean;
	fallbackTriggered: boolean;
	outcome: 'success' | 'fallback' | 'failure';
	reasonCategory?: string;
	providerStatus?: number;
	providerCode?: string | number;
}

function logGenerationAttempt(diagnostic: GenerationAttemptDiagnostic): void {
	console.info('[Synethos] generation attempt', diagnostic);
}

export async function generateGroundedAnswer(
	config: MosaicConfig,
	question: string,
	evidence: Evidence[],
	providerFactory: GenerationProviderFactory = createGenerationProviderFactory(config),
	execution: { mode: 'runtime' } | ({ mode: 'explicit'; targetId: string } & ExplicitGenerationDiagnostics) = { mode: 'runtime' }
): Promise<GeneratedAnswer> {
	let content: string | undefined;
	let completedAttempt: { number: number; id: string; provider: string; model: string; isFallback: boolean } | undefined;
	const contents = buildAnswerContents(question, evidence);
	const targets = execution.mode === 'explicit'
		? [getGenerationTarget(config, execution.targetId)]
		: config.generation.runtimeTargetIds.map((id) => getGenerationTarget(config, id));

	for (const [index, target] of targets.entries()) {
		const attempt = index + 1;
		const isFallbackAttempt = index > 0;
		try {
			const response = await providerFactory(target).generate({
				target,
				contents,
				systemInstruction: answerSystemInstruction,
				responseSchema: answerResponseSchema,
				maxOutputTokens: target.options.maxOutputTokens,
				...(execution.mode === 'explicit' && execution.retryPolicy ? { retryPolicy: execution.retryPolicy } : {})
			});
			if (execution.mode === 'explicit') execution.onResponse?.(response);
			content = response.content;
			completedAttempt = { number: attempt, id: target.id, provider: target.provider, model: target.model, isFallback: isFallbackAttempt };
			break;
		} catch (error) {
			const failure = error instanceof GenerationProviderError
				? error
				: new GenerationProviderError('unknown', 'Generation provider request failed.', undefined, undefined, { cause: error });
			const fallbackTriggered = execution.mode === 'runtime' && failure.category === 'quota_exhausted' && index < targets.length - 1;
			logGenerationAttempt({
				generationTargetId: target.id,
				generationAttempt: attempt,
				generationProvider: target.provider,
				generationModel: target.model,
				isFallbackAttempt,
				fallbackTriggered,
				outcome: fallbackTriggered ? 'fallback' : 'failure',
				reasonCategory: failure.category,
				...(failure.providerStatus !== undefined ? { providerStatus: failure.providerStatus } : {}),
				...(failure.providerCode !== undefined ? { providerCode: failure.providerCode } : {})
			});
			if (fallbackTriggered) continue;
			throw new GenerationError('Answer generation failed.', { cause: failure });
		}
	}
	if (!completedAttempt) throw new GenerationError('Answer generation failed.');
	if (!content) {
		logGenerationAttempt({
			generationTargetId: completedAttempt.id,
			generationAttempt: completedAttempt.number,
			generationProvider: completedAttempt.provider,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'empty_response'
		});
		throw new GenerationError('Generation provider returned an empty answer.');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		logGenerationAttempt({
			generationTargetId: completedAttempt.id,
			generationAttempt: completedAttempt.number,
			generationProvider: completedAttempt.provider,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'invalid_json'
		});
		throw new GenerationError('Generation provider did not return the required JSON answer.', { cause: error });
	}
	const result = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as Partial<GeneratedAnswer>;
	if (
		typeof result.basis !== 'string' ||
		!answerBases.has(result.basis as AnswerBasis) ||
		typeof result.answer !== 'string' ||
		!Array.isArray(result.citations) ||
		result.citations.some((item) => typeof item !== 'string')
	) {
		logGenerationAttempt({
			generationTargetId: completedAttempt.id,
			generationAttempt: completedAttempt.number,
			generationProvider: completedAttempt.provider,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'invalid_shape'
		});
		throw new GenerationError('Generation provider returned an invalid answer shape.');
	}
	logGenerationAttempt({
		generationTargetId: completedAttempt.id,
		generationAttempt: completedAttempt.number,
		generationProvider: completedAttempt.provider,
		generationModel: completedAttempt.model,
		isFallbackAttempt: completedAttempt.isFallback,
		fallbackTriggered: false,
		outcome: 'success'
	});
	return {
		basis: result.basis as AnswerBasis,
		answer: result.answer.trim(),
		citations: [...new Set(result.citations)]
	};
}

export function generateGroundedAnswerForTarget(
	config: MosaicConfig, targetId: string, question: string, evidence: Evidence[],
	providerFactory: GenerationProviderFactory = createGenerationProviderFactory(config),
	diagnostics: ExplicitGenerationDiagnostics = {}
): Promise<GeneratedAnswer> {
	return generateGroundedAnswer(config, question, evidence, providerFactory, { mode: 'explicit', targetId, ...diagnostics });
}
