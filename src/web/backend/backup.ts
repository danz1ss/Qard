import { CollectionService } from '../../main/services/collection.service';
import { loadSqlJs } from './sqljs-loader';
import { saveDump } from './storage';

export function backupFilename(d: Date = new Date()): string {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `qard-backup-${iso}.qard`;
}

/** Экспорт текущего дампа БД в файл (скачивание). */
export function exportBackup(service: CollectionService): void {
  const bytes = service.export() as Uint8Array<ArrayBuffer>;
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Импорт дампа из файла: заменяет текущую базу. Вызывающий перезагружает UI.
 */
export async function importBackup(file: File): Promise<void> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const SQL = await loadSqlJs();
  // Валидация: пробуем открыть как sql.js базу
  const test = new SQL.Database(buf);
  test.run('SELECT 1');
  test.close();
  await saveDump(buf);
}
