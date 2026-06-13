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
