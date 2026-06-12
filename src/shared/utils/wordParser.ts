export type PartOfSpeech = 'verb' | 'noun' | 'any';

export interface ParsedWord {
  original: string;      // original input (e.g., "to run")
  word: string;          // clean word without markers (e.g., "run")
  partOfSpeech: PartOfSpeech;
}

/**
 * Parses a word input to detect part of speech from markers:
 * - "to run" → verb (infinitive marker)
 * - "a book", "an apple", "the house" → noun (article marker)
 * - "happy" (no marker) → any part of speech
 */
export function parseWord(input: string): ParsedWord {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Check for verb (to + word)
  if (lower.startsWith('to ')) {
    return {
      original: trimmed,
      word: trimmed.slice(3).trim(),
      partOfSpeech: 'verb'
    };
  }

  // Check for noun (a/an/the + word)
  const articleMatch = lower.match(/^(a |an |the )/);
  if (articleMatch) {
    return {
      original: trimmed,
      word: trimmed.slice(articleMatch[0].length).trim(),
      partOfSpeech: 'noun'
    };
  }

  // No marker - any part of speech
  return {
    original: trimmed,
    word: trimmed,
    partOfSpeech: 'any'
  };
}

/**
 * Parses multiple words and returns their parsed versions
 */
export function parseWords(inputs: string[]): ParsedWord[] {
  return inputs.map(parseWord);
}

/**
 * Formats part of speech for display in AI prompt
 */
export function formatPartOfSpeech(pos: PartOfSpeech): string {
  switch (pos) {
    case 'verb':
      return 'verb only';
    case 'noun':
      return 'noun only';
    case 'any':
      return 'any part of speech';
  }
}
