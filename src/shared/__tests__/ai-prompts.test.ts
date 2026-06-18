import { describe, it, expect } from 'vitest';
import { buildBatchPrompt, parseBatchResponse, buildMnemonicPrompt } from '../ai-prompts';
import { ParsedWord } from '../utils/wordParser';

describe('ai-prompts', () => {
  it('buildBatchPrompt включает слова и количество примеров', () => {
    const words: ParsedWord[] = [{ original: 'run', word: 'run', partOfSpeech: 'any' }];
    const p = buildBatchPrompt(words, 2);
    expect(p).toContain('run');
    expect(p).toContain('2 additional examples');
  });

  it('parseBatchResponse извлекает JSON-массив и чистит транскрипцию', () => {
    const raw = 'тут текст [{"word":"run","meanings":[{"wordType":"verb","definition":"d","definitionExample":"e","exampleType":"run","examples":["a"],"transcription":"/rʌn/"}]}] хвост';
    const res = parseBatchResponse(raw);
    expect(res).toHaveLength(1);
    expect(res[0].word).toBe('run');
    expect(res[0].meanings[0].transcription).toBe('rʌn');
  });

  it('parseBatchResponse бросает на отсутствие массива', () => {
    expect(() => parseBatchResponse('нет json')).toThrow();
  });

  it('buildMnemonicPrompt подставляет слово вместо прочерков', () => {
    const p = buildMnemonicPrompt('run', 'If you ______, you move fast', 'verb');
    expect(p).toContain('run');
    expect(p).not.toContain('______');
  });
});
