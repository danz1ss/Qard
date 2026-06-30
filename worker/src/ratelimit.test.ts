import { describe, it, expect } from 'vitest';
import { dayKey, secondsUntilUtcMidnight, isRateLimited, markUsed, KVLike } from './ratelimit';

function fakeKV(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k)! : null; },
    async put(k, v) { store.set(k, v); },
  };
}

describe('ratelimit', () => {
  it('dayKey формирует ключ по IP и дате UTC', () => {
    const d = new Date('2026-06-30T12:00:00Z');
    expect(dayKey('1.2.3.4', d)).toBe('gen:1.2.3.4:2026-06-30');
  });

  it('secondsUntilUtcMidnight > 0 и <= 24ч', () => {
    const d = new Date('2026-06-30T23:00:00Z');
    const s = secondsUntilUtcMidnight(d);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(3600);
  });

  it('первый запрос не лимитирован, после markUsed — лимитирован', async () => {
    const kv = fakeKV();
    const ip = '9.9.9.9';
    const now = new Date('2026-06-30T08:00:00Z');
    expect(await isRateLimited(kv, ip, now)).toBe(false);
    await markUsed(kv, ip, now);
    expect(await isRateLimited(kv, ip, now)).toBe(true);
  });

  it('другой день — снова не лимитирован', async () => {
    const kv = fakeKV();
    const ip = '9.9.9.9';
    await markUsed(kv, ip, new Date('2026-06-30T08:00:00Z'));
    expect(await isRateLimited(kv, ip, new Date('2026-07-01T08:00:00Z'))).toBe(false);
  });
});
