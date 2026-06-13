# Built-in Anki Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить AnkiGenerator в самостоятельное Anki-приложение: локальные колоды и карточки (SQLite/sql.js), браузер с поиском, экран изучения с FSRS (ts-fsrs), разовый импорт из настоящего Anki; AnkiConnect-экспорт удаляется.

**Architecture:** Main-процесс получает слой данных (CollectionService поверх sql.js, in-memory + атомарная запись файла с дебаунсом), SchedulerService (ts-fsrs), MediaService (аудио в `userData/media/`), ImportService (AnkiConnect только для импорта). Renderer получает вкладки Decks/Browse, экран Review и сохранение сгенерированных карточек в локальную колоду. Сервисы тестируются vitest-юнитами без Electron (пути/байты инжектируются).

**Tech Stack:** Electron 28, React 18, zustand, webpack + ts-loader, sql.js (WASM SQLite), ts-fsrs (FSRS), vitest (юнит-тесты).

**Спека:** `docs/superpowers/specs/2026-06-13-anki-functionality-design.md`

---

## Контекст кодовой базы (прочитать перед началом)

- `src/main/index.ts` — точка входа main, регистрирует IPC-хендлеры.
- `src/main/preload.ts` — contextBridge API → `window.electronAPI`.
- `src/renderer/global.d.ts` — типы `window.electronAPI`.
- `src/shared/types/index.ts` — общие типы + `IPC_CHANNELS`.
- `src/renderer/store/index.ts` — zustand-стор.
- `webpack.config.js` — три конфига (main/preload/renderer); main имеет `externals: { electron }`.
- Сборка: `npm run build`; дев-запуск: `npm run dev`. Тестов в проекте пока нет.
- ВАЖНО: `audioData` в `GeneratedCard` приходит в renderer как `ArrayBuffer` (см. `useAddToAnki.ts:75-80` — там его конвертируют в base64; этот приём переиспользуем).

---

### Task 1: Зависимости и тестовая инфраструктура

**Files:**
- Modify: `package.json`
- Modify: `webpack.config.js`

- [ ] **Step 1: Установить зависимости**

```powershell
npm install sql.js ts-fsrs
npm install -D vitest
```

Проверить: в `node_modules/ts-fsrs/dist/index.d.ts` тип `Card` содержит поле `learning_steps` (есть в ts-fsrs v5+). Если его нет — обновить: `npm install ts-fsrs@latest`.
Проверить: `node_modules/sql.js/module.d.ts` существует (свои типы). Если TS позже не найдёт типы — `npm install -D @types/sql.js`.

- [ ] **Step 2: Добавить скрипт `test` в `package.json`**

```diff
 	"scripts": {
 		"dev": "webpack --config webpack.config.js --mode development && electron .",
 		"build": "webpack --config webpack.config.js --mode production",
 		"start": "electron .",
+		"test": "vitest run",
 		"package": "npm run build && electron-packager . AnkiGenerator --platform=win32 --arch=x64 --out=release --overwrite --icon=assets/icon.ico"
 	},
```

- [ ] **Step 3: sql.js в externals main-конфига webpack**

sql.js нельзя бандлить: его emscripten-обёртка в Node-режиме читает `sql-wasm.wasm` через `fs` относительно своей папки. Как external он останется обычным node-модулем (node_modules попадает в пакет electron-packager по умолчанию).

```diff
--- webpack.config.js
+++ webpack.config.js
@@ -6,7 +6,8 @@
   entry: './src/main/index.ts',
   target: 'electron-main',
   externals: {
-    electron: 'commonjs2 electron'
+    electron: 'commonjs2 electron',
+    'sql.js': 'commonjs2 sql.js'
   },
```

- [ ] **Step 4: Проверка**

Run: `npm run build` — Expected: успех без новых ошибок.
Run: `npm test` — Expected: «No test files found» (код выхода может быть 1 — это нормально на данном шаге).

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json webpack.config.js
git commit -m "chore: add sql.js, ts-fsrs, vitest"
```

---

### Task 2: Общие типы и IPC-каналы (аддитивно)

**Files:**
- Modify: `src/shared/types/index.ts`

Старые `ANKI_*` каналы и типы пока НЕ трогаем (удаляются в Task 14), чтобы каждый таск собирался.

- [ ] **Step 1: Добавить типы коллекции в конец `src/shared/types/index.ts` (перед `IPC_CHANNELS`)**

```ts
// ===== Local collection types =====

export interface Deck {
  id: number;
  name: string;
  newPerDay: number;
  reviewsPerDay: number;
  createdAt: number;
}

export interface DeckWithCounts extends Deck {
  newCount: number;
  learnCount: number;
  dueCount: number;
  totalCards: number;
}

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

export interface StoredCard {
  id: number;
  deckId: number;
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  audioFilename: string | null;
  tags: string;
  createdAt: number;
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface NewCardInput {
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  audioFilename?: string | null;
  tags?: string;
}

export interface CardTextUpdate {
  id: number;
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  tags: string;
}

export type CardStatusFilter = 'new' | 'learning' | 'review';

export interface CardSearchQuery {
  text?: string;
  deckId?: number;
  status?: CardStatusFilter;
  tag?: string;
  limit: number;
  offset: number;
}

export interface CardSearchResult {
  total: number;
  cards: StoredCard[];
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

export interface ReviewQueueState {
  current: StoredCard | null;
  newCount: number;
  learnCount: number;
  dueCount: number;
}

export interface IntervalPreviews {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

export interface AudioUpload {
  filename: string;
  data: string; // base64
}

export interface ImportDeckChoice {
  name: string;
  noteCount: number;
}

export interface ImportProgress {
  deck: string;
  done: number;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  finished: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}
```

- [ ] **Step 2: Добавить новые каналы в объект `IPC_CHANNELS` (после `SETTINGS_GET_ALL`, не забыть запятую)**

```ts
  // Local collection
  DECK_LIST: 'deck:list',
  DECK_CREATE: 'deck:create',
  DECK_RENAME: 'deck:rename',
  DECK_DELETE: 'deck:delete',
  DECK_UPDATE_LIMITS: 'deck:updateLimits',
  CARD_ADD: 'card:add',
  CARD_UPDATE: 'card:update',
  CARD_DELETE: 'card:delete',
  CARD_MOVE: 'card:move',
  CARD_SEARCH: 'card:search',
  CARD_GET: 'card:get',
  CARD_LIST_WORDS: 'card:listWords',
  REVIEW_GET_QUEUE: 'review:getQueue',
  REVIEW_ANSWER: 'review:answer',
  REVIEW_PREVIEW_INTERVALS: 'review:previewIntervals',
  MEDIA_GET_AUDIO: 'media:getAudio',
  IMPORT_GET_ANKI_DECKS: 'import:getAnkiDecks',
  IMPORT_RUN: 'import:run',
  IMPORT_PROGRESS: 'import:progress'
```

- [ ] **Step 3: Добавить `defaultDeckId` в `AppSettings` (строка ~52)**

```diff
 export interface AppSettings {
   geminiApiKey?: string;
   aiProvider?: string;
   aiModel?: string;
   aiBaseUrl?: string;
   selectedDeck?: string;
   selectedModel?: string;
+  defaultDeckId?: number;
   exampleCount: number;
   fieldMapping: FieldMapping;
 }
```

И в `src/main/services/settings.service.ts` — в interface `SettingsSchema` (после `selectedModel?: string;`) добавить строку `defaultDeckId?: number;`, а в `getAll()` (после строки с `selectedModel`) добавить `defaultDeckId: this.store.get('defaultDeckId'),`.

- [ ] **Step 4: Проверка и commit**

Run: `npm run build` — Expected: успех.

```powershell
git add src/shared/types/index.ts src/main/services/settings.service.ts
git commit -m "feat: add collection types and IPC channels"
```

---

### Task 3: CollectionService — БД, схема, CRUD колод (TDD)

**Files:**
- Create: `src/main/services/collection.service.ts`
- Test: `src/main/services/__tests__/collection.decks.test.ts`

CollectionService не зависит от Electron: `init(bytes?)` / `export()`. Файловая персистентность — отдельно (Task 8).

- [ ] **Step 1: Написать падающий тест `src/main/services/__tests__/collection.decks.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService } from '../collection.service';

describe('CollectionService: decks', () => {
  let col: CollectionService;

  beforeEach(async () => {
    col = new CollectionService();
    await col.init();
  });

  it('creates and lists decks', () => {
    const deck = col.createDeck('German');
    expect(deck.id).toBeGreaterThan(0);
    expect(deck.name).toBe('German');
    expect(deck.newPerDay).toBe(20);
    expect(deck.reviewsPerDay).toBe(200);

    const decks = col.listDecks(Date.now());
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe('German');
    expect(decks[0].totalCards).toBe(0);
    expect(decks[0].newCount).toBe(0);
  });

  it('rejects duplicate deck names', () => {
    col.createDeck('A');
    expect(() => col.createDeck('A')).toThrow();
  });

  it('finds deck by name', () => {
    const d = col.createDeck('B');
    expect(col.getDeckByName('B')?.id).toBe(d.id);
    expect(col.getDeckByName('nope')).toBeNull();
  });

  it('renames a deck', () => {
    const d = col.createDeck('Old');
    col.renameDeck(d.id, 'New');
    expect(col.getDeckByName('New')?.id).toBe(d.id);
  });

  it('updates limits', () => {
    const d = col.createDeck('L');
    col.updateDeckLimits(d.id, 5, 50);
    const found = col.listDecks(Date.now()).find((x) => x.id === d.id)!;
    expect(found.newPerDay).toBe(5);
    expect(found.reviewsPerDay).toBe(50);
  });

  it('deletes a deck', () => {
    const d = col.createDeck('Del');
    col.deleteDeck(d.id);
    expect(col.listDecks(Date.now())).toHaveLength(0);
  });

  it('survives export/import roundtrip', async () => {
    col.createDeck('Persist');
    const bytes = col.export();
    const col2 = new CollectionService();
    await col2.init(bytes);
    expect(col2.getDeckByName('Persist')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `Cannot find module '../collection.service'`.

- [ ] **Step 3: Создать `src/main/services/collection.service.ts`**

```ts
import initSqlJs, { Database } from 'sql.js';
import {
  CardSearchQuery,
  CardSearchResult,
  CardState,
  CardStatusFilter,
  CardTextUpdate,
  Deck,
  DeckWithCounts,
  NewCardInput,
  ReviewRating,
  StoredCard
} from '../../shared/types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  new_per_day INTEGER NOT NULL DEFAULT 20,
  reviews_per_day INTEGER NOT NULL DEFAULT 200,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  word_type TEXT NOT NULL DEFAULT '',
  definition TEXT NOT NULL DEFAULT '',
  definition_example TEXT NOT NULL DEFAULT '',
  transcription TEXT NOT NULL DEFAULT '',
  examples_json TEXT NOT NULL DEFAULT '[]',
  audio_filename TEXT,
  tags TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  due INTEGER NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, state, due);
CREATE INDEX IF NOT EXISTS idx_cards_word ON cards(word);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  state INTEGER NOT NULL,
  due INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  elapsed_days INTEGER NOT NULL,
  scheduled_days INTEGER NOT NULL,
  reviewed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_card ON review_log(card_id);
CREATE INDEX IF NOT EXISTS idx_log_time ON review_log(reviewed_at);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
`;

/** Начало локального дня (полночь) для timestamp в мс. */
export function dayStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Конец локального дня (следующая полночь, исключительно). */
export function dayEnd(now: number): number {
  return dayStart(now) + 24 * 60 * 60 * 1000;
}

function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&');
}

export interface SchedulingUpdate {
  id: number;
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: number;
}

export interface ReviewLogEntry {
  cardId: number;
  rating: ReviewRating;
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reviewedAt: number;
}

export class CollectionService {
  private db!: Database;
  private onChange: () => void = () => {};

  async init(data?: Uint8Array): Promise<void> {
    const SQL = await initSqlJs();
    this.db = data ? new SQL.Database(data) : new SQL.Database();
    this.db.run('PRAGMA foreign_keys = ON');
    this.db.run(SCHEMA);
  }

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }

  private mutated(): void {
    this.onChange();
  }

  private all(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  private one(sql: string, params: any[] = []): any | null {
    const rows = this.all(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // ===== Decks =====

  createDeck(name: string): Deck {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Deck name cannot be empty');
    }
    if (this.getDeckByName(trimmed)) {
      throw new Error(`Deck "${trimmed}" already exists`);
    }
    const createdAt = Date.now();
    this.db.run(
      'INSERT INTO decks (name, created_at) VALUES (?, ?)',
      [trimmed, createdAt]
    );
    const row = this.one('SELECT * FROM decks WHERE name = ?', [trimmed]);
    this.mutated();
    return this.rowToDeck(row);
  }

  getDeck(id: number): Deck | null {
    const row = this.one('SELECT * FROM decks WHERE id = ?', [id]);
    return row ? this.rowToDeck(row) : null;
  }

  getDeckByName(name: string): Deck | null {
    const row = this.one('SELECT * FROM decks WHERE name = ?', [name]);
    return row ? this.rowToDeck(row) : null;
  }

  renameDeck(id: number, name: string): void {
    this.db.run('UPDATE decks SET name = ? WHERE id = ?', [name.trim(), id]);
    this.mutated();
  }

  updateDeckLimits(id: number, newPerDay: number, reviewsPerDay: number): void {
    this.db.run(
      'UPDATE decks SET new_per_day = ?, reviews_per_day = ? WHERE id = ?',
      [newPerDay, reviewsPerDay, id]
    );
    this.mutated();
  }

  /** Удаляет колоду с карточками; возвращает осиротевшие аудиофайлы. */
  deleteDeck(id: number): string[] {
    const ids = this.all('SELECT id FROM cards WHERE deck_id = ?', [id]).map(
      (r) => r.id as number
    );
    const orphans = ids.length > 0 ? this.deleteCards(ids) : [];
    this.db.run('DELETE FROM decks WHERE id = ?', [id]);
    this.mutated();
    return orphans;
  }

  listDecks(now: number): DeckWithCounts[] {
    const ds = dayStart(now);
    const de = dayEnd(now);
    return this.all('SELECT * FROM decks ORDER BY name').map((row) => {
      const deck = this.rowToDeck(row);
      const totalCards = this.countCards(deck.id, [0, 1, 2, 3]);
      const newRemaining = Math.max(
        0,
        deck.newPerDay - this.newTakenToday(deck.id, ds)
      );
      const reviewsRemaining = Math.max(
        0,
        deck.reviewsPerDay - this.reviewsDoneToday(deck.id, ds)
      );
      return {
        ...deck,
        totalCards,
        newCount: Math.min(newRemaining, this.countCards(deck.id, [CardState.New])),
        learnCount: this.countCards(
          deck.id,
          [CardState.Learning, CardState.Relearning],
          de
        ),
        dueCount: Math.min(
          reviewsRemaining,
          this.countCards(deck.id, [CardState.Review], de)
        )
      };
    });
  }

  private rowToDeck(row: any): Deck {
    return {
      id: row.id,
      name: row.name,
      newPerDay: row.new_per_day,
      reviewsPerDay: row.reviews_per_day,
      createdAt: row.created_at
    };
  }

  // ===== Cards (Task 4) =====

  countCards(deckId: number, states: CardState[] | number[], dueBefore?: number): number {
    const placeholders = states.map(() => '?').join(',');
    let sql = `SELECT COUNT(*) AS n FROM cards WHERE deck_id = ? AND state IN (${placeholders})`;
    const params: any[] = [deckId, ...states];
    if (dueBefore !== undefined) {
      sql += ' AND due < ?';
      params.push(dueBefore);
    }
    return this.one(sql, params)!.n as number;
  }

  newTakenToday(deckId: number, dayStartMs: number): number {
    return this.one(
      `SELECT COUNT(*) AS n FROM review_log rl
       JOIN cards c ON c.id = rl.card_id
       WHERE c.deck_id = ? AND rl.state = 0 AND rl.reviewed_at >= ?`,
      [deckId, dayStartMs]
    )!.n as number;
  }

  reviewsDoneToday(deckId: number, dayStartMs: number): number {
    return this.one(
      `SELECT COUNT(*) AS n FROM review_log rl
       JOIN cards c ON c.id = rl.card_id
       WHERE c.deck_id = ? AND rl.state = 2 AND rl.reviewed_at >= ?`,
      [deckId, dayStartMs]
    )!.n as number;
  }
}
```

(Методы карточек добавляются в Task 4; `deleteCards` пока объявить заглушкой, чтобы компилировалось:)

```ts
  deleteCards(_ids: number[]): string[] {
    throw new Error('not implemented yet (Task 4)');
  }
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS все 7 тестов `collection.decks.test.ts`.

- [ ] **Step 5: Commit**

```powershell
git add src/main/services/collection.service.ts src/main/services/__tests__/collection.decks.test.ts
git commit -m "feat: CollectionService with sql.js schema and deck CRUD"
```

---

### Task 4: CollectionService — CRUD карточек и поиск (TDD)

**Files:**
- Modify: `src/main/services/collection.service.ts`
- Test: `src/main/services/__tests__/collection.cards.test.ts`

- [ ] **Step 1: Написать падающий тест `src/main/services/__tests__/collection.cards.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService } from '../collection.service';
import { CardState, NewCardInput } from '../../../shared/types';

function input(word: string, extra: Partial<NewCardInput> = {}): NewCardInput {
  return {
    word,
    wordType: 'noun',
    definition: `def of ${word}`,
    definitionExample: '',
    transcription: '',
    examples: [`${word} example`],
    ...extra
  };
}

describe('CollectionService: cards', () => {
  let col: CollectionService;
  let deckId: number;

  beforeEach(async () => {
    col = new CollectionService();
    await col.init();
    deckId = col.createDeck('D').id;
  });

  it('adds cards as new with due=now', () => {
    const now = Date.now();
    const ids = col.addCards(deckId, [input('hello'), input('world')], now);
    expect(ids).toHaveLength(2);
    const card = col.getCard(ids[0])!;
    expect(card.word).toBe('hello');
    expect(card.state).toBe(CardState.New);
    expect(card.due).toBe(now);
    expect(card.examples).toEqual(['hello example']);
  });

  it('updates text fields', () => {
    const [id] = col.addCards(deckId, [input('old')], Date.now());
    col.updateCardText({
      id,
      word: 'new',
      wordType: 'verb',
      definition: 'changed',
      definitionExample: 'dx',
      transcription: 'tr',
      examples: ['e1', 'e2'],
      tags: 'tag1 tag2'
    });
    const card = col.getCard(id)!;
    expect(card.word).toBe('new');
    expect(card.examples).toEqual(['e1', 'e2']);
    expect(card.tags).toBe('tag1 tag2');
  });

  it('deletes cards and reports orphaned audio', () => {
    const ids = col.addCards(
      deckId,
      [
        input('a', { audioFilename: 'a.mp3' }),
        input('b', { audioFilename: 'shared.mp3' }),
        input('c', { audioFilename: 'shared.mp3' })
      ],
      Date.now()
    );
    const orphans = col.deleteCards([ids[0], ids[1]]);
    expect(orphans).toEqual(['a.mp3']); // shared.mp3 ещё используется карточкой c
    expect(col.getCard(ids[0])).toBeNull();
  });

  it('moves cards between decks', () => {
    const other = col.createDeck('Other').id;
    const ids = col.addCards(deckId, [input('m')], Date.now());
    col.moveCards(ids, other);
    expect(col.getCard(ids[0])!.deckId).toBe(other);
  });

  it('searches by text', () => {
    col.addCards(deckId, [input('apple'), input('banana')], Date.now());
    const r = col.searchCards({ text: 'appl', limit: 50, offset: 0 });
    expect(r.total).toBe(1);
    expect(r.cards[0].word).toBe('apple');
  });

  it('searches with deck/status/tag filters and pagination', () => {
    const other = col.createDeck('Other2').id;
    col.addCards(deckId, [input('x1'), input('x2', { tags: 'verbs' })], Date.now());
    col.addCards(other, [input('x3')], Date.now());

    expect(col.searchCards({ deckId, limit: 50, offset: 0 }).total).toBe(2);
    expect(col.searchCards({ status: 'new', limit: 50, offset: 0 }).total).toBe(3);
    expect(col.searchCards({ status: 'review', limit: 50, offset: 0 }).total).toBe(0);
    expect(col.searchCards({ tag: 'verbs', limit: 50, offset: 0 }).cards[0].word).toBe('x2');

    const page = col.searchCards({ limit: 2, offset: 2 });
    expect(page.total).toBe(3);
    expect(page.cards).toHaveLength(1);
  });

  it('escapes LIKE wildcards in text search', () => {
    col.addCards(deckId, [input('100%'), input('100x')], Date.now());
    const r = col.searchCards({ text: '100%', limit: 50, offset: 0 });
    expect(r.total).toBe(1);
  });

  it('lists words of a deck lowercased', () => {
    col.addCards(deckId, [input('Apple')], Date.now());
    expect(col.listWords(deckId)).toEqual(['apple']);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `addCards is not a function` (и т.п.).

- [ ] **Step 3: Добавить методы карточек в `CollectionService` (заменить заглушку `deleteCards`)**

```ts
  // ===== Cards =====

  addCards(deckId: number, inputs: NewCardInput[], now: number): number[] {
    const ids: number[] = [];
    for (const c of inputs) {
      this.db.run(
        `INSERT INTO cards (
          deck_id, word, word_type, definition, definition_example,
          transcription, examples_json, audio_filename, tags, created_at, due
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deckId,
          c.word,
          c.wordType,
          c.definition,
          c.definitionExample,
          c.transcription,
          JSON.stringify(c.examples),
          c.audioFilename ?? null,
          c.tags ?? '',
          now,
          now
        ]
      );
      ids.push(this.one('SELECT last_insert_rowid() AS id')!.id as number);
    }
    if (inputs.length > 0) {
      this.mutated();
    }
    return ids;
  }

  getCard(id: number): StoredCard | null {
    const row = this.one('SELECT * FROM cards WHERE id = ?', [id]);
    return row ? this.rowToCard(row) : null;
  }

  updateCardText(u: CardTextUpdate): void {
    this.db.run(
      `UPDATE cards SET word = ?, word_type = ?, definition = ?,
        definition_example = ?, transcription = ?, examples_json = ?, tags = ?
       WHERE id = ?`,
      [
        u.word,
        u.wordType,
        u.definition,
        u.definitionExample,
        u.transcription,
        JSON.stringify(u.examples),
        u.tags,
        u.id
      ]
    );
    this.mutated();
  }

  /** Удаляет карточки; возвращает аудиофайлы, на которые больше никто не ссылается. */
  deleteCards(ids: number[]): string[] {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const audio = this.all(
      `SELECT DISTINCT audio_filename FROM cards
       WHERE id IN (${placeholders}) AND audio_filename IS NOT NULL`,
      ids
    ).map((r) => r.audio_filename as string);

    this.db.run(`DELETE FROM cards WHERE id IN (${placeholders})`, ids);

    const orphans = audio.filter((f) => {
      const still = this.one(
        'SELECT COUNT(*) AS n FROM cards WHERE audio_filename = ?',
        [f]
      )!.n as number;
      return still === 0;
    });
    this.mutated();
    return orphans;
  }

  moveCards(ids: number[], deckId: number): void {
    if (ids.length === 0) {
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    this.db.run(`UPDATE cards SET deck_id = ? WHERE id IN (${placeholders})`, [
      deckId,
      ...ids
    ]);
    this.mutated();
  }

  searchCards(q: CardSearchQuery): CardSearchResult {
    const where: string[] = [];
    const params: any[] = [];

    if (q.text) {
      const like = `%${likeEscape(q.text)}%`;
      where.push(
        `(word LIKE ? ESCAPE '\\' OR definition LIKE ? ESCAPE '\\'
          OR definition_example LIKE ? ESCAPE '\\' OR examples_json LIKE ? ESCAPE '\\')`
      );
      params.push(like, like, like, like);
    }
    if (q.deckId !== undefined) {
      where.push('deck_id = ?');
      params.push(q.deckId);
    }
    if (q.status) {
      const states: Record<CardStatusFilter, string> = {
        new: '(0)',
        learning: '(1,3)',
        review: '(2)'
      };
      where.push(`state IN ${states[q.status]}`);
    }
    if (q.tag) {
      where.push(`(' ' || tags || ' ') LIKE ? ESCAPE '\\'`);
      params.push(`% ${likeEscape(q.tag)} %`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = this.one(
      `SELECT COUNT(*) AS n FROM cards ${whereSql}`,
      params
    )!.n as number;
    const cards = this.all(
      `SELECT * FROM cards ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, q.offset]
    ).map((r) => this.rowToCard(r));

    return { total, cards };
  }

  listWords(deckId: number): string[] {
    return this.all('SELECT word FROM cards WHERE deck_id = ?', [deckId]).map(
      (r) => (r.word as string).toLowerCase()
    );
  }

  /** Ключи "word definition" (lowercase) для дедупликации импорта. */
  listCardKeys(deckId: number): string[] {
    return this.all(
      'SELECT word, definition FROM cards WHERE deck_id = ?',
      [deckId]
    ).map(
      (r) =>
        `${(r.word as string).toLowerCase()} ${(r.definition as string).toLowerCase()}`
    );
  }

  /** Следующая карточка в заданных состояниях; orderBy 'due' или 'id'. */
  nextCard(
    deckId: number,
    states: CardState[],
    dueBefore: number | undefined,
    orderBy: 'due' | 'id'
  ): StoredCard | null {
    const placeholders = states.map(() => '?').join(',');
    let sql = `SELECT * FROM cards WHERE deck_id = ? AND state IN (${placeholders})`;
    const params: any[] = [deckId, ...states];
    if (dueBefore !== undefined) {
      sql += ' AND due < ?';
      params.push(dueBefore);
    }
    sql += ` ORDER BY ${orderBy === 'due' ? 'due' : 'id'} LIMIT 1`;
    const row = this.one(sql, params);
    return row ? this.rowToCard(row) : null;
  }

  applyAnswer(u: SchedulingUpdate, log: ReviewLogEntry): void {
    this.db.run(
      `UPDATE cards SET state = ?, due = ?, stability = ?, difficulty = ?,
        elapsed_days = ?, scheduled_days = ?, learning_steps = ?, reps = ?,
        lapses = ?, last_review = ?
       WHERE id = ?`,
      [
        u.state,
        u.due,
        u.stability,
        u.difficulty,
        u.elapsedDays,
        u.scheduledDays,
        u.learningSteps,
        u.reps,
        u.lapses,
        u.lastReview,
        u.id
      ]
    );
    this.db.run(
      `INSERT INTO review_log (
        card_id, rating, state, due, stability, difficulty,
        elapsed_days, scheduled_days, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.cardId,
        log.rating,
        log.state,
        log.due,
        log.stability,
        log.difficulty,
        log.elapsedDays,
        log.scheduledDays,
        log.reviewedAt
      ]
    );
    this.mutated();
  }

  private rowToCard(row: any): StoredCard {
    return {
      id: row.id,
      deckId: row.deck_id,
      word: row.word,
      wordType: row.word_type,
      definition: row.definition,
      definitionExample: row.definition_example,
      transcription: row.transcription,
      examples: JSON.parse(row.examples_json),
      audioFilename: row.audio_filename ?? null,
      tags: row.tags,
      createdAt: row.created_at,
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty,
      elapsedDays: row.elapsed_days,
      scheduledDays: row.scheduled_days,
      learningSteps: row.learning_steps,
      reps: row.reps,
      lapses: row.lapses,
      lastReview: row.last_review ?? null
    };
  }
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS все тесты обоих файлов.

- [ ] **Step 5: Commit**

```powershell
git add src/main/services/collection.service.ts src/main/services/__tests__/collection.cards.test.ts
git commit -m "feat: card CRUD and search in CollectionService"
```

---

### Task 5: SchedulerService — FSRS-очередь и ответы (TDD)

**Files:**
- Create: `src/main/services/scheduler.service.ts`
- Test: `src/main/services/__tests__/scheduler.test.ts`

- [ ] **Step 1: Написать падающий тест `src/main/services/__tests__/scheduler.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService } from '../collection.service';
import { SchedulerService, formatInterval } from '../scheduler.service';
import { CardState, NewCardInput } from '../../../shared/types';

const DAY = 24 * 60 * 60 * 1000;

function input(word: string): NewCardInput {
  return {
    word,
    wordType: '',
    definition: 'd',
    definitionExample: '',
    transcription: '',
    examples: []
  };
}

describe('SchedulerService', () => {
  let col: CollectionService;
  let sched: SchedulerService;
  let deckId: number;
  // Фиксированный "сейчас": полдень, чтобы дневные границы были стабильны
  const t0 = new Date(2026, 5, 13, 12, 0, 0).getTime();

  beforeEach(async () => {
    col = new CollectionService();
    await col.init();
    deckId = col.createDeck('D').id;
    sched = new SchedulerService(col);
  });

  it('serves new cards and respects daily new limit', () => {
    col.updateDeckLimits(deckId, 2, 200);
    col.addCards(deckId, [input('a'), input('b'), input('c')], t0);

    let q = sched.getQueue(deckId, t0);
    expect(q.newCount).toBe(2); // лимит 2, хотя новых 3
    expect(q.current!.state).toBe(CardState.New);

    // Отвечаем Good на 2 новые
    q = sched.answer(q.current!.id, 3, t0);
    expect(q.current).not.toBeNull();
    q = sched.answer(q.current!.id, 3, t0 + 1000);

    // Лимит новых исчерпан: третью новую не предлагает
    expect(q.newCount).toBe(0);
    if (q.current) {
      expect(q.current.state).not.toBe(CardState.New);
    }
  });

  it('moves a new card into learning and grows intervals with Good', () => {
    col.addCards(deckId, [input('w')], t0);
    let q = sched.getQueue(deckId, t0);
    const id = q.current!.id;

    sched.answer(id, 3, t0);
    const afterFirst = col.getCard(id)!;
    expect(afterFirst.state).not.toBe(CardState.New);
    expect(afterFirst.due).toBeGreaterThan(t0);
    expect(afterFirst.reps).toBe(1);

    // Отвечаем Good в момент очередного due, пока карточка не станет Review
    let card = afterFirst;
    for (let i = 0; i < 5 && card.state !== CardState.Review; i++) {
      sched.answer(id, 3, card.due);
      card = col.getCard(id)!;
    }
    expect(card.state).toBe(CardState.Review);
    const firstReviewInterval = card.scheduledDays;
    expect(firstReviewInterval).toBeGreaterThanOrEqual(1);

    // Ещё один Good в момент due: интервал растёт
    sched.answer(id, 3, card.due);
    const next = col.getCard(id)!;
    expect(next.scheduledDays).toBeGreaterThan(firstReviewInterval);
  });

  it('Again on a review card increments lapses and re-enters relearning', () => {
    col.addCards(deckId, [input('w')], t0);
    const id = sched.getQueue(deckId, t0).current!.id;
    // Easy сразу обычно отправляет карточку в Review
    sched.answer(id, 4, t0);
    let card = col.getCard(id)!;
    for (let i = 0; i < 5 && card.state !== CardState.Review; i++) {
      sched.answer(id, 3, card.due);
      card = col.getCard(id)!;
    }
    expect(card.state).toBe(CardState.Review);

    sched.answer(id, 1, card.due);
    const lapsed = col.getCard(id)!;
    expect(lapsed.lapses).toBe(card.lapses + 1);
    expect(lapsed.state).not.toBe(CardState.Review);
  });

  it('returns null current when queue is empty', () => {
    const q = sched.getQueue(deckId, t0);
    expect(q.current).toBeNull();
    expect(q.newCount + q.learnCount + q.dueCount).toBe(0);
  });

  it('previewIntervals returns 4 human-readable intervals', () => {
    col.addCards(deckId, [input('w')], t0);
    const id = sched.getQueue(deckId, t0).current!.id;
    const p = sched.previewIntervals(id, t0);
    expect(p.again.length).toBeGreaterThan(0);
    expect(p.hard.length).toBeGreaterThan(0);
    expect(p.good.length).toBeGreaterThan(0);
    expect(p.easy.length).toBeGreaterThan(0);
  });

  it('writes review_log so reviews count toward daily limits', () => {
    col.updateDeckLimits(deckId, 20, 1);
    col.addCards(deckId, [input('a'), input('b')], t0 - 60 * DAY);
    // Превращаем обе в review-карточки с due в прошлом
    for (const w of col.searchCards({ deckId, limit: 10, offset: 0 }).cards) {
      sched.answer(w.id, 4, t0 - 60 * DAY); // Easy → Review
    }
    // Сдвигаем время к due
    const cards = col.searchCards({ deckId, limit: 10, offset: 0 }).cards;
    const later = Math.max(...cards.map((c) => c.due)) + DAY;

    let q = sched.getQueue(deckId, later);
    expect(q.dueCount).toBe(1); // лимит 1 повторение в день
    q = sched.answer(q.current!.id, 3, later);
    expect(q.dueCount).toBe(0);
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours, days, months', () => {
    expect(formatInterval(5 * 60 * 1000)).toBe('5 мин');
    expect(formatInterval(3 * 60 * 60 * 1000)).toBe('3 ч');
    expect(formatInterval(4 * DAY)).toBe('4 дн');
    expect(formatInterval(60 * DAY)).toMatch(/мес/);
    expect(formatInterval(800 * DAY)).toMatch(/г/);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `Cannot find module '../scheduler.service'`.

- [ ] **Step 3: Создать `src/main/services/scheduler.service.ts`**

```ts
import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade
} from 'ts-fsrs';
import {
  CollectionService,
  dayEnd,
  dayStart
} from './collection.service';
import {
  CardState,
  IntervalPreviews,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../../shared/types';

export function formatInterval(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) {
    return '<1 мин';
  }
  if (min < 60) {
    return `${min} мин`;
  }
  const hours = Math.round(min / 60);
  if (hours < 24) {
    return `${hours} ч`;
  }
  const days = Math.round(ms / 86400000);
  if (days < 30) {
    return `${days} дн`;
  }
  const months = ms / (86400000 * 30.44);
  if (months < 12) {
    return `${months.toFixed(1)} мес`;
  }
  return `${(ms / (86400000 * 365.25)).toFixed(1)} г`;
}

export class SchedulerService {
  private f = fsrs(generatorParameters({ enable_fuzz: true }));

  constructor(private col: CollectionService) {}

  private toFsrs(c: StoredCard): FsrsCard {
    return {
      due: new Date(c.due),
      stability: c.stability,
      difficulty: c.difficulty,
      elapsed_days: c.elapsedDays,
      scheduled_days: c.scheduledDays,
      learning_steps: c.learningSteps,
      reps: c.reps,
      lapses: c.lapses,
      state: c.state as unknown as State,
      last_review: c.lastReview !== null ? new Date(c.lastReview) : undefined
    };
  }

  getQueue(deckId: number, now: number = Date.now()): ReviewQueueState {
    const deck = this.col.getDeck(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    const ds = dayStart(now);
    const de = dayEnd(now);

    const newRemaining = Math.max(
      0,
      deck.newPerDay - this.col.newTakenToday(deckId, ds)
    );
    const reviewsRemaining = Math.max(
      0,
      deck.reviewsPerDay - this.col.reviewsDoneToday(deckId, ds)
    );

    const learnCount = this.col.countCards(
      deckId,
      [CardState.Learning, CardState.Relearning],
      de
    );
    const newCount = Math.min(
      newRemaining,
      this.col.countCards(deckId, [CardState.New])
    );
    const dueCount = Math.min(
      reviewsRemaining,
      this.col.countCards(deckId, [CardState.Review], de)
    );

    // Порядок: learning (готовые сейчас) → новые → review → learning "вперёд"
    const current =
      this.col.nextCard(
        deckId,
        [CardState.Learning, CardState.Relearning],
        now,
        'due'
      ) ??
      (newCount > 0
        ? this.col.nextCard(deckId, [CardState.New], undefined, 'id')
        : null) ??
      (dueCount > 0
        ? this.col.nextCard(deckId, [CardState.Review], de, 'due')
        : null) ??
      this.col.nextCard(
        deckId,
        [CardState.Learning, CardState.Relearning],
        de,
        'due'
      );

    return { current, newCount, learnCount, dueCount };
  }

  answer(
    cardId: number,
    rating: ReviewRating,
    now: number = Date.now()
  ): ReviewQueueState {
    const row = this.col.getCard(cardId);
    if (!row) {
      throw new Error(`Card ${cardId} not found`);
    }
    const item = this.f.next(this.toFsrs(row), new Date(now), rating as Grade);

    this.col.applyAnswer(
      {
        id: cardId,
        state: item.card.state as unknown as CardState,
        due: item.card.due.getTime(),
        stability: item.card.stability,
        difficulty: item.card.difficulty,
        elapsedDays: item.card.elapsed_days,
        scheduledDays: item.card.scheduled_days,
        learningSteps: item.card.learning_steps,
        reps: item.card.reps,
        lapses: item.card.lapses,
        lastReview: now
      },
      {
        cardId,
        rating,
        state: row.state,
        due: row.due,
        stability: row.stability,
        difficulty: row.difficulty,
        elapsedDays: item.log.elapsed_days,
        scheduledDays: item.log.scheduled_days,
        reviewedAt: now
      }
    );

    return this.getQueue(row.deckId, now);
  }

  previewIntervals(cardId: number, now: number = Date.now()): IntervalPreviews {
    const row = this.col.getCard(cardId);
    if (!row) {
      throw new Error(`Card ${cardId} not found`);
    }
    const rec = this.f.repeat(this.toFsrs(row), new Date(now));
    const fmt = (r: Grade) =>
      formatInterval(rec[r].card.due.getTime() - now);
    return {
      again: fmt(Rating.Again),
      hard: fmt(Rating.Hard),
      good: fmt(Rating.Good),
      easy: fmt(Rating.Easy)
    };
  }
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS все тесты. Если TS ругается на `learning_steps` или `Grade` — версия ts-fsrs старая, обновить (`npm i ts-fsrs@latest`) и перезапустить.

- [ ] **Step 5: Commit**

```powershell
git add src/main/services/scheduler.service.ts src/main/services/__tests__/scheduler.test.ts
git commit -m "feat: FSRS scheduler with queue, answers and interval previews"
```

---

### Task 6: MediaService (TDD)

**Files:**
- Create: `src/main/services/media.service.ts`
- Test: `src/main/services/__tests__/media.test.ts`

- [ ] **Step 1: Написать падающий тест `src/main/services/__tests__/media.test.ts`**

```ts
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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `Cannot find module '../media.service'`.

- [ ] **Step 3: Создать `src/main/services/media.service.ts`**

```ts
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
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main/services/media.service.ts src/main/services/__tests__/media.test.ts
git commit -m "feat: MediaService for local audio storage"
```

---

### Task 7: Импорт из Anki — маппер (TDD), расширение AnkiConnect, ImportService

**Files:**
- Create: `src/main/services/import.mapper.ts`
- Create: `src/main/services/import.service.ts`
- Modify: `src/main/services/anki-connect.service.ts`
- Test: `src/main/services/__tests__/import.mapper.test.ts`

- [ ] **Step 1: Написать падающий тест `src/main/services/__tests__/import.mapper.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mapNoteFields } from '../import.mapper';
import { DataSource, FieldMapping } from '../../../shared/types';

const mapping: FieldMapping = {
  Word: DataSource.Word,
  'Word Type': DataSource.WordType,
  Definition: DataSource.Definition,
  'Definition Example': DataSource.DefinitionExample,
  Transcription: DataSource.Transcription,
  'Example(s)': DataSource.Examples,
  'Word Audio': DataSource.WordAudio,
  Extra: DataSource.None
};

describe('mapNoteFields', () => {
  it('maps fields through fieldMapping', () => {
    const res = mapNoteFields(
      {
        Word: 'hello',
        'Word Type': 'noun',
        Definition: 'a greeting',
        'Definition Example': 'Hello there!',
        Transcription: '/həˈloʊ/',
        'Example(s)': 'Hello world<br>Hello again',
        'Word Audio': '[sound:hello_123.mp3]',
        Extra: 'ignored'
      },
      mapping
    );
    expect(res).not.toBeNull();
    expect(res!.card.word).toBe('hello');
    expect(res!.card.wordType).toBe('noun');
    expect(res!.card.definition).toBe('a greeting');
    expect(res!.card.examples).toEqual(['Hello world', 'Hello again']);
    expect(res!.card.audioFilename).toBe('hello_123.mp3');
    expect(res!.audioRef).toBe('hello_123.mp3');
    expect(res!.card.tags).toBe('imported');
  });

  it('strips html from text fields', () => {
    const res = mapNoteFields(
      { Word: '<b>bold</b>', Definition: 'line1<br>line2' },
      mapping
    );
    expect(res!.card.word).toBe('bold');
    expect(res!.card.definition).toBe('line1\nline2');
  });

  it('falls back to first field as word when nothing maps', () => {
    const res = mapNoteFields(
      { Front: 'fallback word', Back: 'meaning', Note: 'extra' },
      {} // пустой fieldMapping
    );
    expect(res!.card.word).toBe('fallback word');
    expect(res!.card.definition).toContain('meaning');
    expect(res!.card.definition).toContain('extra');
  });

  it('returns null when note has no usable word', () => {
    expect(mapNoteFields({}, mapping)).toBeNull();
    expect(mapNoteFields({ Word: '   ' }, mapping)).toBeNull();
  });

  it('strips [sound:...] from fallback text', () => {
    const res = mapNoteFields({ Front: 'word [sound:a.mp3]' }, {});
    expect(res!.card.word).toBe('word');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `Cannot find module '../import.mapper'`.

- [ ] **Step 3: Создать `src/main/services/import.mapper.ts`**

```ts
import { DataSource, FieldMapping, NewCardInput } from '../../shared/types';

export interface MappedNote {
  card: NewCardInput;
  audioRef: string | null;
}

const SOUND = /\[sound:([^\]]+)\]/;
const SOUND_ALL = /\[sound:[^\]]+\]/g;

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function mapNoteFields(
  fields: { [name: string]: string },
  fieldMapping: FieldMapping
): MappedNote | null {
  const bySource = new Map<DataSource, string>();
  for (const [fieldName, source] of Object.entries(fieldMapping)) {
    if (source === DataSource.None) {
      continue;
    }
    const value = fields[fieldName];
    if (value !== undefined && value !== '' && !bySource.has(source)) {
      bySource.set(source, value);
    }
  }

  const audioRaw = bySource.get(DataSource.WordAudio) ?? '';
  const soundMatch = audioRaw.match(SOUND);
  const audioRef = soundMatch ? soundMatch[1] : null;

  let word = stripHtml(bySource.get(DataSource.Word) ?? '');
  let definition = stripHtml(bySource.get(DataSource.Definition) ?? '');

  if (!word) {
    // Фолбэк: первое поле ноты → word, конкатенация остальных → definition
    const names = Object.keys(fields);
    if (names.length === 0) {
      return null;
    }
    word = stripHtml(fields[names[0]].replace(SOUND_ALL, ''));
    definition = stripHtml(
      names
        .slice(1)
        .map((n) => fields[n])
        .join('\n')
        .replace(SOUND_ALL, '')
    );
  }
  if (!word) {
    return null;
  }

  const examplesRaw = bySource.get(DataSource.Examples) ?? '';
  const examples = examplesRaw
    ? examplesRaw
        .split(/<br\s*\/?>/i)
        .map(stripHtml)
        .filter(Boolean)
    : [];

  return {
    card: {
      word,
      wordType: stripHtml(bySource.get(DataSource.WordType) ?? ''),
      definition,
      definitionExample: stripHtml(
        bySource.get(DataSource.DefinitionExample) ?? ''
      ),
      transcription: stripHtml(bySource.get(DataSource.Transcription) ?? ''),
      examples,
      audioFilename: audioRef,
      tags: 'imported'
    },
    audioRef
  };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Расширить `src/main/services/anki-connect.service.ts`**

Добавить интерфейс после `AnkiConnectResponse` и два метода в класс (после `findNotes`):

```ts
export interface AnkiNoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: { [name: string]: { value: string; order: number } };
}
```

```ts
  async notesInfo(notes: number[]): Promise<AnkiNoteInfo[]> {
    return await this.invoke('notesInfo', { notes });
  }

  /** Возвращает base64 содержимого медиафайла или false, если файла нет. */
  async retrieveMediaFile(filename: string): Promise<string | false> {
    return await this.invoke('retrieveMediaFile', { filename });
  }
```

- [ ] **Step 6: Создать `src/main/services/import.service.ts`**

```ts
import { ankiConnectService } from './anki-connect.service';
import { CollectionService } from './collection.service';
import { MediaService } from './media.service';
import { mapNoteFields } from './import.mapper';
import {
  FieldMapping,
  ImportDeckChoice,
  ImportProgress,
  ImportResult,
  NewCardInput
} from '../../shared/types';

const NOTES_BATCH = 100;

function escapeAnkiQuery(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}

export class ImportService {
  constructor(
    private col: CollectionService,
    private media: MediaService
  ) {}

  async getAnkiDecks(): Promise<ImportDeckChoice[]> {
    const names = await ankiConnectService.getDeckNames();
    const result: ImportDeckChoice[] = [];
    for (const name of names) {
      const ids = await ankiConnectService.findNotes(
        `deck:"${escapeAnkiQuery(name)}"`
      );
      result.push({ name, noteCount: ids.length });
    }
    return result;
  }

  async run(
    deckNames: string[],
    fieldMapping: FieldMapping,
    onProgress: (p: ImportProgress) => void
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const deckName of deckNames) {
      const deck =
        this.col.getDeckByName(deckName) ?? this.col.createDeck(deckName);
      const noteIds = await ankiConnectService.findNotes(
        `deck:"${escapeAnkiQuery(deckName)}"`
      );
      const seen = new Set(this.col.listCardKeys(deck.id));
      let done = 0;

      for (let i = 0; i < noteIds.length; i += NOTES_BATCH) {
        const infos = await ankiConnectService.notesInfo(
          noteIds.slice(i, i + NOTES_BATCH)
        );
        const toAdd: NewCardInput[] = [];

        for (const info of infos) {
          try {
            const flat: { [name: string]: string } = {};
            for (const [n, v] of Object.entries(info.fields)) {
              flat[n] = v.value;
            }
            const mapped = mapNoteFields(flat, fieldMapping);
            if (!mapped) {
              skipped++;
              continue;
            }
            const key = `${mapped.card.word.toLowerCase()} ${mapped.card.definition.toLowerCase()}`;
            if (seen.has(key)) {
              skipped++;
              continue;
            }
            seen.add(key);

            if (mapped.audioRef) {
              const data = await ankiConnectService.retrieveMediaFile(
                mapped.audioRef
              );
              if (data) {
                await this.media.save(mapped.audioRef, data);
              } else {
                mapped.card.audioFilename = null;
              }
            }
            toAdd.push(mapped.card);
          } catch (e) {
            console.error('Import: failed to map note', info.noteId, e);
            errors++;
          }
        }

        this.col.addCards(deck.id, toAdd, Date.now());
        imported += toAdd.length;
        done += infos.length;
        onProgress({
          deck: deckName,
          done,
          total: noteIds.length,
          imported,
          skipped,
          errors,
          finished: false
        });
      }
    }

    const result = { imported, skipped, errors };
    onProgress({
      deck: '',
      done: 0,
      total: 0,
      ...result,
      finished: true
    });
    return result;
  }
}
```

- [ ] **Step 7: Проверка и commit**

Run: `npm test` — Expected: PASS. Run: `npm run build` — Expected: успех.

```powershell
git add src/main/services/import.mapper.ts src/main/services/import.service.ts src/main/services/anki-connect.service.ts src/main/services/__tests__/import.mapper.test.ts
git commit -m "feat: Anki import service with field mapping"
```

---

### Task 8: Файловая персистентность, IPC-хендлеры, preload, wiring

**Files:**
- Create: `src/main/services/collection.storage.ts`
- Create: `src/main/ipc/collection.handlers.ts`
- Create: `src/main/ipc/review.handlers.ts`
- Create: `src/main/ipc/import.handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/global.d.ts`

- [ ] **Step 1: Создать `src/main/services/collection.storage.ts`**

```ts
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
```

- [ ] **Step 2: Создать `src/main/ipc/collection.handlers.ts`**

```ts
import { IpcMain } from 'electron';
import {
  AudioUpload,
  CardSearchQuery,
  CardTextUpdate,
  IPC_CHANNELS,
  NewCardInput
} from '../../shared/types';
import { CollectionService } from '../services/collection.service';
import { MediaService } from '../services/media.service';

export function setupCollectionHandlers(
  ipcMain: IpcMain,
  col: CollectionService,
  media: MediaService
): void {
  ipcMain.handle(IPC_CHANNELS.DECK_LIST, () => col.listDecks(Date.now()));
  ipcMain.handle(IPC_CHANNELS.DECK_CREATE, (_e, name: string) =>
    col.createDeck(name)
  );
  ipcMain.handle(IPC_CHANNELS.DECK_RENAME, (_e, id: number, name: string) =>
    col.renameDeck(id, name)
  );
  ipcMain.handle(IPC_CHANNELS.DECK_DELETE, async (_e, id: number) => {
    const orphans = col.deleteDeck(id);
    await media.remove(orphans);
  });
  ipcMain.handle(
    IPC_CHANNELS.DECK_UPDATE_LIMITS,
    (_e, id: number, newPerDay: number, reviewsPerDay: number) =>
      col.updateDeckLimits(id, newPerDay, reviewsPerDay)
  );

  ipcMain.handle(
    IPC_CHANNELS.CARD_ADD,
    async (_e, deckId: number, cards: NewCardInput[], audio: AudioUpload[]) => {
      for (const a of audio) {
        await media.save(a.filename, a.data);
      }
      return col.addCards(deckId, cards, Date.now());
    }
  );
  ipcMain.handle(IPC_CHANNELS.CARD_UPDATE, (_e, update: CardTextUpdate) =>
    col.updateCardText(update)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_DELETE, async (_e, ids: number[]) => {
    const orphans = col.deleteCards(ids);
    await media.remove(orphans);
  });
  ipcMain.handle(IPC_CHANNELS.CARD_MOVE, (_e, ids: number[], deckId: number) =>
    col.moveCards(ids, deckId)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_SEARCH, (_e, query: CardSearchQuery) =>
    col.searchCards(query)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_GET, (_e, id: number) => col.getCard(id));
  ipcMain.handle(IPC_CHANNELS.CARD_LIST_WORDS, (_e, deckId: number) =>
    col.listWords(deckId)
  );

  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_AUDIO, (_e, filename: string) =>
    media.getBase64(filename)
  );
}
```

- [ ] **Step 3: Создать `src/main/ipc/review.handlers.ts`**

```ts
import { IpcMain } from 'electron';
import { IPC_CHANNELS, ReviewRating } from '../../shared/types';
import { SchedulerService } from '../services/scheduler.service';

export function setupReviewHandlers(
  ipcMain: IpcMain,
  scheduler: SchedulerService
): void {
  ipcMain.handle(IPC_CHANNELS.REVIEW_GET_QUEUE, (_e, deckId: number) =>
    scheduler.getQueue(deckId)
  );
  ipcMain.handle(
    IPC_CHANNELS.REVIEW_ANSWER,
    (_e, cardId: number, rating: ReviewRating) =>
      scheduler.answer(cardId, rating)
  );
  ipcMain.handle(IPC_CHANNELS.REVIEW_PREVIEW_INTERVALS, (_e, cardId: number) =>
    scheduler.previewIntervals(cardId)
  );
}
```

- [ ] **Step 4: Создать `src/main/ipc/import.handlers.ts`**

```ts
import { IpcMain } from 'electron';
import { FieldMapping, IPC_CHANNELS } from '../../shared/types';
import { ankiConnectService } from '../services/anki-connect.service';
import { ImportService } from '../services/import.service';
import { settingsService } from '../services/settings.service';

export function setupImportHandlers(
  ipcMain: IpcMain,
  importService: ImportService
): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT_GET_ANKI_DECKS, async () => {
    const connected = await ankiConnectService.checkConnection();
    if (!connected) {
      throw new Error(
        'Anki не запущен или аддон AnkiConnect не установлен. Запусти Anki и попробуй снова.'
      );
    }
    return importService.getAnkiDecks();
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_RUN, async (event, deckNames: string[]) => {
    const fieldMapping =
      ((await settingsService.get('fieldMapping')) as FieldMapping) || {};
    return importService.run(deckNames, fieldMapping, (p) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.IMPORT_PROGRESS, p);
      }
    });
  });
}
```

- [ ] **Step 5: Обновить `src/main/index.ts` (полная замена файла)**

```ts
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { setupAnkiHandlers } from './ipc/anki.handlers';
import { setupGeminiHandlers } from './ipc/gemini.handlers';
import { setupTTSHandlers } from './ipc/tts.handlers';
import { setupSettingsHandlers } from './ipc/settings.handlers';
import { setupCollectionHandlers } from './ipc/collection.handlers';
import { setupReviewHandlers } from './ipc/review.handlers';
import { setupImportHandlers } from './ipc/import.handlers';
import { CollectionStorage } from './services/collection.storage';
import { SchedulerService } from './services/scheduler.service';
import { MediaService } from './services/media.service';
import { ImportService } from './services/import.service';

let mainWindow: BrowserWindow | null = null;
const storage = new CollectionStorage();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'AnkiGenerator',
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Remove the menu bar
  Menu.setApplicationMenu(null);

  // Load the index.html from the dist/renderer folder
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(async () => {
  await storage.open();
  const media = new MediaService(
    path.join(app.getPath('userData'), 'media')
  );
  await media.init();
  const scheduler = new SchedulerService(storage.service);
  const importService = new ImportService(storage.service, media);

  // Setup all IPC handlers
  setupAnkiHandlers(ipcMain);
  setupGeminiHandlers(ipcMain);
  setupTTSHandlers(ipcMain);
  setupSettingsHandlers(ipcMain);
  setupCollectionHandlers(ipcMain, storage.service, media);
  setupReviewHandlers(ipcMain, scheduler);
  setupImportHandlers(ipcMain, importService);

  // Handle external links
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Сбрасываем несохранённые изменения БД на диск перед выходом
let dbFlushed = false;
app.on('will-quit', (event) => {
  if (dbFlushed) {
    return;
  }
  event.preventDefault();
  storage
    .flush()
    .finally(() => {
      dbFlushed = true;
      app.quit();
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

(Примечание: в Task 14 импорт и вызов `setupAnkiHandlers` будут удалены.)

- [ ] **Step 6: Дополнить `src/main/preload.ts` — добавить блоки после `settings` (внутри `exposeInMainWorld`, не забыть запятую после блока `settings`)**

```ts
  // Local collection APIs
  collection: {
    listDecks: () => ipcRenderer.invoke(IPC_CHANNELS.DECK_LIST),
    createDeck: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_CREATE, name),
    renameDeck: (id: number, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_RENAME, id, name),
    deleteDeck: (id: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_DELETE, id),
    updateDeckLimits: (id: number, newPerDay: number, reviewsPerDay: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_UPDATE_LIMITS, id, newPerDay, reviewsPerDay),
    addCards: (deckId: number, cards: any[], audio: any[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_ADD, deckId, cards, audio),
    updateCard: (update: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_UPDATE, update),
    deleteCards: (ids: number[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_DELETE, ids),
    moveCards: (ids: number[], deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_MOVE, ids, deckId),
    searchCards: (query: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_SEARCH, query),
    getCard: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CARD_GET, id),
    listWords: (deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_LIST_WORDS, deckId)
  },

  // Review APIs
  review: {
    getQueue: (deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_QUEUE, deckId),
    answer: (cardId: number, rating: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_ANSWER, cardId, rating),
    previewIntervals: (cardId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_PREVIEW_INTERVALS, cardId)
  },

  // Media APIs
  media: {
    getAudio: (filename: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET_AUDIO, filename)
  },

  // Import APIs
  importer: {
    getAnkiDecks: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_GET_ANKI_DECKS),
    run: (deckNames: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.IMPORT_RUN, deckNames),
    onProgress: (cb: (p: any) => void) => {
      const listener = (_e: any, p: any) => cb(p);
      ipcRenderer.on(IPC_CHANNELS.IMPORT_PROGRESS, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.IMPORT_PROGRESS, listener);
    }
  }
```

- [ ] **Step 7: Обновить `src/renderer/global.d.ts` (полная замена файла)**

```ts
import {
  AnkiNote,
  AudioUpload,
  BatchWordResult,
  AppSettings,
  CardSearchQuery,
  CardSearchResult,
  CardTextUpdate,
  Deck,
  DeckWithCounts,
  ImportDeckChoice,
  ImportProgress,
  ImportResult,
  IntervalPreviews,
  NewCardInput,
  ParsedWord,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../shared/types';

export interface ElectronAPI {
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  anki: {
    getDecks: () => Promise<string[]>;
    getModels: () => Promise<string[]>;
    getModelFields: (modelName: string) => Promise<string[]>;
    storeMedia: (filename: string, data: string) => Promise<string>;
    addNote: (note: AnkiNote) => Promise<number>;
    addNotes: (notes: AnkiNote[]) => Promise<(number | null)[]>;
    findNotes: (query: string) => Promise<number[]>;
    checkConnection: () => Promise<boolean>;
  };
  ai: {
    generateBatch: (parsedWords: ParsedWord[], examplesCount: number) => Promise<BatchWordResult[]>;
  };
  tts: {
    generateAudio: (text: string) => Promise<ArrayBuffer>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<Partial<AppSettings>>;
  };
  collection: {
    listDecks: () => Promise<DeckWithCounts[]>;
    createDeck: (name: string) => Promise<Deck>;
    renameDeck: (id: number, name: string) => Promise<void>;
    deleteDeck: (id: number) => Promise<void>;
    updateDeckLimits: (id: number, newPerDay: number, reviewsPerDay: number) => Promise<void>;
    addCards: (deckId: number, cards: NewCardInput[], audio: AudioUpload[]) => Promise<number[]>;
    updateCard: (update: CardTextUpdate) => Promise<void>;
    deleteCards: (ids: number[]) => Promise<void>;
    moveCards: (ids: number[], deckId: number) => Promise<void>;
    searchCards: (query: CardSearchQuery) => Promise<CardSearchResult>;
    getCard: (id: number) => Promise<StoredCard | null>;
    listWords: (deckId: number) => Promise<string[]>;
  };
  review: {
    getQueue: (deckId: number) => Promise<ReviewQueueState>;
    answer: (cardId: number, rating: ReviewRating) => Promise<ReviewQueueState>;
    previewIntervals: (cardId: number) => Promise<IntervalPreviews>;
  };
  media: {
    getAudio: (filename: string) => Promise<string | null>;
  };
  importer: {
    getAnkiDecks: () => Promise<ImportDeckChoice[]>;
    run: (deckNames: string[]) => Promise<ImportResult>;
    onProgress: (cb: (p: ImportProgress) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

(Блок `anki` удаляется в Task 14.)

- [ ] **Step 8: Проверка**

Run: `npm run build` — Expected: успех.
Run: `npm run dev` — Expected: приложение запускается; в `%APPDATA%/anki-generator/` (userData) после первого изменения настроек/колод появится `collection.db`. Закрыть приложение.

- [ ] **Step 9: Commit**

```powershell
git add src/main/services/collection.storage.ts src/main/ipc/collection.handlers.ts src/main/ipc/review.handlers.ts src/main/ipc/import.handlers.ts src/main/index.ts src/main/preload.ts src/renderer/global.d.ts
git commit -m "feat: collection persistence, IPC handlers, preload API"
```

---

### Task 9: Store-слайс колод + вкладка Decks + навигация

**Files:**
- Modify: `src/renderer/store/index.ts`
- Create: `src/renderer/components/Decks/Decks.tsx`
- Create: `src/renderer/components/Decks/Decks.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Добавить слайс колод в `src/renderer/store/index.ts`**

В interface `AppState` (после строки `setAnkiConnected: (connected: boolean) => void`):

```ts
	// Local collection slice
	decks: DeckWithCounts[]
	refreshDecks: () => Promise<void>
	defaultDeckId: number | null
	setDefaultDeckId: (id: number | null) => void
```

Импорт: добавить `DeckWithCounts` в импорт из `'../../shared/types'`.

В реализацию стора (после `setAnkiConnected: ...`):

```ts
	// Local collection
	decks: [],
	refreshDecks: async () => {
		try {
			const decks = await window.electronAPI.collection.listDecks()
			set({ decks })
		} catch (error) {
			console.error('Failed to load decks:', error)
		}
	},
	defaultDeckId: null,
	setDefaultDeckId: id => {
		set({ defaultDeckId: id })
		window.electronAPI.settings
			.set('defaultDeckId', id)
			.catch(error => console.error('Failed to persist defaultDeckId:', error))
	},
```

И в `loadSettings` добавить к `set({...})` строку:

```ts
				defaultDeckId: settings.defaultDeckId ?? null,
```

- [ ] **Step 2: Создать `src/renderer/components/Decks/Decks.css`**

```css
.decks-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.decks-table th,
.decks-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.deck-name {
  font-weight: 600;
  cursor: pointer;
}

.count-new {
  color: #2962ff;
  font-weight: 600;
}

.count-learn {
  color: #d32f2f;
  font-weight: 600;
}

.count-due {
  color: #2e7d32;
  font-weight: 600;
}

.deck-create-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-top: 16px;
}

.deck-create-row > div {
  flex: 1;
}

.deck-actions {
  display: flex;
  gap: 6px;
}

.deck-limits-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.deck-limits-row input {
  width: 70px;
}
```

- [ ] **Step 3: Создать `src/renderer/components/Decks/Decks.tsx`**

(ImportModal подключается в Task 13 — пока кнопка-заглушка отсутствует; Review подключается в Task 10 — пока «Учить» лишь выводит alert недоступности? НЕТ — заглушек не оставляем: Task 9 рендерит таблицу и CRUD, кнопка «Учить» появляется в Task 10, кнопка «Импорт» — в Task 13.)

```tsx
import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DeckWithCounts } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import './Decks.css';

const Decks: React.FC = () => {
  const { decks, refreshDecks } = useStore();
  const [newDeckName, setNewDeckName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<DeckWithCounts | null>(null);
  const [limitNew, setLimitNew] = useState('20');
  const [limitRev, setLimitRev] = useState('200');

  useEffect(() => {
    refreshDecks();
  }, []);

  const handleCreate = async () => {
    if (!newDeckName.trim()) return;
    setError(null);
    try {
      await window.electronAPI.collection.createDeck(newDeckName.trim());
      setNewDeckName('');
      await refreshDecks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRename = async (deck: DeckWithCounts) => {
    const name = window.prompt ? window.prompt('Новое имя колоды:', deck.name) : null;
    // window.prompt недоступен в Electron — используем inline-редактирование
    void name;
  };

  const handleDelete = async (deck: DeckWithCounts) => {
    const ok = window.confirm(
      `Удалить колоду «${deck.name}» и все её карточки (${deck.totalCards} шт.)?`
    );
    if (!ok) return;
    await window.electronAPI.collection.deleteDeck(deck.id);
    await refreshDecks();
  };

  const openLimits = (deck: DeckWithCounts) => {
    setEditingLimits(deck);
    setLimitNew(String(deck.newPerDay));
    setLimitRev(String(deck.reviewsPerDay));
  };

  const saveLimits = async () => {
    if (!editingLimits) return;
    await window.electronAPI.collection.updateDeckLimits(
      editingLimits.id,
      Math.max(0, parseInt(limitNew) || 0),
      Math.max(0, parseInt(limitRev) || 0)
    );
    setEditingLimits(null);
    await refreshDecks();
  };

  return (
    <div className="decks">
      <h2>Колоды</h2>
      <p className="description">
        Новые / Учатся / К повторению. Кликни «Учить», чтобы начать.
      </p>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p>Пока нет колод. Создай первую ниже или импортируй из Anki.</p>
        </div>
      ) : (
        <table className="decks-table">
          <thead>
            <tr>
              <th>Колода</th>
              <th>Новые</th>
              <th>Учатся</th>
              <th>Повтор</th>
              <th>Всего</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck) => (
              <tr key={deck.id}>
                <td className="deck-name">{deck.name}</td>
                <td className="count-new">{deck.newCount}</td>
                <td className="count-learn">{deck.learnCount}</td>
                <td className="count-due">{deck.dueCount}</td>
                <td>{deck.totalCards}</td>
                <td>
                  <div className="deck-actions">
                    <Button size="small" variant="secondary" onClick={() => openLimits(deck)}>
                      Лимиты
                    </Button>
                    <Button size="small" variant="danger" onClick={() => handleDelete(deck)}>
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingLimits && (
        <div className="settings-section">
          <h3>Лимиты «{editingLimits.name}»</h3>
          <div className="deck-limits-row">
            <label>Новых в день:</label>
            <input value={limitNew} onChange={(e) => setLimitNew(e.target.value)} />
            <label>Повторений в день:</label>
            <input value={limitRev} onChange={(e) => setLimitRev(e.target.value)} />
            <Button size="small" onClick={saveLimits}>Сохранить</Button>
            <Button size="small" variant="secondary" onClick={() => setEditingLimits(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      <div className="deck-create-row">
        <Input
          label="Новая колода"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          placeholder="Название колоды"
        />
        <Button onClick={handleCreate}>Создать</Button>
      </div>
      {error && <p className="help-text error">{error}</p>}
    </div>
  );
};

export default Decks;
```

ВНИМАНИЕ: `window.prompt` в Electron НЕ работает. Функцию `handleRename` выше НЕ включать в финальный код — вместо неё сделать inline-редактирование: состояние `renamingId: number | null` + `renameValue: string`; по кнопке «Переименовать» ячейка имени заменяется на `<input>` с кнопками ✓/✕; ✓ вызывает `window.electronAPI.collection.renameDeck(deck.id, renameValue)` и `refreshDecks()`. `window.confirm` в Electron работает — его оставить.

- [ ] **Step 4: Обновить `src/renderer/App.tsx`**

```diff
 import React, { useState } from 'react';
 import Settings from './components/Settings/Settings';
 import WordInput from './components/WordInput/WordInput';
 import Generation from './components/Generation/Generation';
 import Preview from './components/Preview/Preview';
+import Decks from './components/Decks/Decks';
 import './App.css';
 
-type Tab = 'setup' | 'input' | 'generate' | 'preview';
+type Tab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview';
 
 const App: React.FC = () => {
-  const [activeTab, setActiveTab] = useState<Tab>('setup');
+  const [activeTab, setActiveTab] = useState<Tab>('decks');
```

В `<nav className="app-tabs">` добавить ПЕРВЫМИ две кнопки:

```tsx
        <button
          className={`tab ${activeTab === 'decks' ? 'active' : ''}`}
          onClick={() => setActiveTab('decks')}
        >
          Decks
        </button>
        <button
          className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
```

В `<main className="app-content">` добавить:

```tsx
        {activeTab === 'decks' && (
          <div className="tab-content">
            <Decks />
          </div>
        )}
```

(Содержимое вкладки `browse` добавляется в Task 11 — до того вкладка рендерит пустой `<div className="tab-content" />`; добавить этот плейсхолдер сейчас, чтобы кнопка не вела в никуда:)

```tsx
        {activeTab === 'browse' && <div className="tab-content" />}
```

- [ ] **Step 5: Проверка**

Run: `npm run build` — Expected: успех.
Run: `npm run dev` — Expected: вкладка Decks открывается первой; создать колоду «Test» → появляется в таблице с нулями; переименовать; удалить с подтверждением. Закрыть и снова `npm start` — колоды на месте (персистентность).

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/store/index.ts src/renderer/components/Decks src/renderer/App.tsx
git commit -m "feat: Decks tab with CRUD and persistent deck list"
```

---

### Task 10: Экран Review

**Files:**
- Create: `src/renderer/components/Review/Review.tsx`
- Create: `src/renderer/components/Review/Review.css`
- Modify: `src/renderer/components/Decks/Decks.tsx`

- [ ] **Step 1: Создать `src/renderer/components/Review/Review.css`**

```css
.review {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 60vh;
}

.review-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
  margin-bottom: 24px;
}

.review-counts {
  display: flex;
  gap: 12px;
  font-weight: 600;
}

.review-card {
  width: 100%;
  max-width: 640px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
}

.review-word {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.review-word-type {
  color: #757575;
  font-style: italic;
  margin-bottom: 12px;
}

.review-divider {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 20px 0;
}

.review-back {
  text-align: left;
}

.review-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  justify-content: center;
}

.rating-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  color: #fff;
  font-size: 1rem;
}

.rating-btn small {
  opacity: 0.85;
  font-size: 0.75rem;
}

.rating-again { background: #d32f2f; }
.rating-hard { background: #f57c00; }
.rating-good { background: #2e7d32; }
.rating-easy { background: #2962ff; }

.review-done {
  text-align: center;
  margin-top: 64px;
  font-size: 1.2rem;
}
```

- [ ] **Step 2: Создать `src/renderer/components/Review/Review.tsx`**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IntervalPreviews,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../../../shared/types';
import Button from '../common/Button';
import './Review.css';

interface ReviewProps {
  deckId: number;
  deckName: string;
  onExit: () => void;
}

const Review: React.FC<ReviewProps> = ({ deckId, deckName, onExit }) => {
  const [queue, setQueue] = useState<ReviewQueueState | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreviews | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const card: StoredCard | null = queue?.current ?? null;

  const loadQueue = useCallback(async () => {
    const q = await window.electronAPI.review.getQueue(deckId);
    setQueue(q);
    setShowAnswer(false);
    setIntervals(null);
  }, [deckId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Аудио: подгружаем и автопроигрываем при смене карточки
  useEffect(() => {
    audioRef.current = null;
    if (!card?.audioFilename) return;
    let cancelled = false;
    window.electronAPI.media.getAudio(card.audioFilename).then((b64) => {
      if (cancelled || !b64) return;
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [card?.id]);

  const playAudio = () => {
    audioRef.current?.play().catch(() => {});
  };

  const reveal = async () => {
    if (!card) return;
    setShowAnswer(true);
    const p = await window.electronAPI.review.previewIntervals(card.id);
    setIntervals(p);
  };

  const rate = async (rating: ReviewRating) => {
    if (!card) return;
    const q = await window.electronAPI.review.answer(card.id, rating);
    setQueue(q);
    setShowAnswer(false);
    setIntervals(null);
  };

  // Хоткеи: пробел = показать ответ / Good; 1-4 = оценки
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer) {
          reveal();
        } else {
          rate(3);
        }
      } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        rate(parseInt(e.key) as ReviewRating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAnswer, card?.id]);

  if (!queue) {
    return <div className="review">Загрузка...</div>;
  }

  return (
    <div className="review">
      <div className="review-header">
        <Button variant="secondary" size="small" onClick={onExit}>
          ← {deckName}
        </Button>
        <div className="review-counts">
          <span className="count-new">{queue.newCount}</span>
          <span className="count-learn">{queue.learnCount}</span>
          <span className="count-due">{queue.dueCount}</span>
        </div>
      </div>

      {!card ? (
        <div className="review-done">
          <p>🎉 Поздравляем! На сегодня в этой колоде всё.</p>
          <Button onClick={onExit}>К колодам</Button>
        </div>
      ) : (
        <>
          <div className="review-card">
            <div className="review-word">{card.word}</div>
            {card.wordType && (
              <div className="review-word-type">{card.wordType}</div>
            )}
            {card.audioFilename && (
              <Button size="small" variant="secondary" onClick={playAudio}>
                ▶ Аудио
              </Button>
            )}

            {showAnswer && (
              <>
                <hr className="review-divider" />
                <div className="review-back">
                  {card.transcription && (
                    <p><em>{card.transcription}</em></p>
                  )}
                  <p><strong>{card.definition}</strong></p>
                  {card.definitionExample && <p>{card.definitionExample}</p>}
                  {card.examples.length > 0 && (
                    <ul>
                      {card.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="review-actions">
            {!showAnswer ? (
              <Button size="large" onClick={reveal}>
                Показать ответ (пробел)
              </Button>
            ) : (
              <>
                <button className="rating-btn rating-again" onClick={() => rate(1)}>
                  Снова<small>{intervals?.again ?? ''}</small>
                </button>
                <button className="rating-btn rating-hard" onClick={() => rate(2)}>
                  Трудно<small>{intervals?.hard ?? ''}</small>
                </button>
                <button className="rating-btn rating-good" onClick={() => rate(3)}>
                  Хорошо<small>{intervals?.good ?? ''}</small>
                </button>
                <button className="rating-btn rating-easy" onClick={() => rate(4)}>
                  Легко<small>{intervals?.easy ?? ''}</small>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Review;
```

- [ ] **Step 3: Подключить Review в `Decks.tsx`**

Добавить импорт `import Review from '../Review/Review';`, состояние `const [studyingDeck, setStudyingDeck] = useState<DeckWithCounts | null>(null);`.

В начало JSX (до `<h2>`):

```tsx
  if (studyingDeck) {
    return (
      <Review
        deckId={studyingDeck.id}
        deckName={studyingDeck.name}
        onExit={() => {
          setStudyingDeck(null);
          refreshDecks();
        }}
      />
    );
  }
```

В `deck-actions` добавить первой кнопку:

```tsx
                    <Button size="small" onClick={() => setStudyingDeck(deck)}>
                      Учить
                    </Button>
```

- [ ] **Step 4: Проверка**

Run: `npm run build` — успех. Run: `npm run dev`:
- Создать колоду, пока пустую → «Учить» → «Поздравляем... всё».
- (Полная проверка цикла изучения — после Task 12, когда появятся карточки.)

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/components/Review src/renderer/components/Decks/Decks.tsx
git commit -m "feat: review screen with FSRS ratings and hotkeys"
```

---

### Task 11: Вкладка Browse (браузер карточек)

**Files:**
- Create: `src/renderer/components/Browser/Browser.tsx`
- Create: `src/renderer/components/Browser/CardEditModal.tsx`
- Create: `src/renderer/components/Browser/Browser.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Создать `src/renderer/components/Browser/Browser.css`**

```css
.browser-filters {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.browser-filters > div {
  min-width: 160px;
}

.browser-table {
  width: 100%;
  border-collapse: collapse;
}

.browser-table th,
.browser-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e0e0e0;
  text-align: left;
}

.browser-table tbody tr {
  cursor: pointer;
}

.browser-table tbody tr:hover {
  background: #f5f5f5;
}

.browser-def {
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browser-bulk {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}

.browser-pagination {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 560px;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
```

- [ ] **Step 2: Создать `src/renderer/components/Browser/CardEditModal.tsx`**

```tsx
import React, { useState } from 'react';
import { StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';

interface CardEditModalProps {
  card: StoredCard;
  onClose: () => void;
  onSaved: () => void;
}

const CardEditModal: React.FC<CardEditModalProps> = ({ card, onClose, onSaved }) => {
  const [word, setWord] = useState(card.word);
  const [wordType, setWordType] = useState(card.wordType);
  const [definition, setDefinition] = useState(card.definition);
  const [definitionExample, setDefinitionExample] = useState(card.definitionExample);
  const [transcription, setTranscription] = useState(card.transcription);
  const [examples, setExamples] = useState(card.examples.join('\n'));
  const [tags, setTags] = useState(card.tags);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await window.electronAPI.collection.updateCard({
        id: card.id,
        word,
        wordType,
        definition,
        definitionExample,
        transcription,
        examples: examples.split('\n').map((s) => s.trim()).filter(Boolean),
        tags: tags.trim()
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Удалить карточку «${card.word}»?`)) return;
    await window.electronAPI.collection.deleteCards([card.id]);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Редактирование карточки</h3>
        <Input label="Слово" value={word} onChange={(e) => setWord(e.target.value)} />
        <Input label="Часть речи" value={wordType} onChange={(e) => setWordType(e.target.value)} />
        <Input label="Определение" value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <Input
          label="Пример определения"
          value={definitionExample}
          onChange={(e) => setDefinitionExample(e.target.value)}
        />
        <Input
          label="Транскрипция"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
        />
        <label className="input-label">Примеры (по одному на строку)</label>
        <textarea
          rows={4}
          style={{ width: '100%' }}
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
        />
        <Input label="Теги (через пробел)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="modal-actions">
          <Button variant="danger" onClick={remove}>Удалить</Button>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardEditModal;
```

(Если у `Input` нет класса `input-label` — посмотреть `src/renderer/components/common/Input.tsx` и использовать его реальный класс label, либо обычный `<label>`.)

- [ ] **Step 3: Создать `src/renderer/components/Browser/Browser.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import {
  CardSearchResult,
  CardState,
  CardStatusFilter,
  StoredCard
} from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import CardEditModal from './CardEditModal';
import './Browser.css';

const PAGE_SIZE = 50;

const STATE_LABELS: Record<CardState, string> = {
  [CardState.New]: 'Новая',
  [CardState.Learning]: 'Учится',
  [CardState.Review]: 'Повтор',
  [CardState.Relearning]: 'Переучивается'
};

const Browser: React.FC = () => {
  const { decks, refreshDecks } = useStore();
  const [text, setText] = useState('');
  const [deckId, setDeckId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<CardSearchResult>({ total: 0, cards: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<StoredCard | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');

  useEffect(() => {
    refreshDecks();
  }, []);

  // Поиск с дебаунсом 300 мс
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await window.electronAPI.collection.searchCards({
        text: text.trim() || undefined,
        deckId: deckId ? parseInt(deckId) : undefined,
        status: (status || undefined) as CardStatusFilter | undefined,
        tag: tag.trim() || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      });
      setResult(r);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(t);
  }, [text, deckId, status, tag, page]);

  // Сброс страницы при смене фильтров
  useEffect(() => {
    setPage(0);
  }, [text, deckId, status, tag]);

  const refresh = () => {
    // Перезапуск поиска: меняем page на себя через копию фильтра
    setPage((p) => p);
    setText((t) => t + '');
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Удалить выбранные карточки (${selected.size})?`)) return;
    await window.electronAPI.collection.deleteCards([...selected]);
    refresh();
  };

  const bulkMove = async () => {
    if (selected.size === 0 || !moveTarget) return;
    await window.electronAPI.collection.moveCards([...selected], parseInt(moveTarget));
    refresh();
  };

  const deckName = (id: number) => decks.find((d) => d.id === id)?.name ?? '?';
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const deckOptions = [
    { value: '', label: 'Все колоды' },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];
  const statusOptions = [
    { value: '', label: 'Любой статус' },
    { value: 'new', label: 'Новые' },
    { value: 'learning', label: 'Учатся' },
    { value: 'review', label: 'Повтор' }
  ];

  return (
    <div className="browser">
      <h2>Карточки</h2>

      <div className="browser-filters">
        <Input
          label="Поиск"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Слово, определение, пример..."
        />
        <Select
          label="Колода"
          value={deckId}
          onChange={(e) => setDeckId(e.target.value)}
          options={deckOptions}
        />
        <Select
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
        />
        <Input
          label="Тег"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="imported"
        />
      </div>

      <p>{result.total} карточек найдено</p>

      {selected.size > 0 && (
        <div className="browser-bulk">
          <span>Выбрано: {selected.size}</span>
          <Button size="small" variant="danger" onClick={bulkDelete}>
            Удалить
          </Button>
          <Select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            options={[{ value: '', label: 'Переместить в...' }, ...decks.map((d) => ({ value: String(d.id), label: d.name }))]}
          />
          <Button size="small" onClick={bulkMove} disabled={!moveTarget}>
            Переместить
          </Button>
        </div>
      )}

      <table className="browser-table">
        <thead>
          <tr>
            <th></th>
            <th>Слово</th>
            <th>Определение</th>
            <th>Колода</th>
            <th>Статус</th>
            <th>Повтор</th>
          </tr>
        </thead>
        <tbody>
          {result.cards.map((card) => (
            <tr key={card.id} onClick={() => setEditing(card)}>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(card.id)}
                  onChange={() => toggle(card.id)}
                />
              </td>
              <td>{card.word}</td>
              <td className="browser-def">{card.definition}</td>
              <td>{deckName(card.deckId)}</td>
              <td>{STATE_LABELS[card.state]}</td>
              <td>
                {card.state === CardState.New
                  ? '—'
                  : new Date(card.due).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="browser-pagination">
        <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
          ← Назад
        </Button>
        <span>
          Стр. {page + 1} из {pages}
        </span>
        <Button
          size="small"
          variant="secondary"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          Вперёд →
        </Button>
      </div>

      {editing && (
        <CardEditModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default Browser;
```

Примечание к `refresh()`: трюк `setText(t => t + '')` не вызовет перезапуск (значение то же). Вместо него добавить состояние `const [reloadKey, setReloadKey] = useState(0);`, включить `reloadKey` в зависимости поискового `useEffect`, а `refresh = () => setReloadKey(k => k + 1);`. Реализовать именно так.

- [ ] **Step 4: Подключить в `src/renderer/App.tsx`**

Импорт: `import Browser from './components/Browser/Browser';`
Заменить плейсхолдер `{activeTab === 'browse' && <div className="tab-content" />}` на:

```tsx
        {activeTab === 'browse' && (
          <div className="tab-content">
            <Browser />
          </div>
        )}
```

- [ ] **Step 5: Проверка и commit**

Run: `npm run build` — успех. `npm run dev` — вкладка Browse открывается, фильтры рендерятся (карточек пока нет — пусто, это норм).

```powershell
git add src/renderer/components/Browser src/renderer/App.tsx
git commit -m "feat: card browser with search, filters, bulk actions and editing"
```

---

### Task 12: Сохранение сгенерированных карточек в локальную колоду

**Files:**
- Create: `src/renderer/hooks/useSaveToCollection.ts`
- Modify: `src/renderer/components/Preview/Preview.tsx`
- Modify: `src/renderer/hooks/useCardGeneration.ts`

- [ ] **Step 1: Создать `src/renderer/hooks/useSaveToCollection.ts`**

```ts
import { useState } from 'react';
import {
  AudioUpload,
  GeneratedCard,
  NewCardInput
} from '../../shared/types';
import { useStore } from '../store';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toInput(card: GeneratedCard): NewCardInput {
  return {
    word: card.word,
    wordType: card.wordType,
    definition: card.definition,
    definitionExample: card.definitionExample,
    transcription: card.transcription ?? '',
    examples: card.examples,
    audioFilename: card.audioData ? card.audioFilename ?? null : null,
    tags: 'anki-generator'
  };
}

export const useSaveToCollection = () => {
  const { generatedCards, setGeneratedCards } = useStore();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Помечает isDuplicate по словам, уже существующим в колоде deckId. */
  const markDuplicates = async (deckId: number) => {
    const words = await window.electronAPI.collection.listWords(deckId);
    const existing = new Set(words);
    const { generatedCards: cards } = useStore.getState();
    setGeneratedCards(
      cards.map((c) => ({
        ...c,
        isDuplicate: existing.has(c.word.toLowerCase())
      }))
    );
  };

  const saveAll = async (deckId: number, includeDuplicates: boolean) => {
    const cards = generatedCards.filter(
      (c) => !c.error && (includeDuplicates || !c.isDuplicate)
    );
    if (cards.length === 0) {
      setError('Нечего сохранять (все карточки — дубликаты или с ошибками).');
      setStatus('error');
      return;
    }

    setStatus('saving');
    setError(null);
    try {
      const audio: AudioUpload[] = [];
      const seen = new Set<string>();
      for (const c of cards) {
        if (c.audioData && c.audioFilename && !seen.has(c.audioFilename)) {
          seen.add(c.audioFilename);
          audio.push({
            filename: c.audioFilename,
            data: toBase64(c.audioData as unknown as ArrayBuffer)
          });
        }
      }
      const ids = await window.electronAPI.collection.addCards(
        deckId,
        cards.map(toInput),
        audio
      );
      setSavedCount(ids.length);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setStatus('error');
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setError(null);
  };

  return { saveAll, markDuplicates, resetStatus, status, savedCount, error };
};
```

- [ ] **Step 2: Переписать `src/renderer/components/Preview/Preview.tsx`**

Полная замена секции импорта/логики кнопки (структура списка карточек сохраняется как есть). Новый файл:

```tsx
import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useSaveToCollection } from '../../hooks/useSaveToCollection';
import Button from '../common/Button';
import Select from '../common/Select';
import Input from '../common/Input';
import CardPreview from './CardPreview';
import './Preview.css';

const Preview: React.FC = () => {
  const {
    generatedCards,
    removeGeneratedCard,
    decks,
    refreshDecks,
    defaultDeckId,
    setDefaultDeckId
  } = useStore();
  const { saveAll, markDuplicates, resetStatus, status, savedCount, error } =
    useSaveToCollection();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState<number | null>(defaultDeckId);
  const [newDeckName, setNewDeckName] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);

  const duplicateCount = generatedCards.filter((c) => c.isDuplicate).length;
  const isSaving = status === 'saving';

  useEffect(() => {
    refreshDecks();
  }, []);

  // Дубликаты пересчитываются при смене целевой колоды
  useEffect(() => {
    if (targetDeckId !== null && generatedCards.length > 0) {
      markDuplicates(targetDeckId);
    }
  }, [targetDeckId, generatedCards.length]);

  const handleDeckChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    setTargetDeckId(id);
    setDefaultDeckId(id);
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    const deck = await window.electronAPI.collection.createDeck(
      newDeckName.trim()
    );
    await refreshDecks();
    setNewDeckName('');
    setCreatingDeck(false);
    setTargetDeckId(deck.id);
    setDefaultDeckId(deck.id);
  };

  const handleSave = async () => {
    if (targetDeckId === null) return;
    await saveAll(targetDeckId, includeDuplicates);
  };

  const handleRemoveCard = (id: string) => {
    removeGeneratedCard(id);
    if (expandedCard === id) {
      setExpandedCard(null);
    }
  };

  const handleToggleCard = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const getButtonText = () => {
    switch (status) {
      case 'saving':
        return 'Сохранение...';
      case 'success':
        return `Сохранено ${savedCount} карточек!`;
      case 'error':
        return 'Ошибка — повторить';
      default:
        return 'Сохранить в колоду';
    }
  };

  const getButtonVariant = (): 'primary' | 'success' | 'danger' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const deckOptions = [
    { value: '', label: 'Выбери колоду...' },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];

  return (
    <div className="preview">
      <h2>Просмотр и сохранение</h2>
      <p className="description">
        Проверь сгенерированные карточки и сохрани их в колоду.
      </p>

      {generatedCards.length === 0 ? (
        <div className="empty-state">
          <p>Карточек пока нет. Сгенерируй их на вкладке Generate.</p>
        </div>
      ) : (
        <>
          <div className="preview-summary">
            <span className="card-count">
              {generatedCards.length} карточек
              {duplicateCount > 0 && (
                <span className="duplicate-count">
                  {' '}· {duplicateCount} уже в колоде
                </span>
              )}
            </span>
            <Select
              value={targetDeckId !== null ? String(targetDeckId) : ''}
              onChange={(e) => handleDeckChange(e.target.value)}
              options={deckOptions}
            />
            <Button
              onClick={() => setCreatingDeck(!creatingDeck)}
              variant="secondary"
              size="small"
            >
              + Новая колода
            </Button>
            <Button
              onClick={status === 'error' ? resetStatus : handleSave}
              disabled={isSaving || targetDeckId === null}
              variant={getButtonVariant()}
              size="large"
            >
              {getButtonText()}
            </Button>
          </div>

          {creatingDeck && (
            <div className="preview-summary">
              <Input
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="Название новой колоды"
              />
              <Button onClick={handleCreateDeck} size="small">
                Создать
              </Button>
            </div>
          )}

          {duplicateCount > 0 && (
            <label className="duplicate-toggle">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
              />
              {' '}Сохранить дубликаты тоже ({duplicateCount})
            </label>
          )}

          {error && <div className="adding-error">Ошибка: {error}</div>}

          <div className="card-list">
            {generatedCards.map((card) => (
              <div key={card.id} className="card-item">
                <div className="card-header" onClick={() => handleToggleCard(card.id)}>
                  <div className="card-title">
                    <span className="card-word">{card.word}</span>
                    {card.transcription && (
                      <span className="card-transcription">{card.transcription}</span>
                    )}
                    {card.isDuplicate && (
                      <span className="card-badge duplicate">Уже в колоде</span>
                    )}
                    {card.error && (
                      <span className="card-badge error">Ошибка</span>
                    )}
                  </div>
                  <div className="card-actions">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCard(card.id);
                      }}
                      variant="danger"
                      size="small"
                    >
                      Убрать
                    </Button>
                    <span className="expand-icon">
                      {expandedCard === card.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {expandedCard === card.id && <CardPreview card={card} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Preview;
```

(Проверить сигнатуру `Button.onClick`: если тип не принимает аргумент события — убрать `(e) =>` и `e.stopPropagation()` обернуть иначе, как в текущем коде Preview.tsx, где это уже работает — значит сигнатура совместима.)

- [ ] **Step 3: Убрать Anki-проверку дубликатов из `src/renderer/hooks/useCardGeneration.ts`**

- Удалить целиком функцию `markDuplicatesInDeck` (строки 5–55).
- Удалить вызов `await markDuplicatesInDeck();` и комментарий над ним (строки 241–242).
- Из импорта типов убрать `DataSource` (он использовался только в удалённой функции).

- [ ] **Step 4: Проверка**

Run: `npm run build` — успех.
Run: `npm run dev` — полный цикл: Input → слова → Generate → Preview: выбрать/создать колоду, «Сохранить в колоду» → Decks: счётчик новых вырос → «Учить» → карточка показывается, аудио играет, ответ «Хорошо» → счётчики меняются → Browse: карточки находятся поиском.

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/hooks/useSaveToCollection.ts src/renderer/components/Preview/Preview.tsx src/renderer/hooks/useCardGeneration.ts
git commit -m "feat: save generated cards to local collection"
```

---

### Task 13: UI импорта из Anki

**Files:**
- Create: `src/renderer/components/Decks/ImportModal.tsx`
- Modify: `src/renderer/components/Decks/Decks.tsx`

- [ ] **Step 1: Создать `src/renderer/components/Decks/ImportModal.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { ImportDeckChoice, ImportProgress } from '../../../shared/types';
import Button from '../common/Button';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Phase = 'loading' | 'choose' | 'running' | 'done' | 'error';

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [ankiDecks, setAnkiDecks] = useState<ImportDeckChoice[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    window.electronAPI.importer
      .getAnkiDecks()
      .then((decks) => {
        setAnkiDecks(decks);
        setChosen(new Set(decks.map((d) => d.name)));
        setPhase('choose');
      })
      .catch((e) => {
        setError(e.message);
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.importer.onProgress((p) => {
      setProgress(p);
      if (p.finished) {
        setPhase('done');
        onImported();
      }
    });
    return unsubscribe;
  }, [onImported]);

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const run = async () => {
    setPhase('running');
    try {
      await window.electronAPI.importer.run([...chosen]);
    } catch (e: any) {
      setError(e.message);
      setPhase('error');
    }
  };

  return (
    <div className="modal-overlay" onClick={phase === 'running' ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Импорт из Anki</h3>

        {phase === 'loading' && <p>Подключение к Anki...</p>}

        {phase === 'error' && (
          <>
            <p className="help-text error">{error}</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Закрыть</Button>
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            <p>Выбери колоды для импорта (прогресс изучения не переносится):</p>
            {ankiDecks.map((d) => (
              <label key={d.name} style={{ display: 'block', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={chosen.has(d.name)}
                  onChange={() => toggle(d.name)}
                />
                {' '}{d.name} ({d.noteCount})
              </label>
            ))}
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Отмена</Button>
              <Button onClick={run} disabled={chosen.size === 0}>
                Импортировать
              </Button>
            </div>
          </>
        )}

        {phase === 'running' && progress && (
          <>
            <p>
              Колода «{progress.deck}»: {progress.done} / {progress.total}
            </p>
            <p>
              Импортировано: {progress.imported} · Пропущено: {progress.skipped} ·
              Ошибок: {progress.errors}
            </p>
          </>
        )}
        {phase === 'running' && !progress && <p>Импорт начался...</p>}

        {phase === 'done' && progress && (
          <>
            <p>
              Готово! Импортировано: {progress.imported}, пропущено: {progress.skipped},
              ошибок: {progress.errors}.
            </p>
            <div className="modal-actions">
              <Button onClick={onClose}>Закрыть</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
```

- [ ] **Step 2: Подключить в `Decks.tsx`**

Импорт `import ImportModal from './ImportModal';`, состояние `const [importing, setImporting] = useState(false);`.

Рядом с кнопкой «Создать» (после `deck-create-row`):

```tsx
      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => setImporting(true)}>
          Импорт из Anki
        </Button>
      </div>
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={() => refreshDecks()}
        />
      )}
```

- [ ] **Step 3: Проверка**

Run: `npm run build` — успех. `npm run dev`:
- Anki закрыт → «Импорт из Anki» → понятная ошибка.
- Anki запущен → список колод с количеством нот → импорт → прогресс → колоды и карточки появляются, аудио играет в Review.

- [ ] **Step 4: Commit**

```powershell
git add src/renderer/components/Decks
git commit -m "feat: one-time Anki import UI with progress"
```

---

### Task 14: Удаление AnkiConnect-экспорта и чистка Settings

**Files:**
- Delete: `src/main/ipc/anki.handlers.ts`
- Delete: `src/renderer/hooks/useAddToAnki.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/global.d.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/main/services/anki-connect.service.ts`
- Modify: `src/renderer/components/Settings/Settings.tsx`
- Modify: `src/renderer/store/index.ts`

- [ ] **Step 1: Удалить файлы**

```powershell
git rm src/main/ipc/anki.handlers.ts src/renderer/hooks/useAddToAnki.ts
```

- [ ] **Step 2: `src/main/index.ts` — убрать строки**

```diff
-import { setupAnkiHandlers } from './ipc/anki.handlers';
```

```diff
-  setupAnkiHandlers(ipcMain);
```

- [ ] **Step 3: `src/main/preload.ts` — удалить блок `anki: { ... }` целиком (строки с комментарием `// AnkiConnect APIs` до закрывающей `},` включительно)**

- [ ] **Step 4: `src/renderer/global.d.ts` — удалить блок `anki: {...};` из `ElectronAPI` и `AnkiNote` из импорта**

- [ ] **Step 5: `src/shared/types/index.ts` — удалить:**

- Интерфейсы `AnkiDeck`, `AnkiModel`, `AnkiNote` (блок `// Anki types`).
- Из `IPC_CHANNELS` — все 8 ключей `ANKI_*` вместе с комментарием `// AnkiConnect`.
- Из `AppSettings` — поля `selectedDeck?` и `selectedModel?`.

В `src/main/services/settings.service.ts` удалить `selectedDeck`/`selectedModel` из `SettingsSchema` и из `getAll()` (ключи в electron-store у старых пользователей просто игнорируются; `fieldMapping` ОСТАВИТЬ — нужен импорту).

- [ ] **Step 6: `src/main/services/anki-connect.service.ts` — оставить только нужное импорту**

Удалить методы `getModelNames`, `getModelFieldNames`, `storeMediaFile`, `addNote`, `addNotes` и импорт `AnkiNote`. Остаются: `invoke`, `checkConnection`, `getDeckNames`, `findNotes`, `notesInfo`, `retrieveMediaFile`.

- [ ] **Step 7: Переписать `src/renderer/components/Settings/Settings.tsx`**

Удалить секции «Anki Connection» и «Anki Settings» (deck/model) и «Field Mapping»; `exampleCount` перенести в секцию AI. Новый файл:

```tsx
import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { AI_PROVIDERS } from '../../../shared/types';
import './Settings.css';

const Settings: React.FC = () => {
  const {
    geminiApiKey,
    aiProvider,
    aiModel,
    aiBaseUrl,
    exampleCount,
    setGeminiApiKey,
    setAiProvider,
    setAiModel,
    setAiBaseUrl,
    setExampleCount,
    loadSettings,
    saveSettings
  } = useStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await saveSettings();
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: any) {
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentProvider =
    AI_PROVIDERS.find((p) => p.id === aiProvider) || AI_PROVIDERS[0];
  const isCustomProvider = aiProvider === 'custom';

  const providerOptions = AI_PROVIDERS.map((p) => ({
    value: p.id,
    label: p.label
  }));
  const aiModelOptions = currentProvider.models.map((m) => ({
    value: m,
    label: m
  }));

  const handleProviderChange = (providerId: string) => {
    setAiProvider(providerId);
    const preset = AI_PROVIDERS.find((p) => p.id === providerId);
    if (preset && preset.defaultModel) {
      setAiModel(preset.defaultModel);
    }
  };

  const exampleCountOptions = [
    { value: '1', label: '1 example' },
    { value: '2', label: '2 examples' },
    { value: '3', label: '3 examples' },
    { value: '4', label: '4 examples' },
    { value: '5', label: '5 examples' }
  ];

  return (
    <div className="settings">
      <h2>Setup & Configuration</h2>
      <p className="description">Configure AI provider and generation.</p>

      <div className="settings-section">
        <h3>AI Provider</h3>
        <Select
          label="Provider"
          value={aiProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          options={providerOptions}
        />

        {isCustomProvider ? (
          <>
            <Input
              label="Base URL (OpenAI-compatible endpoint)"
              type="text"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://your-endpoint/v1"
            />
            <Input
              label="Model"
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="model-name"
            />
          </>
        ) : (
          <Select
            label="Model"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            options={aiModelOptions}
          />
        )}

        <Input
          label="AI API Key"
          type="password"
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
          placeholder="Enter the API key for the selected provider"
        />
        {aiProvider === 'proxyapi' && (
          <p className="help-text">
            Get your ProxyAPI key from{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.electronAPI.shell.openExternal('https://proxyapi.ru/cabinet/api');
              }}
            >
              ProxyAPI Cabinet
            </a>
          </p>
        )}

        <Select
          label="Number of Example Sentences"
          value={exampleCount.toString()}
          onChange={(e) => setExampleCount(parseInt(e.target.value))}
          options={exampleCountOptions}
        />
      </div>

      <div className="save-section">
        <Button onClick={handleSave} disabled={isSaving} size="large">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saveMessage && (
          <span className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default Settings;
```

- [ ] **Step 8: Чистка `src/renderer/store/index.ts`**

Удалить:
- Функцию `autoMapFields` целиком (строки 11–91) и импорты `DataSource`, `FieldMapping`.
- Из `AppState` и реализации: `selectedDeck`, `selectedModel`, `fieldMapping`, `availableDecks`, `availableModels`, `availableFields`, `ankiConnected` и все их сеттеры (`setSelectedDeck`, `setSelectedModel`, `setFieldMapping`, `setAvailableDecks`, `setAvailableModels`, `setAvailableFields`, `setAnkiConnected`).
- Из `loadSettings`: строки `selectedDeck: ...`, `selectedModel: ...`, `fieldMapping: ...` и весь блок `if (settings.selectedModel) { ... }`.
- Из `saveSettings`: вызовы `set('selectedDeck', ...)`, `set('selectedModel', ...)`, `set('fieldMapping', ...)`.

Оставить: AI-настройки, `exampleCount`, `defaultDeckId`, generation-слайс, words-слайс, decks-слайс.

- [ ] **Step 9: Полная проверка**

Run: `npm test` — Expected: PASS все тесты.
Run: `npm run build` — Expected: успех, 0 ошибок TS.
Run: `Select-String -Path src -Pattern 'ANKI_|useAddToAnki|setupAnkiHandlers' -Recurse` — единственные допустимые попадания: `anki-connect.service.ts` (внутреннее имя класса), `import.*`-файлы. В renderer попаданий быть не должно.
Run: `npm run dev` — приложение работает: Setup без Anki-секций, Decks/Browse/Review работают, импорт работает.

- [ ] **Step 10: Commit**

```powershell
git add -A
git commit -m "refactor: remove AnkiConnect export path, clean Settings"
```

---

### Task 15: Финальная верификация

- [ ] **Step 1: Прогнать всё**

```powershell
npm test
npm run build
```

Expected: все тесты PASS, сборка без ошибок.

- [ ] **Step 2: Ручной сквозной сценарий (`npm run dev`)**

1. Setup: AI-ключ на месте, Anki-секций нет.
2. Decks: создать колоду «Тест».
3. Input: ввести 2–3 слова → Generate → Preview: выбрать «Тест», сохранить.
4. Decks: у «Тест» появились новые карточки (синий счётчик).
5. «Учить»: фронт → пробел → бэк с интервалами на кнопках → «Хорошо» → следующая; аудио проигрывается.
6. Browse: найти слово по тексту; отфильтровать по колоде/статусу; отредактировать карточку; выделить и переместить/удалить.
7. Перезапуск приложения: всё на месте (БД сохранилась).
8. (Если установлен Anki) Импорт из Anki: список колод → импорт → карточки в Browse, аудио в Review.

- [ ] **Step 3: Финальный commit (если были правки) и итоговое сообщение пользователю**

Перечислить, что проверено: тесты ✓, сборка ✓, сквозной сценарий ✓, персистентность ✓.

---

## Самопроверка плана (выполнена)

- Покрытие спеки: схема БД (Task 3–4), FSRS+очередь+лимиты (Task 5), медиа (Task 6), импорт с маппингом и `[sound:]` (Task 7, 13), персистентность с бэкапом битого файла (Task 8), IPC (Task 8), Decks UI (Task 9), Review с хоткеями и автоплеем (Task 10), Browse с фильтрами/пагинацией/редактированием (Task 11), сохранение генерации + дубликаты (Task 12), удаление AnkiConnect и чистка Settings (Task 14), vitest (Task 1, тесты в Task 3–7).
- Известные риски, заложенные в план: типы sql.js (fallback `@types/sql.js`), версия ts-fsrs (`learning_steps`), запрет `window.prompt` в Electron (inline rename), `refresh()` в Browser через `reloadKey`.
