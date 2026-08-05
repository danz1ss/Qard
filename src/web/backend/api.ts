import { CollectionService } from '../../main/services/collection.service';
import { SchedulerService } from '../../main/services/scheduler.service';
import type { ElectronAPI } from '../../renderer/global';
import { loadSqlJs } from './sqljs-loader';
import { loadDump, backupDump, createSaver, loadMediaBase64, saveMedia } from './storage';
import { webSettings } from './settings';
import { webAI } from './ai';
import { webTTS } from './tts';
import { exportBackup, importBackup } from './backup';
import { seedIfEmpty } from './seed';
import { parseAnkiPackage } from '../../shared/anki-package';
import { importParsedAnkiPackage } from '../../main/services/import.package';
import { ImportProgress } from '../../shared/types';

export interface WebBackend {
  api: ElectronAPI & { backup: { export: () => void; import: (f: File) => Promise<void> } };
  service: CollectionService;
}

/**
 * Инициализирует браузерный backend: грузит sql.js, открывает базу из
 * IndexedDB (битую — в бэкап и с нуля), сеет магнит-колоды, вешает
 * debounce-сохранение и возвращает реализацию контракта ElectronAPI.
 */
export async function initWebBackend(): Promise<WebBackend> {
  const SQL = await loadSqlJs();
  const service = new CollectionService();
  const dump = await loadDump();
  try {
    await service.init(dump, SQL);
  } catch (e) {
    console.error('DB corrupted, starting fresh:', e);
    if (dump) await backupDump(dump);
    await service.init(undefined, SQL);
  }
  await seedIfEmpty(service);

  const save = createSaver(() => service.export());
  service.setOnChange(save);

  const scheduler = new SchedulerService(service);
  const importListeners = new Set<(progress: ImportProgress) => void>();
  const emitImportProgress = (progress: ImportProgress) => {
    for (const listener of importListeners) listener(progress);
  };

  const api: WebBackend['api'] = {
    shell: {
      openExternal: async (url: string) => { window.open(url, '_blank', 'noopener'); },
    },
    ai: webAI,
    tts: webTTS,
    settings: webSettings,
    collection: {
      listDecks: async () => service.listDecks(Date.now()),
      createDeck: async (name: string) => service.createDeck(name),
      renameDeck: async (id: number, name: string) => service.renameDeck(id, name),
      deleteDeck: async (id: number) => { service.deleteDeck(id); },
      updateDeckLimits: async (id: number, n: number, r: number) => service.updateDeckLimits(id, n, r),
      addCards: async (deckId: number, cards: any[], _audio: any[]) => service.addCards(deckId, cards, Date.now()),
      updateCard: async (u: any) => service.updateCardText(u),
      deleteCards: async (ids: number[]) => { service.deleteCards(ids); },
      moveCards: async (ids: number[], deckId: number) => service.moveCards(ids, deckId),
      searchCards: async (q: any) => service.searchCards(q),
      getCard: async (id: number) => service.getCard(id),
      listWords: async (deckId: number) => service.listWords(deckId),
    },
    review: {
      getQueue: async (deckId: number) => scheduler.getQueue(deckId),
      answer: async (cardId: number, rating: any, forceReview?: boolean) =>
        scheduler.answer(cardId, rating, undefined, forceReview),
      previewIntervals: async (cardId: number) => scheduler.previewIntervals(cardId),
    },
    media: {
      getAudio: (filename: string) => loadMediaBase64(filename),
    },
    stats: {
      get: async () => service.getStudyStats(Date.now()),
    },
    importer: {
      getAnkiDecks: async () => [],
      run: async (_deckNames: string[]) => ({ imported: 0, skipped: 0, errors: 0 }),
      inspectFile: async (file) => (await parseAnkiPackage(file.data, { sqlJs: SQL })).decks,
      runFile: async (file, deckNames) => {
        const parsed = await parseAnkiPackage(file.data, { includeMedia: true, sqlJs: SQL });
        const fieldMapping = (await webSettings.get('fieldMapping')) || {};
        return importParsedAnkiPackage(
          service,
          parsed,
          deckNames,
          fieldMapping,
          saveMedia,
          emitImportProgress
        );
      },
      onProgress: (cb: (p: ImportProgress) => void) => {
        importListeners.add(cb);
        return () => importListeners.delete(cb);
      },
    },
    backup: {
      export: () => exportBackup(service),
      import: (f: File) => importBackup(f),
    },
  };

  return { api, service };
}
