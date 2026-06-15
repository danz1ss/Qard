import OpenAI from 'openai'
import { BatchWordResult, ParsedWord } from '../../shared/types'
import { formatPartOfSpeech } from '../../shared/utils/wordParser'

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

		const wordsList = parsedWords
			.map(
				(pw, i) =>
					`${i + 1}. "${pw.word}" (${formatPartOfSpeech(pw.partOfSpeech)})`,
			)
			.join('\n')

		const prompt = `You are an expert lexicographer creating Anki flashcards.

TASK: For EACH word below, generate 1 MAIN meaning. Customize the language based on the input word.

WORDS:
${wordsList}

RULES:
1. **Language Detection & Output Language**:
   - If the input word is **English**: Generate definitions, examples, and word types in **English**. Use simple vocabulary (A1-B1).
   - If the input word is **Russian**: Generate definitions, examples, and word types in **Russian**. Use clear, simple Russian.
   - If the input word is mixed or other: Default to English.
   - Examples in the definition MUST be in the same language as the definition.

2. **Meaning Limit**: Generate only 1 most common/important meaning per word.

3. **Part of Speech Constraint**:
   - If "(verb only)" is specified: Generate only verb definitions (or Russian "глагол").
   - If "(noun only)" is specified: Generate only noun definitions (or Russian "существительное").
   - If "(any part of speech)" is specified: Pick the most common part of speech.
   - ALL meanings for a word MUST be the SAME part of speech.

4. **Definition Style (COBUILD)**:
   - Use full sentence definitions where possible (e.g., "If you ____, you...").
   - **Blank in Definition**: ALWAYS replace the target word with "______" (6 underscores) in the \`definition\` field ONLY.
   - **Clarity**: The definition must be easier to understand than the word itself.

5. **Examples (definitionExample and examples)**:
   - **NO BLANKS**: Do NOT use underscores in \`definitionExample\` or the \`examples\` array.
   - **BOLD TARGET**: ALWAYS wrap the target word (or its forms) with \`<b>\` tags in both \`definitionExample\` and the \`examples\` array.
   - Provide ${examplesPerMeaning} additional examples in the \`examples\` array.

6. **Transcription**:
   - Provide IPA transcription for the word.

Respond with a JSON array where each object represents ONE word with its meanings:
[
  {
    "word": "run",
    "meanings": [
      {
        "wordType": "verb",
        "definition": "If you ______, you move very quickly by moving your legs faster than when you walk.",
        "definitionExample": "I <b>run</b> every morning to stay healthy.",
        "exampleType": "run",
        "examples": ["She <b>runs</b> faster than anyone.", "The children were <b>running</b>."],
        "transcription": "rʌn"
      }
    ]
  },
  {
    "word": "книга",
    "meanings": [
      {
        "wordType": "существительное",
        "definition": "______ — это скреплённые вместе листы бумаги с текстом, обычно в переплёте.",
        "definitionExample": "Я читаю интересную <b>книгу</b> по истории.",
        "exampleType": "книга",
        "examples": ["Она купила новую <b>книгу</b>.", "Эта <b>книга</b> очень старая."],
        "transcription": "ˈknʲiɡə"
      }
    ]
  }
]

IMPORTANT:
- Process ALL ${parsedWords.length} words
- Generate ONLY 1 meaning per word (not more!)
- ALL meanings for one word MUST have the SAME wordType
- Strictly follow part of speech constraints when specified
- Respond with ONLY the JSON array, no other text`

		try {
			const completion = await this.client!.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.7,
			})

			const text = completion.choices[0]?.message?.content || ''

			// Try to parse JSON array from the response
			const jsonMatch = text.match(/\[[\s\S]*\]/)
			if (!jsonMatch) {
				throw new Error('Invalid response format from AI')
			}

			const parsed = JSON.parse(jsonMatch[0]) as any[]

			// Process and validate each word's results
			return parsed.map((wordResult: any) => ({
				word: wordResult.word || '',
				meanings: (wordResult.meanings || []).map((meaning: any) => ({
					wordType: meaning.wordType || '',
					definition: meaning.definition || '',
					definitionExample: meaning.definitionExample || '',
					exampleType: meaning.exampleType || '',
					examples: meaning.examples || [],
					transcription: (meaning.transcription || '')
						.replace(/\//g, '')
						.trim(),
				})),
			}))
		} catch (error: any) {
			console.error('AI batch word meanings error:', error)
			throw new Error(`Failed to generate word meanings: ${error.message}`)
		}
	}

	/**
	 * Generates a short, vivid mnemonic to help memorize a single word.
	 * Returns plain text (1-2 sentences) in the language of the word.
	 */
	async generateMnemonic(
		word: string,
		definition: string,
		wordType: string,
	): Promise<string> {
		this.ensureInitialized()

		const prompt = `You are a memory coach who creates vivid mnemonics for language learners.

WORD: "${word}"${wordType ? ` (${wordType})` : ''}
MEANING: ${definition.replace(/_{3,}/g, word)}

TASK: Create ONE short, vivid mnemonic that helps memorize this word and its meaning.

RULES:
1. **Output language**: Write the mnemonic in the SAME language as the word above.
   - English word → English mnemonic. Russian word → Russian mnemonic. Default to English.
2. **Technique**: Use a sound-alike association, a vivid mental image, or a memorable mini-story that links the word's form to its meaning.
3. **Length**: 1-2 sentences max. Be concrete and visual, not abstract.
4. **Tone**: Playful and memorable. Slightly absurd images stick better.
5. Output ONLY the mnemonic text. No labels, no quotes, no preface.`

		try {
			const completion = await this.client!.chat.completions.create({
				model: this.model,
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.9,
			})

			const text = completion.choices[0]?.message?.content?.trim() || ''
			if (!text) {
				throw new Error('Empty response from AI')
			}
			return text
		} catch (error: any) {
			console.error('AI mnemonic error:', error)
			throw new Error(`Failed to generate mnemonic: ${error.message}`)
		}
	}
}

export const geminiService = new AIService()
