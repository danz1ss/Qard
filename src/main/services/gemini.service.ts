import OpenAI from 'openai'
import { ParsedWord, BatchWordResult } from '../../shared/types'
import { buildBatchPrompt, parseBatchResponse } from '../../shared/ai-prompts'

interface AIConfig {
	apiKey: string
	baseURL: string
	model: string
}

class AIService {
	private client: OpenAI | null = null
	private model: string = 'gpt-4o-mini'

	configure(config: AIConfig): void {
		this.client = new OpenAI({
			apiKey: config.apiKey,
			// Empty baseURL falls back to the official OpenAI endpoint
			baseURL: config.baseURL || undefined,
		})
		this.model = config.model || 'gpt-4o-mini'
	}

	private ensureInitialized(): void {
		if (!this.client) {
			throw new Error('API key not set. Please configure API key in settings.')
		}
	}

	/**
	 * Generates cards for multiple words in a single request (batch)
	 * Returns results grouped by word
	 * Accepts parsed words with part of speech constraints
	 */
	async generateWordMeaningsBatch(
		parsedWords: ParsedWord[],
		examplesPerMeaning: number,
	): Promise<BatchWordResult[]> {
		this.ensureInitialized()

		const prompt = buildBatchPrompt(parsedWords, examplesPerMeaning)

		try {
			const completion = await this.client!.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.7,
			})

			const text = completion.choices[0]?.message?.content || ''
			return parseBatchResponse(text)
		} catch (error: any) {
			console.error('AI batch word meanings error:', error)
			throw new Error(`Failed to generate word meanings: ${error.message}`)
		}
	}
}

export const geminiService = new AIService()
