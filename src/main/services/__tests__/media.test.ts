import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MediaService } from '../media.service';

describe('MediaService', () => {
  let dir: string;
  let media: MediaService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-test-'));
    media = new MediaService(dir);
    await media.init();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('saves and reads base64 audio', async () => {
    const data = Buffer.from('hello-audio').toString('base64');
    await media.save('a.mp3', data);
    expect(await media.getBase64('a.mp3')).toBe(data);
  });

  it('returns null for missing files', async () => {
    expect(await media.getBase64('missing.mp3')).toBeNull();
  });

  it('removes files, ignoring missing ones', async () => {
    await media.save('b.mp3', Buffer.from('x').toString('base64'));
    await media.remove(['b.mp3', 'never-existed.mp3']);
    expect(await media.getBase64('b.mp3')).toBeNull();
  });

  it('prevents path traversal', async () => {
    await media.save('../evil.mp3', Buffer.from('x').toString('base64'));
    // Файл должен лечь внутрь dir, а не наружу
    expect(await media.getBase64('evil.mp3')).not.toBeNull();
    const outside = path.join(dir, '..', 'evil.mp3');
    await expect(fs.access(outside)).rejects.toThrow();
  });
});
