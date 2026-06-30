export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export function dayKey(ip: string, now: Date): string {
  const d = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `gen:${ip}:${d}`;
}

export function secondsUntilUtcMidnight(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.floor((next - now.getTime()) / 1000));
}

export async function isRateLimited(kv: KVLike, ip: string, now: Date): Promise<boolean> {
  return (await kv.get(dayKey(ip, now))) !== null;
}

export async function markUsed(kv: KVLike, ip: string, now: Date): Promise<void> {
  await kv.put(dayKey(ip, now), '1', { expirationTtl: secondsUntilUtcMidnight(now) });
}
