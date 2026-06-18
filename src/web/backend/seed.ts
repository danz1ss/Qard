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

/** Если в базе нет колод — создаёт магнит-колоды A1/A2/B1. Идемпотентно. */
export async function seedIfEmpty(col: CollectionService): Promise<void> {
  if (col.listDecks(Date.now()).length > 0) {
    return;
  }
  const now = Date.now();
  for (const seed of SEEDS) {
    const deck = col.createDeck(seed.name);
    const inputs: NewCardInput[] = seed.cards.map((c) => ({
      word: c.word,
      wordType: c.wordType,
      definition: c.definition,
      definitionExample: c.definitionExample,
      transcription: c.transcription,
      examples: c.examples,
      audioFilename: null,
      tags: '',
    }));
    col.addCards(deck.id, inputs, now);
  }
}
