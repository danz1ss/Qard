import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService } from '../collection.service';
import { SchedulerService, formatInterval } from '../scheduler.service';
import { CardState, NewCardInput } from '../../../shared/types';

const DAY = 24 * 60 * 60 * 1000;

function input(word: string): NewCardInput {
  return {
    word,
    wordType: '',
    definition: 'd',
    definitionExample: '',
    transcription: '',
    examples: []
  };
}

describe('SchedulerService', () => {
  let col: CollectionService;
  let sched: SchedulerService;
  let deckId: number;
  // Фиксированный "сейчас": полдень, чтобы дневные границы были стабильны
  const t0 = new Date(2026, 5, 13, 12, 0, 0).getTime();

  beforeEach(async () => {
    col = new CollectionService();
    await col.init();
    deckId = col.createDeck('D').id;
    sched = new SchedulerService(col);
  });

  it('serves new cards and respects daily new limit', () => {
    col.updateDeckLimits(deckId, 2, 200);
    col.addCards(deckId, [input('a'), input('b'), input('c')], t0);

    let q = sched.getQueue(deckId, t0);
    expect(q.newCount).toBe(2); // лимит 2, хотя новых 3
    expect(q.current!.state).toBe(CardState.New);

    // Отвечаем Good на 2 новые
    q = sched.answer(q.current!.id, 3, t0);
    expect(q.current).not.toBeNull();
    q = sched.answer(q.current!.id, 3, t0 + 1000);

    // Лимит новых исчерпан: третью новую не предлагает
    expect(q.newCount).toBe(0);
    if (q.current) {
      expect(q.current.state).not.toBe(CardState.New);
    }
  });

  it('moves a new card into learning and grows intervals with Good', () => {
    col.addCards(deckId, [input('w')], t0);
    let q = sched.getQueue(deckId, t0);
    const id = q.current!.id;

    sched.answer(id, 3, t0);
    const afterFirst = col.getCard(id)!;
    expect(afterFirst.state).not.toBe(CardState.New);
    expect(afterFirst.due).toBeGreaterThan(t0);
    expect(afterFirst.reps).toBe(1);

    // Отвечаем Good в момент очередного due, пока карточка не станет Review
    let card = afterFirst;
    for (let i = 0; i < 5 && card.state !== CardState.Review; i++) {
      sched.answer(id, 3, card.due);
      card = col.getCard(id)!;
    }
    expect(card.state).toBe(CardState.Review);
    const firstReviewInterval = card.scheduledDays;
    expect(firstReviewInterval).toBeGreaterThanOrEqual(1);

    // Ещё один Good в момент due: интервал растёт
    sched.answer(id, 3, card.due);
    const next = col.getCard(id)!;
    expect(next.scheduledDays).toBeGreaterThan(firstReviewInterval);
  });

  it('Again on a review card increments lapses and re-enters relearning', () => {
    col.addCards(deckId, [input('w')], t0);
    const id = sched.getQueue(deckId, t0).current!.id;
    // Easy сразу обычно отправляет карточку в Review
    sched.answer(id, 4, t0);
    let card = col.getCard(id)!;
    for (let i = 0; i < 5 && card.state !== CardState.Review; i++) {
      sched.answer(id, 3, card.due);
      card = col.getCard(id)!;
    }
    expect(card.state).toBe(CardState.Review);

    sched.answer(id, 1, card.due);
    const lapsed = col.getCard(id)!;
    expect(lapsed.lapses).toBe(card.lapses + 1);
    expect(lapsed.state).not.toBe(CardState.Review);
  });

  it('returns null current when queue is empty', () => {
    const q = sched.getQueue(deckId, t0);
    expect(q.current).toBeNull();
    expect(q.newCount + q.learnCount + q.dueCount).toBe(0);
  });

  it('previewIntervals returns 4 human-readable intervals', () => {
    col.addCards(deckId, [input('w')], t0);
    const id = sched.getQueue(deckId, t0).current!.id;
    const p = sched.previewIntervals(id, t0);
    expect(p.again.length).toBeGreaterThan(0);
    expect(p.hard.length).toBeGreaterThan(0);
    expect(p.good.length).toBeGreaterThan(0);
    expect(p.easy.length).toBeGreaterThan(0);
  });

  it('writes review_log so reviews count toward daily limits', () => {
    col.updateDeckLimits(deckId, 20, 1);
    col.addCards(deckId, [input('a'), input('b')], t0 - 60 * DAY);
    // Превращаем обе в review-карточки с due в прошлом
    for (const w of col.searchCards({ deckId, limit: 10, offset: 0 }).cards) {
      sched.answer(w.id, 4, t0 - 60 * DAY); // Easy → Review
    }
    // Сдвигаем время к due
    const cards = col.searchCards({ deckId, limit: 10, offset: 0 }).cards;
    const later = Math.max(...cards.map((c) => c.due)) + DAY;

    let q = sched.getQueue(deckId, later);
    expect(q.dueCount).toBe(1); // лимит 1 повторение в день
    q = sched.answer(q.current!.id, 3, later);
    expect(q.dueCount).toBe(0);
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours, days, months', () => {
    expect(formatInterval(5 * 60 * 1000)).toBe('5 мин');
    expect(formatInterval(3 * 60 * 60 * 1000)).toBe('3 ч');
    expect(formatInterval(4 * DAY)).toBe('4 дн');
    expect(formatInterval(60 * DAY)).toMatch(/мес/);
    expect(formatInterval(800 * DAY)).toMatch(/г/);
  });
});
