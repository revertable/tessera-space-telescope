import type { GoogleGenAI } from '@google/genai';
import type { MosaicConfig } from '../config.js';
import type { Evidence } from '../types.js';
import {
	answerResponseSchema,
	answerSystemInstruction,
	buildAnswerContents,
	type AnswerBasis,
	type GeneratedAnswer
} from './answer-prompt.js';
import { createGeminiClient, GeminiError } from './client.js';
import { classifyGenerationFailure, logGenerationAttempt } from './generation-fallback.js';

type GeminiModels = Pick<GoogleGenAI, 'models'>;
export type { GeneratedAnswer } from './answer-prompt.js';

const answerBases = new Set<AnswerBasis>(['system', 'records', 'unsupported']);
const generationRetryOptions = {
	attempts: 4,
	initialDelay: 1,
	maxDelay: 4,
	expBase: 2,
	jitter: 1,
	httpStatusCodes: [503]
};

export async function generateGroundedAnswer(
	config: MosaicConfig,
	question: string,
	evidence: Evidence[],
	client: GeminiModels = createGeminiClient(config)
): Promise<GeneratedAnswer> {
	let content: string | undefined;
	let completedAttempt: { number: number; model: string; isFallback: boolean } | undefined;
	const contents = buildAnswerContents(question, evidence);
	const requestConfig = {
		systemInstruction: answerSystemInstruction,
		maxOutputTokens: config.generation.maxOutputTokens,
		responseMimeType: 'application/json',
		responseJsonSchema: answerResponseSchema,
		httpOptions: { retryOptions: generationRetryOptions }
	};

	for (const [index, model] of config.generation.models.entries()) {
		const attempt = index + 1;
		const isFallbackAttempt = index > 0;
		try {
			const response = await client.models.generateContent({ model, contents, config: requestConfig });
			content = response.text;
			completedAttempt = { number: attempt, model, isFallback: isFallbackAttempt };
			break;
		} catch (error) {
			const failure = classifyGenerationFailure(error);
			const fallbackTriggered = failure.category === 'quota_exhausted' && index < config.generation.models.length - 1;
			logGenerationAttempt({
				generationAttempt: attempt,
				generationModel: model,
				isFallbackAttempt,
				fallbackTriggered,
				outcome: fallbackTriggered ? 'fallback' : 'failure',
				reasonCategory: failure.category,
				...(failure.providerStatus !== undefined ? { providerStatus: failure.providerStatus } : {}),
				...(failure.providerCode !== undefined ? { providerCode: failure.providerCode } : {})
			});
			if (fallbackTriggered) continue;
			throw new GeminiError('Gemini answer generation failed.', { cause: error });
		}
	}
	if (!completedAttempt) throw new GeminiError('Gemini answer generation failed.');
	if (!content) {
		logGenerationAttempt({
			generationAttempt: completedAttempt.number,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'empty_response'
		});
		throw new GeminiError('Gemini returned an empty answer.');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		logGenerationAttempt({
			generationAttempt: completedAttempt.number,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'invalid_json'
		});
		throw new GeminiError('Gemini did not return the required JSON answer.', { cause: error });
	}
	const result = parsed as Partial<GeneratedAnswer>;
	if (
		typeof result.basis !== 'string' ||
		!answerBases.has(result.basis as AnswerBasis) ||
		typeof result.answer !== 'string' ||
		!Array.isArray(result.citations) ||
		result.citations.some((item) => typeof item !== 'string')
	) {
		logGenerationAttempt({
			generationAttempt: completedAttempt.number,
			generationModel: completedAttempt.model,
			isFallbackAttempt: completedAttempt.isFallback,
			fallbackTriggered: false,
			outcome: 'failure',
			reasonCategory: 'invalid_shape'
		});
		throw new GeminiError('Gemini returned an invalid answer shape.');
	}
	logGenerationAttempt({
		generationAttempt: completedAttempt.number,
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
