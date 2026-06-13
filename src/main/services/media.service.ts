import { promises as fs } from 'fs';
import * as path from 'path';

export class MediaService {
  constructor(private dir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** basename защищает от path traversal. */
  private resolve(filename: string): string {
    return path.join(this.dir, path.basename(filename));
  }

  async save(filename: string, base64: string): Promise<void> {
    await fs.writeFile(this.resolve(filename), Buffer.from(base64, 'base64'));
  }

  async getBase64(filename: string): Promise<string | null> {
    try {
      const buf = await fs.readFile(this.resolve(filename));
      return buf.toString('base64');
    } catch {
      return null;
    }
  }

  async remove(filenames: string[]): Promise<void> {
    for (const f of filenames) {
      try {
        await fs.unlink(this.resolve(f));
      } catch {
        // отсутствующий файл — не ошибка
      }
    }
  }
}
