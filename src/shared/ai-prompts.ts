import { BatchWordResult, ParsedWord } from './types';
import { formatPartOfSpeech } from './utils/wordParser';

/**
 * Builds the batch prompt for generating word meanings via AI.
 */
export function buildBatchPrompt(
	parsedWords: ParsedWord[],
	examplesPerMeaning: number,
): string {
	const wordsList = parsedWords
		.map(
			(pw, i) =>
				`${i + 1}. "${pw.word}" (${formatPartOfSpeech(pw.partOfSpeech)})`,
		)
		.join('\n')

	return `You are an expert lexicographer creating Anki flashcards.

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
}

/**
 * Parses AI response text, extracting the JSON array of BatchWordResult.
 * Cleans transcription by stripping surrounding slashes.
 */
export function parseBatchResponse(text: string): BatchWordResult[] {
	const jsonMatch = text.match(/\[[\s\S]*\]/)
	if (!jsonMatch) {
		throw new Error('Invalid response format from AI')
	}

	const parsed = JSON.parse(jsonMatch[0]) as any[]

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
}

/**
 * Builds the mnemonic generation prompt for a single word.
 */
export function buildMnemonicPrompt(
	word: string,
	definition: string,
	wordType: string,
): string {
	return `You are a memory coach who creates vivid mnemonics for language learners.

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
}
