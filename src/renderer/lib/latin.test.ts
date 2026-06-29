import { describe, it, expect } from 'vitest';
import { sanitizeLatin } from './latin';

describe('sanitizeLatin', () => {
  it('убирает кириллицу', () => {
    expect(String(sanitizeLatin('helloпривет'))).toBe('hello');
  });
  it('разрешает пробел, дефис, апостроф', () => {
    expect(String(sanitizeLatin("well-being don't"))).toBe("well-being don't");
  });
  it('убирает цифры и прочие символы', () => {
    expect(String(sanitizeLatin('abc123!@#'))).toBe('abc');
  });
  it('флаг changed', () => {
    expect(sanitizeLatin('helloф').changed).toBe(true);
    expect(sanitizeLatin('hello').changed).toBe(false);
  });
});
