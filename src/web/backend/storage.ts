import { get, set } from 'idb-keyval';

const DB_KEY = 'qard-collection-db';
export const BACKUP_PREFIX = 'qard-collection-db.bak-';

export async function loadDump(): Promise<Uint8Array | undefined> {
  const v = await get<Uint8Array>(DB_KEY);
  return v ? new Uint8Array(v) : undefined;
}

export async function saveDump(bytes: Uint8Array): Promise<void> {
  await set(DB_KEY, bytes);
}

export async function backupDump(bytes: Uint8Array): Promise<void> {
  await set(`${BACKUP_PREFIX}${Date.now()}`, bytes);
}

const DEBOUNCE_MS = 1000;

/**
 * Создаёт debounce-сохранятор: вызывается из CollectionService.onChange,
 * собирает export() и пишет в IndexedDB не чаще раза в секунду.
 */
export function createSaver(getBytes: () => Uint8Array): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const flush = () => {
    const bytes = getBytes();
    chain = chain.then(() => saveDump(bytes)).catch((e) => console.error('save failed', e));
  };
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };
}
