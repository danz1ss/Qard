import { CardMeaning, StoredCard } from '../types';

export function normalizeWord(word: string): string {
  return word.normalize('NFKC').trim().toLowerCase();
}

function normalizeClue(text: string): string {
  return normalizeWord(text.replace(/<[^>]*>/g, ' ')).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function sameMeaning(a: CardMeaning, b: CardMeaning): boolean {
  const aType = normalizeClue(a.wordType);
  const bType = normalizeClue(b.wordType);
  if (aType && bType && aType !== bType) return false;
  const definition = normalizeClue(a.definition);
  if (definition && definition === normalizeClue(b.definition)) return true;
  const translations = (text?: string) => (text ?? '').split(/[;,/]/).map(normalizeClue).filter(Boolean);
  const known = new Set(translations(b.translation));
  return translations(a.translation).some((item) => known.has(item));
}

export function cardMeanings<T extends CardMeaning>(card: T & { secondaryMeaning?: CardMeaning }): CardMeaning[] {
  return card.secondaryMeaning ? [card, card.secondaryMeaning] : [card];
}

export function hasTwoMeanings(meanings: CardMeaning[]): boolean {
  return meanings.length > 1 && meanings.slice(1).some(meaning => !sameMeaning(meanings[0], meaning));
}

export function reviewMeaning(card: StoredCard): CardMeaning {
  return card.secondaryMeaning && card.reps % 2 === 1 ? card.secondaryMeaning : card;
}

export function planCardSave(card: CardMeaning & { word: string; secondaryMeaning?: CardMeaning }, deck: StoredCard[]) {
  const existing = deck.filter(item => normalizeWord(item.word) === normalizeWord(card.word));
  if (!existing.length) return { kind: 'new' } as const;

  const incoming = cardMeanings(card);
  const known = existing.flatMap(cardMeanings);
  const novel = incoming.filter(meaning => !known.some(previous => sameMeaning(previous, meaning)));
  if (!novel.length) return { kind: 'duplicate' } as const;
  if (hasTwoMeanings(known)) return { kind: 'full' } as const;

  const open = existing.filter(item => !item.secondaryMeaning);
  const target = open.find(item => incoming.some(meaning => sameMeaning(item, meaning))) ?? open[0];
  if (!target) return { kind: 'full' } as const;
  return { kind: 'merge', target, novel } as const;
}
