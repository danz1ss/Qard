import { BatchWordResult, LearnerLevel, ParsedWord } from './types';
import { formatPartOfSpeech } from './utils/wordParser';
import { uniqueAdditionalExamples } from './utils/examples';

const LEVEL_GUIDANCE: Record<LearnerLevel, string> = {
	A0: 'Use the simplest familiar words, very short sentences, and concrete objects or actions. Prefer basic subject-verb-object sentences. Avoid idioms and subordinate clauses.',
	A1: 'Use basic everyday vocabulary and short simple sentences about familiar people, places, and routines. Avoid idioms and abstract explanations.',
	A2: 'Use common everyday vocabulary and simple sentences about practical situations. Simple past/future forms and basic connectors such as because or when are appropriate. Avoid uncommon idioms.',
	B1: 'Use familiar general vocabulary and connected sentences that explain reasons, experiences, and plans. Common subordinate clauses and straightforward abstract ideas are appropriate. Avoid rare or specialist wording.',
	B2: 'Use a broader range of vocabulary, natural collocations, and varied sentence structures in everyday, work, or discussion contexts. Explain distinctions precisely without rare synonyms or unnecessary jargon.',
	C1: 'Use precise, nuanced vocabulary and natural complex sentences where useful, including abstract, professional, or academic contexts. Keep definitions clear and concise; avoid obscure vocabulary and complexity for its own sake.',
	C2: 'Use natural phrasing across registers and fine distinctions where useful, with clear and concise definitions.',
};

/**
 * Builds the batch prompt for generating word meanings via AI.
 */
export function buildBatchPrompt(
	parsedWords: ParsedWord[],
	examplesPerMeaning: number,
	learnerLevel: LearnerLevel = 'A1',
): string {
	const wordsList = parsedWords
		.map(
			(pw, i) =>
				`${i + 1}. "${pw.word}" (${formatPartOfSpeech(pw.partOfSpeech)})`,
		)
		.join('\n')

	const definitionLevel = learnerLevel === 'A0' ? 'A1' : learnerLevel;

	return `You are an expert lexicographer creating adaptive vocabulary flashcards.

TASK: For EACH word below, generate 1 MAIN meaning. Customize the language based on the input word.

LEARNER LEVEL: ${learnerLevel}

WORDS:
${wordsList}

RULES:
1. **Language Detection & Output Language**:
   - If the input word is **English**: Generate definitions, examples, and word types in **English**. Set \`translation\` to a concise natural **Russian** translation and \`definitionExampleTranslation\` to a natural Russian translation of \`definitionExample\`.
   - If the input word is **Russian**: Generate definitions, examples, and word types in **Russian**. Set \`translation\` to a concise natural **English** translation and \`definitionExampleTranslation\` to a natural English translation of \`definitionExample\`.
   - If the input word is mixed or other: Default to English.
   - Examples in the definition MUST be in the same language as the definition.

2. **Level Adaptation**:
   - The learner is at ${learnerLevel === 'A0' ? 'absolute beginner level (A0 in this app)' : `CEFR ${learnerLevel}`}. Definitions and examples must not exceed CEFR ${definitionLevel} vocabulary and grammar, apart from the target word itself.
   - Guidance for ${learnerLevel}: ${LEVEL_GUIDANCE[learnerLevel]}
   - Keep the supplied target word and its most common meaning at every level. Adapt the surrounding vocabulary, grammar, and contexts; do not replace it with a harder word or choose a rarer meaning just because the level is higher.
   - The level is a ceiling, not a requirement to make every sentence difficult. Definitions must remain easier to understand than the target word.

3. **Meaning Limit**: Generate only 1 most common/important meaning per word.

4. **Part of Speech Constraint**:
   - If "(verb only)" is specified: Generate only verb definitions (or Russian "глагол").
   - If "(noun only)" is specified: Generate only noun definitions (or Russian "существительное").
   - If "(any part of speech)" is specified: Pick the most common part of speech.
   - ALL meanings for a word MUST be the SAME part of speech.

5. **Definition Style (COBUILD)**:
   - Use full sentence definitions where possible (e.g., "If you ____, you...").
   - **Blank in Definition**: ALWAYS replace the target word with "______" (6 underscores) in the \`definition\` field ONLY.
   - **Clarity**: The definition must be easier to understand than the word itself.
   - Include a real usage detail that makes the target word more appropriate than a likely synonym. Do not invent a strict difference where usage overlaps or reveal the target word or its forms.

6. **Examples (definitionExample and examples)**:
   - **NO BLANKS**: Do NOT use underscores in \`definitionExample\` or the \`examples\` array.
   - **BOLD TARGET**: ALWAYS wrap the target word (or its forms) with \`<b>\` tags in both \`definitionExample\` and the \`examples\` array.
   - Choose a natural situation or typical word combination in \`definitionExample\` so that the target is the most natural answer when hidden. Check the definition and hidden example together, and sharpen the context if a common synonym fits equally well.
   - Provide ${examplesPerMeaning} additional examples in the \`examples\` array.
   - Every additional example MUST use a different sentence and situation from \`definitionExample\` and all other examples. Never repeat the guessing example or make superficial variations of it.

7. **Transcription**:
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
        "translation": "бежать; бегать",
        "definitionExampleTranslation": "Я <b>бегаю</b> каждое утро, чтобы оставаться здоровым.",
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
        "translation": "book",
        "definitionExampleTranslation": "I am reading an interesting history book.",
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
			translation: meaning.translation || '',
			definitionExampleTranslation: meaning.definitionExampleTranslation || '',
			exampleType: meaning.exampleType || '',
			examples: uniqueAdditionalExamples(meaning.definitionExample || '', meaning.examples || []),
			transcription: (meaning.transcription || '')
				.replace(/\//g, '')
				.trim(),
		})),
	}))
}
