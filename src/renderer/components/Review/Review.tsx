import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IntervalPreviews,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../../../shared/types';
import Button from '../common/Button';
import './Review.css';

interface ReviewProps {
  deckId: number;
  deckName: string;
  onExit: () => void;
}

const Review: React.FC<ReviewProps> = ({ deckId, deckName, onExit }) => {
  const [queue, setQueue] = useState<ReviewQueueState | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreviews | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answeringRef = useRef<boolean>(false);
  const revealingRef = useRef<boolean>(false);

  const card: StoredCard | null = queue?.current ?? null;

  const loadQueue = useCallback(async () => {
    const q = await window.electronAPI.review.getQueue(deckId);
    setQueue(q);
    setShowAnswer(false);
    setIntervals(null);
  }, [deckId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Аудио: подгружаем и автопроигрываем при смене карточки
  useEffect(() => {
    const prevAudio = audioRef.current;
    audioRef.current = null;
    if (!card?.audioFilename) {
      prevAudio?.pause();
      return;
    }
    let cancelled = false;
    window.electronAPI.media.getAudio(card.audioFilename).then((b64) => {
      if (cancelled || !b64) return;
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
      prevAudio?.pause();
    };
  }, [card?.id]);

  const playAudio = () => {
    audioRef.current?.play().catch(() => {});
  };

  const reveal = async () => {
    if (!card || showAnswer || revealingRef.current) return;
    revealingRef.current = true;
    try {
      setShowAnswer(true);
      const p = await window.electronAPI.review.previewIntervals(card.id);
      setIntervals(p);
    } finally {
      revealingRef.current = false;
    }
  };

  const rate = async (rating: ReviewRating) => {
    if (!card || answeringRef.current) return;
    answeringRef.current = true;
    try {
      const q = await window.electronAPI.review.answer(card.id, rating);
      setQueue(q);
      setShowAnswer(false);
      setIntervals(null);
    } finally {
      answeringRef.current = false;
    }
  };

  // Хоткеи: пробел = показать ответ / Good; 1-4 = оценки
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer) {
          reveal();
        } else {
          rate(3);
        }
      } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        rate(parseInt(e.key) as ReviewRating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAnswer, card?.id]);

  if (!queue) {
    return <div className="review">Загрузка...</div>;
  }

  return (
    <div className="review">
      <div className="review-header">
        <Button variant="secondary" size="small" onClick={onExit}>
          ← {deckName}
        </Button>
        <div className="review-counts">
          <span className="count-new">{queue.newCount}</span>
          <span className="count-learn">{queue.learnCount}</span>
          <span className="count-due">{queue.dueCount}</span>
        </div>
      </div>

      {!card ? (
        <div className="review-done">
          <p>🎉 Поздравляем! На сегодня в этой колоде всё.</p>
          <Button onClick={onExit}>К колодам</Button>
        </div>
      ) : (
        <>
          <div className="review-card">
            <div className="review-word">{card.word}</div>
            {card.wordType && (
              <div className="review-word-type">{card.wordType}</div>
            )}
            {card.audioFilename && (
              <Button size="small" variant="secondary" onClick={playAudio}>
                ▶ Аудио
              </Button>
            )}

            {showAnswer && (
              <>
                <hr className="review-divider" />
                <div className="review-back">
                  {card.transcription && (
                    <p><em>{card.transcription}</em></p>
                  )}
                  <p><strong>{card.definition}</strong></p>
                  {card.definitionExample && <p>{card.definitionExample}</p>}
                  {card.examples.length > 0 && (
                    <ul>
                      {card.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="review-actions">
            {!showAnswer ? (
              <Button size="large" onClick={reveal}>
                Показать ответ (пробел)
              </Button>
            ) : (
              <>
                <button className="rating-btn rating-again" onClick={() => rate(1)}>
                  Снова<small>{intervals?.again ?? ''}</small>
                </button>
                <button className="rating-btn rating-hard" onClick={() => rate(2)}>
                  Трудно<small>{intervals?.hard ?? ''}</small>
                </button>
                <button className="rating-btn rating-good" onClick={() => rate(3)}>
                  Хорошо<small>{intervals?.good ?? ''}</small>
                </button>
                <button className="rating-btn rating-easy" onClick={() => rate(4)}>
                  Легко<small>{intervals?.easy ?? ''}</small>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Review;
