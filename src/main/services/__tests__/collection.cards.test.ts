import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import { CollectionService } from '../collection.service';
import { CardState, NewCardInput } from '../../../shared/types';
import { planCardSave, reviewMeaning } from '../../../shared/utils/meanings';

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

  it('persists adaptive translation fields', () => {
    const [id] = col.addCards(
      deckId,
      [input('house', {
        translation: 'дом',
        definitionExampleTranslation: 'Это мой дом.'
      })],
      Date.now()
    );
    const card = col.getCard(id)!;
    expect(card.translation).toBe('дом');
    expect(card.definitionExampleTranslation).toBe('Это мой дом.');
  });

  it('migrates an existing collection without losing cards', async () => {
    const SQL = await initSqlJs();
    const current = new CollectionService();
    await current.init(undefined, SQL);
    const currentDeck = current.createDeck('Legacy').id;
    current.addCards(currentDeck, [input('legacy')], Date.now());

    const legacyDb = new SQL.Database(current.export());
    legacyDb.run('ALTER TABLE cards DROP COLUMN definition_example_translation');
    legacyDb.run('ALTER TABLE cards DROP COLUMN translation');
    legacyDb.run('ALTER TABLE cards DROP COLUMN secondary_meaning_json');
    legacyDb.run("UPDATE meta SET value = '1' WHERE key = 'schema_version'");

    const migrated = new CollectionService();
    await migrated.init(legacyDb.export(), SQL);
    const card = migrated.searchCards({ text: 'legacy', limit: 10, offset: 0 }).cards[0];
    expect(card.word).toBe('legacy');
    expect(card.translation).toBe('');
    expect(card.definitionExampleTranslation).toBe('');
    expect(reviewMeaning(card)).toEqual(card);
  });

  it('merges a distinct meaning into the reviewed card and preserves its review history', async () => {
    const river = { wordType: 'noun', definition: 'Land beside a river', translation: 'берег', definitionExample: 'We sat on the <b>bank</b>.', examples: [] };
    const primary = input('Bank', { translation: 'банк', definition: 'A place that keeps your money' });
    const [id] = col.addGeneratedCards(deckId, [primary, { ...primary, word: 'bank' }], 100);
    const review = { cardId: id, rating: 3 as const, state: CardState.Review, due: 1000, stability: 10, difficulty: 3, elapsedDays: 4, scheduledDays: 9, reviewedAt: 400 };
    col.applyAnswer({ ...review, id, reps: 1, lapses: 0, learningSteps: 0, lastReview: 400 }, review);
    const existing = col.searchCards({ deckId, words: ['BANK'], limit: -1, offset: 0 }).cards;
    expect(existing).toHaveLength(1);
    expect(planCardSave({ ...primary, definition: 'An institution for money' }, existing).kind).toBe('duplicate');
    expect(planCardSave({ ...primary, secondaryMeaning: river }, existing)).toMatchObject({ kind: 'merge', target: { id }, novel: [river] });
    col.export(); // Web autosave exports a live database between these actions.
    expect(col.appendCardMeaning(deckId, id, 'bank', river)).toBe(true);
    expect(col.appendCardMeaning(deckId, id, 'bank', { ...river, translation: 'другое', definition: 'another meaning' })).toBe(false);
    expect(col.addGeneratedCards(deckId, [primary], 500)).toEqual([]);
    const restored = new CollectionService();
    await restored.init(col.export());
    const saved = restored.getCard(id)!;
    expect(saved).toMatchObject({ id, reps: 1, due: 1000, lastReview: 400, secondaryMeaning: river });
    expect(reviewMeaning(saved)).toEqual(river);
    expect(reviewMeaning({ ...saved, reps: 2 }).translation).toBe('банк');
    expect(restored.getStudyStats(500).reviewedTotal).toBe(1);
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
