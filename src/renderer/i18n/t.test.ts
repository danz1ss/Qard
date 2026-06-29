import { describe, it, expect } from 'vitest';
import { makeT } from './index';
import { en } from './en';
import { ru } from './ru';

describe('i18n t()', () => {
  it('returns ru string', () => {
    expect(makeT('ru')('nav.decks')).toBe('Колоды');
  });
  it('returns en string', () => {
    expect(makeT('en')('nav.decks')).toBe('Decks');
  });
  it('ru and en have identical key sets', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
  it('falls back to key when missing', () => {
    expect(makeT('ru')('does.not.exist' as any)).toBe('does.not.exist');
  });
});
