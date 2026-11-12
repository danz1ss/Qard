import { describe, expect, it } from 'vitest';
import { toInput } from './useSaveToCollection';

const primary = {
  id: 'bank',
  word: 'bank',
  wordType: 'noun',
  definition: 'Financial institution',
  definitionExample: 'She went to the bank.',
  examples: [],
};
const secondaryMeaning = {
  wordType: 'noun',
  definition: 'Land next to a river',
  definitionExample: 'We sat on the bank.',
  examples: [],
};

describe('generated card save', () => {
  it('saves the primary meaning by default', () => {
    const saved = toInput({ ...primary, secondaryMeaning });
    expect(saved.definition).toBe(primary.definition);
    expect(saved.secondaryMeaning).toBeUndefined();
  });

  it('includes the second meaning only when selected', () => {
    expect(toInput({ ...primary, secondaryMeaning, includeSecondaryMeaning: true }).secondaryMeaning)
      .toEqual(secondaryMeaning);
  });

  it('saves a single-meaning card', () => {
    expect(toInput(primary)).toMatchObject({ word: 'bank', definition: primary.definition });
    expect(toInput(primary).secondaryMeaning).toBeUndefined();
  });
});
