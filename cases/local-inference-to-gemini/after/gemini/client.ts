import { GoogleGenAI } from '@google/genai';
import type { MosaicConfig } from '../config.js';

export class GeminiError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'GeminiError';
	}
}

export function createGeminiClient(config: MosaicConfig): GoogleGenAI {
	if (!config.gemini.apiKey) {
		throw new GeminiError('GEMINI_API_KEY is required on the server.');
	}
	return new GoogleGenAI({ apiKey: config.gemini.apiKey });
}
