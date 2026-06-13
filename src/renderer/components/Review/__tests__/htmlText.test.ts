import { describe, it, expect } from 'vitest';
import { stripTags, parseBold, blankOut, hasBold, isCorrect } from '../htmlText';

describe('stripTags', () => {
  it('removes tags, converts <br> to space, collapses whitespace', () => {
    expect(stripTags('line1<br>line2')).toBe('line1 line2');
    expect(stripTags('<b>bold</b> text')).toBe('bold text');
    expect(stripTags('a   b')).toBe('a b');
  });
  it('decodes common entities', () => {
    expect(stripTags('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripTags('a&nbsp;b')).toBe('a b');
  });
});

describe('parseBold', () => {
  it('splits into segments preserving surrounding spaces', () => {
    const segs = parseBold('She travels around the <b>world</b> every year.');
    expect(segs).toEqual([
      { text: 'She travels around the ', bold: false },
      { text: 'world', bold: true },
      { text: ' every year.', bold: false }
    ]);
  });
  it('handles text without bold as a single normal segment', () => {
    expect(parseBold('plain text')).toEqual([{ text: 'plain text', bold: false }]);
  });
  it('handles multiple bold spans', () => {
    const segs = parseBold('<b>a</b> and <b>b</b>');
    expect(segs).toEqual([
      { text: 'a', bold: true },
      { text: ' and ', bold: false },
      { text: 'b', bold: true }
    ]);
  });
});

describe('blankOut', () => {
  it('replaces <b>…</b> with the placeholder and strips other tags', () => {
    expect(blankOut('She saw the <b>world</b> today.')).toBe(
      'She saw the ______ today.'
    );
  });
  it('uses a custom placeholder', () => {
    expect(blankOut('<b>x</b> y', '[ ]')).toBe('[ ] y');
  });
  it('returns plain text unchanged when there is no bold', () => {
    expect(blankOut('no bold here')).toBe('no bold here');
  });
});

describe('hasBold', () => {
  it('detects a bold span', () => {
    expect(hasBold('a <b>b</b> c')).toBe(true);
    expect(hasBold('no bold')).toBe(false);
    expect(hasBold('')).toBe(false);
  });
});

describe('isCorrect', () => {
  it('compares case- and whitespace-insensitively', () => {
    expect(isCorrect('World', 'world')).toBe(true);
    expect(isCorrect('  world ', 'world')).toBe(true);
    expect(isCorrect('word', 'world')).toBe(false);
    expect(isCorrect('', 'world')).toBe(false);
  });
});
