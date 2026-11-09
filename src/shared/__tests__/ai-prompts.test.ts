import { describe, it, expect } from 'vitest';
import { buildBatchPrompt, parseBatchResponse } from '../ai-prompts';
import { LearnerLevel, ParsedWord } from '../types';

describe('ai-prompts', () => {
  it('buildBatchPrompt включает слова и количество примеров', () => {
    const words: ParsedWord[] = [{ original: 'run', word: 'run', partOfSpeech: 'any' }];
    const p = buildBatchPrompt(words, 2);
    expect(p).toContain('run');
    expect(p).toContain('Provide 2 additional examples');
  });

  it('buildBatchPrompt адаптирует контент к уровню ученика', () => {
    const words: ParsedWord[] = [{ original: 'house', word: 'house', partOfSpeech: 'any' }];
    const p = buildBatchPrompt(words, 1, 'A0');
    expect(p).toContain('LEARNER LEVEL: A0');
    expect(p).toContain('must not exceed CEFR A1');
    expect(p).toContain('definitionExampleTranslation');
  });

  it.each<LearnerLevel>(['A0', 'A1', 'A2', 'B1', 'B2', 'C1'])('applies only the selected %s guidance with shared card rules', (level) => {
    const prompt = buildBatchPrompt([{ original: 'decide', word: 'decide', partOfSpeech: 'any' }], 3, level);
    expect(prompt).toContain(`Guidance for ${level}:`);
    expect(prompt.match(/Guidance for /g)).toHaveLength(1);
    expect(prompt).toContain(`must not exceed CEFR ${level === 'A0' ? 'A1' : level}`);
    expect(prompt).toContain('Keep the supplied target word and its most common meaning');
    expect(prompt).toContain('Every additional example MUST use a different sentence and situation');
    expect(prompt).toContain('Provide 3 additional examples');
  });

  it('parseBatchResponse извлекает JSON-массив и чистит транскрипцию', () => {
    const raw = 'тут текст [{"word":"run","meanings":[{"wordType":"verb","definition":"d","definitionExample":"e","exampleType":"run","examples":["a"],"transcription":"/rʌn/"}]}] хвост';
    const res = parseBatchResponse(raw);
    expect(res).toHaveLength(1);
    expect(res[0].word).toBe('run');
    expect(res[0].meanings[0].transcription).toBe('rʌn');
  });

  it('parseBatchResponse сохраняет перевод и перевод примера', () => {
    const raw = '[{"word":"run","meanings":[{"wordType":"verb","definition":"d","definitionExample":"e","translation":"бежать","definitionExampleTranslation":"Я бегу.","examples":[],"transcription":"rʌn"}]}]';
    const meaning = parseBatchResponse(raw)[0].meanings[0];
    expect(meaning.translation).toBe('бежать');
    expect(meaning.definitionExampleTranslation).toBe('Я бегу.');
  });

  it('keeps two distinct meanings with their own guessing examples and removes repeated examples', () => {
    const primary = { wordType: 'noun', definition: 'Financial institution', translation: 'банк', definitionExample: 'I went to the <b>bank</b>.', examples: ['We sat on the bank of the river.'] };
    const duplicate = { ...primary, definition: 'A place that keeps your money.', definitionExample: 'The bank closes at five.' };
    const second = { wordType: 'noun', definition: 'Land next to a river', translation: 'берег', definitionExample: 'We sat on the <b>bank</b> of the river.', examples: ['I went to the bank.', 'They walked down the <b>bank</b>.'] };
    const third = { wordType: 'verb', definition: 'Tilt while turning', definitionExample: 'The pilot had to <b>bank</b>.' };
    const { meanings } = parseBatchResponse(JSON.stringify([{ word: 'bank', meanings: [primary, duplicate, second, third] }]))[0];
    expect(meanings.map(meaning => meaning.definitionExample)).toEqual([primary.definitionExample, second.definitionExample]);
    expect(meanings.map(meaning => meaning.examples)).toEqual([[], ['They walked down the <b>bank</b>.']]);
  });

  it('parseBatchResponse бросает на отсутствие массива', () => {
    expect(() => parseBatchResponse('нет json')).toThrow();
  });
});
