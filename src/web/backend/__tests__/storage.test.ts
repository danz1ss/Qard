// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDump, saveDump, saveMedia, loadMediaBase64 } from '../storage';
import { clear } from 'idb-keyval';

describe('web storage', () => {
  beforeEach(async () => { await clear(); });

  it('loadDump возвращает undefined на пустом хранилище', async () => {
    expect(await loadDump()).toBeUndefined();
  });

  it('saveDump/loadDump сохраняет и читает байты', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await saveDump(bytes);
    const got = await loadDump();
    expect(got).toBeInstanceOf(Uint8Array);
    expect(Array.from(got!)).toEqual([1, 2, 3, 4]);
  });

  it('сохраняет и возвращает импортированное медиа в base64', async () => {
    await saveMedia('hello.mp3', new Uint8Array([0, 1, 2, 253, 254, 255]));
    expect(await loadMediaBase64('hello.mp3')).toBe('AAEC/f7/');
    expect(await loadMediaBase64('missing.mp3')).toBeNull();
  });
});
