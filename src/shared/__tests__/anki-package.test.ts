import { beforeAll, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import initSqlJs, { SqlJsStatic } from 'sql.js';
import * as zlib from 'node:zlib';
import { parseAnkiPackage } from '../anki-package';
import { CollectionService } from '../../main/services/collection.service';
import { importParsedAnkiPackage } from '../../main/services/import.package';

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs();
});

async function legacyPackage(): Promise<Uint8Array> {
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE col (decks TEXT NOT NULL, models TEXT NOT NULL);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, odid INTEGER);
  `);
  const decks = JSON.stringify({
    '10': { id: 10, name: 'English' },
    '11': { id: 11, name: 'English::Verbs' }
  });
  const models = JSON.stringify({
    '20': {
      id: 20,
      flds: [
        { name: 'Front', ord: 0 },
        { name: 'Back', ord: 1 }
      ]
    }
  });
  db.run('INSERT INTO col (decks, models) VALUES (?, ?)', [decks, models]);
  db.run('INSERT INTO notes (id, mid, tags, flds) VALUES (?, ?, ?, ?)', [
    1,
    20,
    ' language common ',
    'hello [sound:hello.mp3]\u001fa greeting'
  ]);
  db.run('INSERT INTO notes (id, mid, tags, flds) VALUES (?, ?, ?, ?)', [
    2,
    20,
    '',
    'run\u001fto move quickly'
  ]);
  // Две карточки одной ноты в одной колоде должны превратиться в одну карточку Qard.
  db.run('INSERT INTO cards VALUES (1, 1, 10, 0), (2, 1, 10, 0), (3, 2, 11, 0)');
  const bytes = db.export();
  db.close();

  const zip = new JSZip();
  zip.file('collection.anki2', bytes);
  zip.file('media', JSON.stringify({ '0': 'hello.mp3' }));
  zip.file('0', new Uint8Array([1, 2, 3, 4]));
  return zip.generateAsync({ type: 'uint8array' });
}

async function modernPackage(): Promise<Uint8Array> {
  const compress = (zlib as any).zstdCompressSync as (data: Uint8Array) => Buffer;
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, common BLOB, kind BLOB);
    CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT, config BLOB, PRIMARY KEY (ntid, ord));
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, odid INTEGER);
  `);
  db.run("INSERT INTO decks VALUES (50, ?, 0, 0, X'', X'')", ['Modern\u001fDeck']);
  db.run("INSERT INTO fields VALUES (60, 0, 'Question', X''), (60, 1, 'Answer', X'')");
  db.run('INSERT INTO notes VALUES (?, ?, ?, ?)', [
    5,
    60,
    'modern',
    'question [sound:modern.ogg]\u001fanswer'
  ]);
  db.run('INSERT INTO cards VALUES (5, 5, 50, 0)');
  const collection = db.export();
  db.close();

  const mediaName = new TextEncoder().encode('modern.ogg');
  const inner = new Uint8Array([0x0a, mediaName.length, ...mediaName]);
  const mediaMap = new Uint8Array([0x0a, inner.length, ...inner]);
  const zip = new JSZip();
  zip.file('collection.anki21b', compress(collection));
  zip.file('media', compress(mediaMap));
  zip.file('0', compress(new Uint8Array([9, 8, 7])));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('Anki package import', () => {
  it('reads legacy .apkg decks, notes and referenced media', async () => {
    const parsed = await parseAnkiPackage(await legacyPackage(), {
      includeMedia: true,
      sqlJs: SQL
    });

    expect(parsed.decks).toEqual([
      { name: 'English', noteCount: 1 },
      { name: 'English::Verbs', noteCount: 1 }
    ]);
    expect(parsed.notes).toHaveLength(2);
    expect(parsed.notes[0].fields).toEqual({
      Front: 'hello [sound:hello.mp3]',
      Back: 'a greeting'
    });
    expect(Array.from(parsed.media.get('hello.mp3')!)).toEqual([1, 2, 3, 4]);
  });

  it('reads current zstd-compressed Anki packages', async () => {
    const parsed = await parseAnkiPackage(await modernPackage(), {
      includeMedia: true,
      sqlJs: SQL
    });

    expect(parsed.decks).toEqual([{ name: 'Modern::Deck', noteCount: 1 }]);
    expect(parsed.notes[0].fields).toEqual({
      Question: 'question [sound:modern.ogg]',
      Answer: 'answer'
    });
    expect(Array.from(parsed.media.get('modern.ogg')!)).toEqual([9, 8, 7]);
  });

  it('imports selected decks and skips duplicates on repeat import', async () => {
    const parsed = await parseAnkiPackage(await legacyPackage(), {
      includeMedia: true,
      sqlJs: SQL
    });
    const collection = new CollectionService();
    await collection.init(undefined, SQL);
    const saved: string[] = [];
    const progress: boolean[] = [];

    const first = await importParsedAnkiPackage(
      collection,
      parsed,
      ['English'],
      {},
      async (filename) => { saved.push(filename); },
      (event) => { progress.push(event.finished); }
    );
    const second = await importParsedAnkiPackage(
      collection,
      parsed,
      ['English'],
      {},
      async () => {},
      () => {}
    );

    expect(first).toEqual({ imported: 1, skipped: 0, errors: 0 });
    expect(second).toEqual({ imported: 0, skipped: 1, errors: 0 });
    expect(saved).toEqual(['hello.mp3']);
    expect(progress.at(-1)).toBe(true);
    const deck = collection.getDeckByName('English')!;
    const cards = collection.searchCards({ deckId: deck.id, limit: 20, offset: 0 });
    expect(cards.total).toBe(1);
    expect(cards.cards[0].word).toBe('hello');
    expect(cards.cards[0].definition).toBe('a greeting');
    expect(cards.cards[0].tags).toBe('imported language common');
    expect(cards.cards[0].audioFilename).toBe('hello.mp3');
  });
});
