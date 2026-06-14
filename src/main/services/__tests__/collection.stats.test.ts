import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService, dayStart } from '../collection.service';
import { CardState, NewCardInput, ReviewRating } from '../../../shared/types';

const DAY = 24 * 60 * 60 * 1000;
const NOON = 12 * 60 * 60 * 1000; // полдень — устойчиво к границам суток

function input(word: string): NewCardInput {
  return {
    word,
    wordType: '',
    definition: `def ${word}`,
    definitionExample: '',
    transcription: '',
    examples: []
  };
}

describe('CollectionService: study stats', () => {
  let col: CollectionService;
  let cardId: number;
  const now = Date.now();

  beforeEach(async () => {
    col = new CollectionService();
    await col.init();
    const deckId = col.createDeck('D').id;
    cardId = col.addCards(deckId, [input('w')], now)[0];
  });

  /** Записывает один повтор с заданным временем (через публичный applyAnswer). */
  function logAt(reviewedAt: number, rating: ReviewRating = 3): void {
    col.applyAnswer(
      {
        id: cardId,
        state: CardState.Review,
        due: reviewedAt + DAY,
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        learningSteps: 0,
        reps: 1,
        lapses: 0,
        lastReview: reviewedAt
      },
      {
        cardId,
        rating,
        state: CardState.Review,
        due: reviewedAt + DAY,
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        reviewedAt
      }
    );
  }

  /** Полдень дня, отстоящего на `offset` суток от сегодня (offset ≤ 0 — в прошлом). */
  function dayNoon(offset: number): number {
    return dayStart(now + offset * DAY) + NOON;
  }

  it('пустой лог → нули, но 7 бакетов', () => {
    const s = col.getStudyStats(now);
    expect(s.streakDays).toBe(0);
    expect(s.studiedToday).toBe(0);
    expect(s.reviewedTotal).toBe(0);
    expect(s.last7Days).toHaveLength(7);
  });

  it('считает повторы за сегодня и общий счёт', () => {
    logAt(dayNoon(0));
    logAt(dayNoon(0));
    const s = col.getStudyStats(now);
    expect(s.studiedToday).toBe(2);
    expect(s.reviewedTotal).toBe(2);
    expect(s.streakDays).toBe(1);
  });

  it('streak считает подряд идущие дни до сегодня', () => {
    logAt(dayNoon(0));
    logAt(dayNoon(-1));
    logAt(dayNoon(-2));
    expect(col.getStudyStats(now).streakDays).toBe(3);
  });

  it('streak жив, если учил вчера, но не сегодня', () => {
    logAt(dayNoon(-1));
    logAt(dayNoon(-2));
    const s = col.getStudyStats(now);
    expect(s.studiedToday).toBe(0);
    expect(s.streakDays).toBe(2);
  });

  it('streak рвётся на пропуске', () => {
    logAt(dayNoon(0)); // сегодня
    logAt(dayNoon(-2)); // позавчера, вчера — пропуск
    expect(col.getStudyStats(now).streakDays).toBe(1);
  });

  it('last7Days содержит поденные счётчики, сегодня — последний', () => {
    logAt(dayNoon(0));
    logAt(dayNoon(0));
    logAt(dayNoon(-1));
    const s = col.getStudyStats(now);
    expect(s.last7Days[6].count).toBe(2); // сегодня
    expect(s.last7Days[5].count).toBe(1); // вчера
    expect(s.last7Days[6].dayStart).toBe(dayStart(now));
  });
});
