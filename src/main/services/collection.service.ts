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

  /** Ключи "word definition" (lowercase) для дедупликации импорта. */
  listCardKeys(deckId: number): string[] {
    return this.all(
      'SELECT word, definition FROM cards WHERE deck_id = ?',
      [deckId]
    ).map(
      (r) =>
        `${(r.word as string).toLowerCase()} ${(r.definition as string).toLowerCase()}`
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
}
