import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionService, dayEnd } from '../collection.service';
import { SchedulerService, formatInterval } from '../scheduler.service';
import { CardState, NewCardInput, ReviewRating } from '../../../shared/types';

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

  it('two mistakes graduate a new card for tomorrow without a client override', () => {
    col.addCards(deckId, [input('w')], t0);
    const id = sched.getQueue(deckId, t0).current!.id;

    // Первый промах: New → Learning, всё ещё крутится в learning-цикле
    sched.answer(id, 1, t0);
    expect(col.getCard(id)!.state).not.toBe(CardState.Review);

    sched.answer(id, 1, t0);
    const card = col.getCard(id)!;
    expect(card.state).toBe(CardState.Review);
    expect(card.scheduledDays).toBe(1);
    expect(card.due).toBeGreaterThan(t0);
    // Не всплывает сегодня: due — уже следующий день
    expect(sched.getQueue(deckId, t0).current).toBeNull();
  });

  it.each<[ReviewRating, ReviewRating]>([[3, 3], [1, 3], [3, 1], [1, 1]])(
    'limits initial learning to two daily answers (%i, %i), including across restarts',
    async (first, second) => {
      const [id] = col.addCards(deckId, [input('word')], t0);
      sched.answer(id, first, t0);
      expect(col.getCard(id)!.state).toBe(CardState.Learning);
      expect(sched.getQueue(deckId, t0).current!.id).toBe(id);

      const saved = col.export();
      col.close();
      col = new CollectionService();
      await col.init(saved);
      sched = new SchedulerService(col);
      const secondAt = t0 + 10 * 60000;
      const q = sched.answer(id, second, secondAt);
      const card = col.getCard(id)!;
      expect(card.reps).toBe(2);
      expect(card.state).toBe(CardState.Review);
      expect(card.learningSteps).toBe(0);
      expect(q).toEqual({ current: null, newCount: 0, learnCount: 0, dueCount: 0 });
      expect(col.listDecks(secondAt)[0]).toMatchObject({ newCount: 0, learnCount: 0, dueCount: 0 });
      if (first === 1 || second === 1) {
        expect(card.due).toBe(dayEnd(t0));
        expect(card.scheduledDays).toBe(1);
        expect(sched.getQueue(deckId, dayEnd(t0)).current!.id).toBe(id);
      } else {
        // FSRS keeps a whole-day interval from the actual second answer time.
        expect(card.scheduledDays).toBeGreaterThanOrEqual(1);
        expect(card.due).toBe(secondAt + card.scheduledDays * DAY);
      }

      // Reopening and a stale third submission cannot reset the daily count.
      sched = new SchedulerService(col);
      sched.answer(id, 1, secondAt + 1000);
      expect(col.getCard(id)).toEqual(card);
      expect(col.learningAnswersToday(id, secondAt).count).toBe(2);
    }
  );

  it('resets learning history at midnight and excludes mistakes from yesterday', () => {
    const [id] = col.addCards(deckId, [input('night')], t0);
    const beforeMidnight = dayEnd(t0) - 30000;
    sched.answer(id, 1, beforeMidnight);
    const tomorrow = dayEnd(t0);
    expect(col.learningAnswersToday(id, tomorrow)).toEqual({ count: 0, hadMistake: false });
    sched.answer(id, 3, tomorrow + 60000);
    expect(col.getCard(id)!.state).toBe(CardState.Learning);
    const secondAt = tomorrow + 11 * 60000;
    sched.answer(id, 3, secondAt);
    const card = col.getCard(id)!;
    expect(card.state).toBe(CardState.Review);
    expect(card.due).toBe(secondAt + card.scheduledDays * DAY);
    expect(col.learningAnswersToday(id, beforeMidnight)).toEqual({ count: 1, hadMistake: true });
  });

  it('previews the tomorrow override after an initial mistake', () => {
    const [id] = col.addCards(deckId, [input('word')], t0);
    sched.answer(id, 1, t0);
    const expected = formatInterval(dayEnd(t0) - t0);
    expect(sched.previewIntervals(id, t0)).toEqual({
      again: expected, hard: expected, good: expected, easy: expected
    });
  });

  it('keeps learning counts separate for different cards and across deck moves', () => {
    const [a, b] = col.addCards(deckId, [input('a'), input('b')], t0);
    sched.answer(a, 1, t0);
    sched.answer(b, 3, t0);
    const otherDeck = col.createDeck('Other').id;
    col.moveCards([a], otherDeck);
    sched.answer(a, 3, t0 + 1000);
    expect(col.getCard(a)!.due).toBe(dayEnd(t0));
    expect(col.getCard(b)!.state).toBe(CardState.Learning);
    expect(col.learningAnswersToday(b, t0)).toEqual({ count: 1, hadMistake: false });
  });

  it('keeps the existing forceReview escape for mature cards', () => {
    const [id] = col.addCards(deckId, [input('old')], t0);
    sched.answer(id, 4, t0);
    const due = col.getCard(id)!.due;
    sched.answer(id, 1, due);
    sched.answer(id, 1, due + 60000, true);
    expect(col.getCard(id)!.state).toBe(CardState.Review);
    expect(col.getCard(id)!.due).toBe(dayEnd(due));
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
