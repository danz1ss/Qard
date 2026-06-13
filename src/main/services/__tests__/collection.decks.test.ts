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
