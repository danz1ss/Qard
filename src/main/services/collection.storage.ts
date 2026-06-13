import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CollectionService } from './collection.service';

const SAVE_DEBOUNCE_MS = 1000;

/**
 * Владеет файлом collection.db: загрузка при старте (битый файл → бэкап
 * и новая БД), дебаунс-сохранение при изменениях, атомарная запись
 * (tmp + rename), flush при выходе.
 */
export class CollectionStorage {
  readonly service = new CollectionService();
  private dbPath = path.join(app.getPath('userData'), 'collection.db');
  private timer: NodeJS.Timeout | null = null;
  private saving: Promise<void> = Promise.resolve();

  async open(): Promise<void> {
    let data: Uint8Array | undefined;
    try {
      data = new Uint8Array(await fs.readFile(this.dbPath));
    } catch {
      data = undefined;
    }
    try {
      await this.service.init(data);
    } catch (e) {
      console.error('Collection DB corrupted, starting fresh:', e);
      if (data) {
        await fs
          .rename(this.dbPath, `${this.dbPath}.bak-${Date.now()}`)
          .catch(() => {});
      }
      await this.service.init(undefined);
    }
    this.service.setOnChange(() => this.scheduleSave());
  }

  private scheduleSave(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.saving = this.saving
      .then(async () => {
        const bytes = Buffer.from(this.service.export());
        const tmp = `${this.dbPath}.tmp`;
        await fs.writeFile(tmp, bytes);
        await fs.rename(tmp, this.dbPath);
      })
      .catch((e) => {
        console.error('Failed to save collection:', e);
      });
    await this.saving;
  }
}
