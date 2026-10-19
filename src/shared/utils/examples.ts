/** Keep additional examples distinct from the guessing prompt and each other. */
export function uniqueAdditionalExamples(definitionExample: string, examples: string[]): string[] {
  const key = (text: string) => text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, '');
  const seen = new Set([key(definitionExample)]);
  return examples.filter((example) => {
    const normalized = key(example);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
