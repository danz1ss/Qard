import { describe, it, expect } from 'vitest';
import { toneSpec } from './sfx';

describe('toneSpec', () => {
  it('correct = две восходящие ноты', () => {
    const s = toneSpec('correct');
    expect(s.length).toBe(2);
    expect(s[1].freq).toBeGreaterThan(s[0].freq);
  });
  it('wrong = одна низкая нота', () => {
    const s = toneSpec('wrong');
    expect(s.length).toBe(1);
    expect(s[0].freq).toBeLessThan(300);
  });
  it('громкость тихая (<= 0.2)', () => {
    for (const n of [...toneSpec('correct'), ...toneSpec('wrong')]) {
      expect(n.gain).toBeLessThanOrEqual(0.2);
    }
  });
});
