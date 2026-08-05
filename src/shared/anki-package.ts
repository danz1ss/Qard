import JSZip from 'jszip';
import { decompress } from 'fzstd';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { ImportDeckChoice } from './types';

const FIELD_SEPARATOR = '\u001f';
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_COLLECTION_BYTES = 512 * 1024 * 1024;

export interface ParsedAnkiNote {
  deckName: string;
  fields: Record<string, string>;
  tags: string;
}

export interface ParsedAnkiPackage {
  decks: ImportDeckChoice[];
  notes: ParsedAnkiNote[];
  media: Map<string, Uint8Array>;
}

export interface ParseAnkiPackageOptions {
  includeMedia?: boolean;
  sqlJs?: SqlJsStatic;
}

function all(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  try {
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
}

function hasTable(db: Database, name: string): boolean {
  return all(
    db,
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name]
  ).length > 0;
}

function displayDeckName(name: string): string {
  return name.replace(/\u001f/g, '::').trim() || 'Default';
}

function readLegacyJson(db: Database, column: 'decks' | 'models'): any {
  const row = all(db, `SELECT ${column} AS value FROM col LIMIT 1`)[0];
  if (!row || typeof row.value !== 'string') return {};
  try {
    return JSON.parse(row.value);
  } catch {
    throw new Error('Файл Anki повреждён: не удалось прочитать структуру коллекции.');
  }
}

function readDeckNames(db: Database): Map<string, string> {
  const result = new Map<string, string>();
  if (hasTable(db, 'decks')) {
    for (const row of all(db, 'SELECT id, name FROM decks')) {
      result.set(String(row.id), displayDeckName(String(row.name ?? '')));
    }
  } else {
    const decks = readLegacyJson(db, 'decks');
    for (const [id, deck] of Object.entries<any>(decks)) {
      result.set(String(id), displayDeckName(String(deck?.name ?? '')));
    }
  }
  return result;
}

function readFieldNames(db: Database): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (hasTable(db, 'fields')) {
    for (const row of all(db, 'SELECT ntid, ord, name FROM fields')) {
      const id = String(row.ntid);
      const names = result.get(id) ?? [];
      names[Number(row.ord)] = String(row.name ?? '');
      result.set(id, names);
    }
  } else {
    const models = readLegacyJson(db, 'models');
    for (const [id, model] of Object.entries<any>(models)) {
      const fields = Array.isArray(model?.flds) ? model.flds : [];
      const names: string[] = [];
      for (const field of fields) names[Number(field?.ord ?? names.length)] = String(field?.name ?? '');
      result.set(String(id), names);
    }
  }
  return result;
}

function parseNotes(db: Database): { notes: ParsedAnkiNote[]; counts: Map<string, number> } {
  if (!hasTable(db, 'notes') || !hasTable(db, 'cards')) {
    throw new Error('В файле Anki не найдены карточки.');
  }

  const decks = readDeckNames(db);
  const fieldNames = readFieldNames(db);
  const notes: ParsedAnkiNote[] = [];
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const rows = all(
    db,
    `SELECT n.id AS nid, n.mid AS mid, n.flds AS flds, n.tags AS tags,
            c.did AS did, c.odid AS odid
       FROM notes n JOIN cards c ON c.nid = n.id`
  );

  for (const row of rows) {
    const deckId = Number(row.odid) !== 0 ? String(row.odid) : String(row.did);
    const uniqueKey = `${String(row.nid)}:${deckId}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    const deckName = decks.get(deckId) ?? 'Default';
    const values = String(row.flds ?? '').split(FIELD_SEPARATOR);
    const names = fieldNames.get(String(row.mid)) ?? [];
    const fields: Record<string, string> = {};
    for (let i = 0; i < values.length; i++) {
      const base = names[i]?.trim() || `Field ${i + 1}`;
      let name = base;
      let suffix = 2;
      while (Object.prototype.hasOwnProperty.call(fields, name)) name = `${base} ${suffix++}`;
      fields[name] = values[i];
    }
    notes.push({ deckName, fields, tags: String(row.tags ?? '').trim() });
    counts.set(deckName, (counts.get(deckName) ?? 0) + 1);
  }

  return { notes, counts };
}

function readVarint(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  while (offset < data.length && shift < 35) {
    const byte = data[offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, offset];
    shift += 7;
  }
  throw new Error('Файл Anki повреждён: некорректная таблица медиа.');
}

function skipProtoField(data: Uint8Array, offset: number, wire: number): number {
  if (wire === 0) return readVarint(data, offset)[1];
  if (wire === 1) return offset + 8;
  if (wire === 2) {
    const [length, next] = readVarint(data, offset);
    return next + length;
  }
  if (wire === 5) return offset + 4;
  throw new Error('Файл Anki повреждён: неизвестный формат таблицы медиа.');
}

/** Декодирует только имена из Anki MediaEntries protobuf; индекс сообщения равен имени ZIP-файла. */
export function decodeModernMediaNames(data: Uint8Array): string[] {
  const decoder = new TextDecoder();
  const names: string[] = [];
  let offset = 0;
  while (offset < data.length) {
    const [tag, afterTag] = readVarint(data, offset);
    offset = afterTag;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (field !== 1 || wire !== 2) {
      offset = skipProtoField(data, offset, wire);
      continue;
    }
    const [length, start] = readVarint(data, offset);
    const end = start + length;
    if (end > data.length) throw new Error('Файл Anki повреждён: обрезана таблица медиа.');
    let inner = start;
    let name = '';
    while (inner < end) {
      const [innerTag, afterInnerTag] = readVarint(data, inner);
      inner = afterInnerTag;
      const innerField = innerTag >>> 3;
      const innerWire = innerTag & 7;
      if (innerField === 1 && innerWire === 2) {
        const [nameLength, nameStart] = readVarint(data, inner);
        name = decoder.decode(data.subarray(nameStart, nameStart + nameLength));
        inner = nameStart + nameLength;
      } else {
        inner = skipProtoField(data, inner, innerWire);
      }
    }
    names.push(name);
    offset = end;
  }
  return names;
}

function validMediaFilename(name: string): boolean {
  return Boolean(name) && name.length <= 255 && !/[\\/\0]/.test(name) && name !== '.' && name !== '..';
}

function referencedMedia(notes: ParsedAnkiNote[]): Set<string> {
  const refs = new Set<string>();
  const sound = /\[sound:([^\]]+)\]/gi;
  for (const note of notes) {
    for (const value of Object.values(note.fields)) {
      let match: RegExpExecArray | null;
      while ((match = sound.exec(value))) if (validMediaFilename(match[1])) refs.add(match[1]);
      sound.lastIndex = 0;
    }
  }
  return refs;
}

async function readMedia(
  zip: JSZip,
  modern: boolean,
  notes: ParsedAnkiNote[]
): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  const mediaEntry = zip.file('media');
  if (!mediaEntry) return result;
  let mediaData = await mediaEntry.async('uint8array');
  if (modern) mediaData = decompress(mediaData);

  let names: string[];
  if (modern) {
    names = decodeModernMediaNames(mediaData);
  } else {
    try {
      const map = JSON.parse(new TextDecoder().decode(mediaData)) as Record<string, string>;
      names = [];
      for (const [index, name] of Object.entries(map)) names[Number(index)] = name;
    } catch {
      throw new Error('Файл Anki повреждён: не удалось прочитать список медиа.');
    }
  }

  const wanted = referencedMedia(notes);
  for (let index = 0; index < names.length; index++) {
    const name = names[index];
    if (!wanted.has(name) || !validMediaFilename(name)) continue;
    const entry = zip.file(String(index));
    if (!entry) continue;
    let bytes = await entry.async('uint8array');
    if (modern) bytes = decompress(bytes);
    result.set(name, bytes);
  }
  return result;
}

export async function parseAnkiPackage(
  data: Uint8Array,
  options: ParseAnkiPackageOptions = {}
): Promise<ParsedAnkiPackage> {
  if (data.byteLength === 0 || data.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error('Файл Anki пустой или слишком большой (максимум 512 МБ).');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Не удалось открыть файл. Выберите экспорт Anki в формате .apkg или .colpkg.');
  }

  const modernEntry = zip.file('collection.anki21b');
  const legacyEntry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
  const collectionEntry = modernEntry ?? legacyEntry;
  if (!collectionEntry) {
    throw new Error('В пакете не найдена коллекция Anki.');
  }

  let collectionBytes = await collectionEntry.async('uint8array');
  try {
    if (modernEntry) collectionBytes = decompress(collectionBytes);
  } catch {
    throw new Error('Не удалось распаковать современный файл Anki.');
  }
  if (collectionBytes.byteLength > MAX_COLLECTION_BYTES) {
    throw new Error('Коллекция Anki слишком большая (максимум 512 МБ после распаковки).');
  }

  const SQL = options.sqlJs ?? (await initSqlJs());
  let db: Database;
  try {
    db = new SQL.Database(collectionBytes);
  } catch {
    throw new Error('Внутри пакета находится повреждённая база Anki.');
  }

  try {
    const { notes, counts } = parseNotes(db);
    const decks = [...counts.entries()]
      .map(([name, noteCount]) => ({ name, noteCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const media = options.includeMedia ? await readMedia(zip, Boolean(modernEntry), notes) : new Map();
    return { decks, notes, media };
  } finally {
    db.close();
  }
}
