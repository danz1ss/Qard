import { describe, expect, it } from 'vitest';
import { PLACEMENT_QUESTIONS, recommendLevel, starterDeckName } from './placement';

const answersWith = (correctPerLevel: number[]) => {
  const remaining = { A1: correctPerLevel[0], A2: correctPerLevel[1], B1: correctPerLevel[2] };
  return PLACEMENT_QUESTIONS.map((question) =>
    remaining[question.level]-- > 0 ? question.correct : (question.correct + 1) % question.options.length,
  );
};

describe('Qard placement', () => {
  it('does not produce a level from an unfinished attempt', () => {
    expect(recommendLevel(answersWith([4, 4, 4]).slice(0, -1))).toBeNull();
  });

  it.each([
    [[0, 0, 0], 'A1'],
    [[4, 2, 1], 'A1'],
    [[4, 3, 2], 'A2'],
    [[3, 3, 3], 'B1'],
  ] as const)('recommends a starter level for %j', (scores, level) => {
    expect(recommendLevel(answersWith([...scores]))).toBe(level);
  });

  it('treats explicit unknown answers as a complete attempt', () => {
    expect(recommendLevel(PLACEMENT_QUESTIONS.map(() => null))).toBe('A1');
  });

  it('uses the highest available starter deck for advanced levels', () => {
    expect(starterDeckName('A2')).toBe('Vocabulary A2');
    expect(starterDeckName('C2')).toBe('Vocabulary B1');
  });
});
