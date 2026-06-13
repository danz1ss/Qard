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

  deleteCards(_ids: number[]): string[] {
    throw new Error('not implemented yet (Task 4)');
  }
}
