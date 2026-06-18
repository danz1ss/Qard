// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { backupFilename } from '../backup';

describe('backup', () => {
  it('backupFilename содержит дату и расширение .qard', () => {
    const name = backupFilename(new Date('2026-06-18T10:00:00'));
    expect(name).toMatch(/^qard-backup-2026-06-18\.qard$/);
  });
});
