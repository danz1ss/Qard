import { CollectionService } from '../../main/services/collection.service';
import { NewCardInput } from '../../shared/types';
import a1 from '../seed-data/a1.json';
import a2 from '../seed-data/a2.json';
import b1 from '../seed-data/b1.json';

interface SeedDeck {
  name: string;
  cards: Array<Omit<NewCardInput, 'tags' | 'audioFilename'>>;
}

const SEEDS: SeedDeck[] = [a1 as SeedDeck, a2 as SeedDeck, b1 as SeedDeck];

function toInput(c: SeedDeck['cards'][number]): NewCardInput {
  return {
    word: c.word,
    wordType: c.wordType,
    definition: c.definition,
    definitionExample: c.definitionExample,
    translation: c.translation,
    definitionExampleTranslation: c.definitionExampleTranslation,
    transcription: c.transcription,
    examples: c.examples,
    audioFilename: null,
    tags: '',
  };
}

/** Создаёт стартовые колоды и дополняет их новыми адаптивными полями. Идемпотентно. */
export async function seedIfEmpty(col: CollectionService): Promise<void> {
  const decks = col.listDecks(Date.now());
  if (decks.length > 0) {
    for (const seed of SEEDS) {
      const deck = decks.find((candidate) => candidate.name === seed.name);
      if (!deck) continue;
      const cards = col.searchCards({ deckId: deck.id, limit: 1000, offset: 0 }).cards;
      const byWord = new Map(cards.map((card) => [card.word.toLowerCase(), card]));
      for (const seedCard of seed.cards) {
        const card = byWord.get(seedCard.word.toLowerCase());
        if (!card || (card.translation && card.definitionExampleTranslation)) continue;
        col.updateCardText({
          id: card.id,
          word: card.word,
          wordType: card.wordType,
          definition: card.definition,
          definitionExample: card.definitionExample,
          translation: card.translation || seedCard.translation || '',
          definitionExampleTranslation:
            card.definitionExampleTranslation || seedCard.definitionExampleTranslation || '',
          transcription: card.transcription,
          examples: card.examples,
          tags: card.tags,
        });
      }
    }
    return;
  }
  const now = Date.now();
  for (const seed of SEEDS) {
    const deck = col.createDeck(seed.name);
    const inputs: NewCardInput[] = seed.cards.map(toInput);
    col.addCards(deck.id, inputs, now);
  }
}
