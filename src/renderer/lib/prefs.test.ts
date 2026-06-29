// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPref, savePref } from './prefs';

describe('prefs', () => {
  beforeEach(() => localStorage.clear());

  it('returns fallback when key missing', () => {
    expect(loadPref('qard:lang', 'ru')).toBe('ru');
  });

  it('persists and reads back a value', () => {
    savePref('qard:lang', 'en');
    expect(loadPref('qard:lang', 'ru')).toBe('en');
  });

  it('falls back on malformed JSON', () => {
    localStorage.setItem('qard:theme', '{not json');
    expect(loadPref('qard:theme', 'dark')).toBe('dark');
  });
});
