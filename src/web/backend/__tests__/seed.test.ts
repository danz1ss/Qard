// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import { CollectionService } from '../../../main/services/collection.service';
import { seedIfEmpty } from '../seed';

describe('seed', () => {
  it('создаёт магнит-колоды в пустой базе', async () => {
    const SQL = await initSqlJs();
    const col = new CollectionService();
    await col.init(undefined, SQL);
    await seedIfEmpty(col);
    const decks = col.listDecks(Date.now());
    const names = decks.map((d) => d.name).sort();
    expect(names).toContain('Vocabulary A1');
    expect(names).toContain('Vocabulary A2');
    expect(names).toContain('Vocabulary B1');
    expect(decks.find((d) => d.name === 'Vocabulary A1')!.totalCards).toBeGreaterThan(0);
  });

  it('не дублирует колоды при повторном вызове', async () => {
    const SQL = await initSqlJs();
    const col = new CollectionService();
    await col.init(undefined, SQL);
    await seedIfEmpty(col);
    await seedIfEmpty(col);
    expect(col.listDecks(Date.now())).toHaveLength(3);
  });
});
