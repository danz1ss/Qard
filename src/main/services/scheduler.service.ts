import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade
} from 'ts-fsrs';
import {
  CollectionService,
  dayEnd,
  dayStart
} from './collection.service';
import {
  CardState,
  IntervalPreviews,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../../shared/types';

export function formatInterval(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) {
    return '<1 мин';
  }
  if (min < 60) {
    return `${min} мин`;
  }
  const hours = Math.round(min / 60);
  if (hours < 24) {
    return `${hours} ч`;
  }
  const days = Math.round(ms / 86400000);
  if (days < 30) {
    return `${days} дн`;
  }
  const months = ms / (86400000 * 30.44);
  if (months < 12) {
    return `${months.toFixed(1)} мес`;
  }
  return `${(ms / (86400000 * 365.25)).toFixed(1)} г`;
}

export class SchedulerService {
  private f = fsrs(generatorParameters({ enable_fuzz: true }));

  constructor(private col: CollectionService) {}

  private toFsrs(c: StoredCard): FsrsCard {
    return {
      due: new Date(c.due),
      stability: c.stability,
      difficulty: c.difficulty,
      elapsed_days: c.elapsedDays,
      scheduled_days: c.scheduledDays,
      learning_steps: c.learningSteps,
      reps: c.reps,
      lapses: c.lapses,
      state: c.state as unknown as State,
      last_review: c.lastReview !== null ? new Date(c.lastReview) : undefined
    };
  }

  getQueue(deckId: number, now: number = Date.now()): ReviewQueueState {
    const deck = this.col.getDeck(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    const ds = dayStart(now);
    const de = dayEnd(now);

    const newRemaining = Math.max(
      0,
      deck.newPerDay - this.col.newTakenToday(deckId, ds)
    );
    const reviewsRemaining = Math.max(
      0,
      deck.reviewsPerDay - this.col.reviewsDoneToday(deckId, ds)
    );

    const learnCount = this.col.countCards(
      deckId,
      [CardState.Learning, CardState.Relearning],
      de
    );
    const newCount = Math.min(
      newRemaining,
      this.col.countCards(deckId, [CardState.New])
    );
    const dueCount = Math.min(
      reviewsRemaining,
      this.col.countCards(deckId, [CardState.Review], de)
    );

    // Порядок: learning (готовые сейчас) → новые → review → learning "вперёд"
    const current =
      this.col.nextCard(
        deckId,
        [CardState.Learning, CardState.Relearning],
        now,
        'due'
      ) ??
      (newCount > 0
        ? this.col.nextCard(deckId, [CardState.New], undefined, 'id')
        : null) ??
      (dueCount > 0
        ? this.col.nextCard(deckId, [CardState.Review], de, 'due')
        : null) ??
      this.col.nextCard(
        deckId,
        [CardState.Learning, CardState.Relearning],
        de,
        'due'
      );

    return { current, newCount, learnCount, dueCount };
  }

  answer(
    cardId: number,
    rating: ReviewRating,
    now: number = Date.now(),
    forceReview: boolean = false
  ): ReviewQueueState {
    const row = this.col.getCard(cardId);
    if (!row) {
      throw new Error(`Card ${cardId} not found`);
    }
    const item = this.f.next(this.toFsrs(row), new Date(now), rating as Grade);

    let state = item.card.state as unknown as CardState;
    let due = item.card.due.getTime();
    let scheduledDays = item.card.scheduled_days;
    let learningSteps = item.card.learning_steps;

    // Принудительный выпуск из learning-цикла: если карточку проваливали слишком
    // много раз за сессию, не крутим её по минутным шагам, а отправляем в Review
    // на завтра (встретится как Due). См. п.3 фидбека.
    if (forceReview && state !== CardState.Review) {
      const DAY = 86400000;
      state = CardState.Review;
      due = dayStart(now) + DAY;
      scheduledDays = 1;
      learningSteps = 0;
    }

    this.col.applyAnswer(
      {
        id: cardId,
        state,
        due,
        stability: item.card.stability,
        difficulty: item.card.difficulty,
        elapsedDays: item.card.elapsed_days,
        scheduledDays,
        learningSteps,
        reps: item.card.reps,
        lapses: item.card.lapses,
        lastReview: now
      },
      {
        cardId,
        rating,
        state: row.state,
        due: row.due,
        stability: row.stability,
        difficulty: row.difficulty,
        elapsedDays: item.log.elapsed_days,
        scheduledDays: item.log.scheduled_days,
        reviewedAt: now
      }
    );

    return this.getQueue(row.deckId, now);
  }

  previewIntervals(cardId: number, now: number = Date.now()): IntervalPreviews {
    const row = this.col.getCard(cardId);
    if (!row) {
      throw new Error(`Card ${cardId} not found`);
    }
    const rec = this.f.repeat(this.toFsrs(row), new Date(now));
    const fmt = (r: Grade) =>
      formatInterval(rec[r].card.due.getTime() - now);
    return {
      again: fmt(Rating.Again),
      hard: fmt(Rating.Hard),
      good: fmt(Rating.Good),
      easy: fmt(Rating.Easy)
    };
  }
}
