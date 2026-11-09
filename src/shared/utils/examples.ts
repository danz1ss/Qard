export function exampleKey(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, '');
}

/** Keep additional examples distinct from the guessing prompt and each other. */
export function uniqueAdditionalExamples(definitionExample: string, examples: string[]): string[] {
  const seen = new Set([exampleKey(definitionExample)]);
  return examples.filter((example) => {
    const normalized = exampleKey(example);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
