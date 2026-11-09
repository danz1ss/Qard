import { describe, expect, it } from 'vitest';
import { uniqueAdditionalExamples } from '../utils/examples';
import { parseBatchResponse } from '../ai-prompts';

describe('additional examples', () => {
  it('excludes the guessing sentence and duplicates despite formatting differences', () => {
    expect(uniqueAdditionalExamples('I <b>run</b> home.', [
      'I run home!', 'I&nbsp;<strong>run</strong> home.',
      'She <b>runs</b> daily.', ' SHE runs daily! ', '', '<b></b>',
      'They <b>run</b> to school.',
    ])).toEqual(['She <b>runs</b> daily.', 'They <b>run</b> to school.']);
  });

  it('filters generated data while preserving the primary example', () => {
    const meaning = parseBatchResponse(JSON.stringify([{ word: 'run', meanings: [{
      definition: 'To move quickly on foot.',
      definitionExample: 'I <b>run</b> home.',
      examples: ['I run home.', 'We <b>run</b> daily.', 'We run daily!'],
    }] }]))[0].meanings[0];
    expect(meaning.definitionExample).toBe('I <b>run</b> home.');
    expect(meaning.examples).toEqual(['We <b>run</b> daily.']);
  });
});
