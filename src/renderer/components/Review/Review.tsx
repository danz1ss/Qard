import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ReviewQueueState, StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import { CheckIcon, XIcon } from '../common/icons';
import { blankOut, hasBold, isCorrect, parseBold, stripTags } from './htmlText';
import './Review.css';

function audioMimeFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'ogg': return 'audio/ogg';
    case 'oga': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'mp4': return 'audio/mp4';
    case 'webm': return 'audio/webm';
    case 'flac': return 'audio/flac';
    case 'mp3':
    default: return 'audio/mpeg';
  }
}

/** Рендер строки с <b>…</b> как текст + <strong>. */
const BoldText: React.FC<{ html: string }> = ({ html }) => (
  <>
    {parseBold(html).map((seg, i) =>
      seg.bold ? (
        <strong key={i}>{seg.text}</strong>
      ) : (
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      )
    )}
  </>
);

/** Подсвечивает пропуски (___) неоновым акцентом. */
const Blanks: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(_{3,})/g).map((part, i) =>
      /^_{3,}$/.test(part) ? (
        <span key={i} className="blank">
          {part}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )}
  </>
);

interface ReviewProps {
  deckId: number;
  deckName: string;
  onExit: () => void;
}

const Review: React.FC<ReviewProps> = ({ deckId, deckName, onExit }) => {
  const [queue, setQueue] = useState<ReviewQueueState | null>(null);
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const advancingRef = useRef(false);
  // Промахи по карточке за текущую сессию: после MAX_MISSES слово выпускается
  // в Review (Due) на завтра, а не крутится в learning-цикле. См. п.3 фидбека.
  const missesRef = useRef<Map<number, number>>(new Map());
  const MAX_MISSES = 2;

  const card: StoredCard | null = queue?.current ?? null;

  const loadQueue = useCallback(async () => {
    const q = await window.electronAPI.review.getQueue(deckId);
    missesRef.current.clear();
    setQueue(q);
    setInput('');
    setAnswered(false);
    setCorrect(false);
  }, [deckId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Фокус на поле ввода при новой карточке (состояние вопроса)
  useEffect(() => {
    if (card && !answered) {
      inputRef.current?.focus();
    }
  }, [card?.id, answered]);

  // Сброс мнемоники при смене карточки
  useEffect(() => {
    setMnemonic(null);
    setMnemonicError(null);
    setMnemonicLoading(false);
  }, [card?.id]);

  const genMnemonic = useCallback(async () => {
    if (!card || mnemonicLoading) return;
    setMnemonicLoading(true);
    setMnemonicError(null);
    try {
      const text = await window.electronAPI.ai.mnemonic(
        card.word,
        card.definition,
        card.wordType || ''
      );
      setMnemonic(text);
    } catch (err: any) {
      setMnemonicError(err?.message || 'Failed to generate a mnemonic');
    } finally {
      setMnemonicLoading(false);
    }
  }, [card, mnemonicLoading]);

  // Аудио: грузим и автопроигрываем при РАСКРЫТИИ ответа
  useEffect(() => {
    const prev = audioRef.current;
    audioRef.current = null;
    prev?.pause();
    if (!answered || !card?.audioFilename) {
      return;
    }
    let cancelled = false;
    const fn = card.audioFilename;
    window.electronAPI.media.getAudio(fn).then((b64) => {
      if (cancelled || !b64) return;
      const audio = new Audio(`data:${audioMimeFromFilename(fn)};base64,${b64}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [answered, card?.id]);

  const playAudio = () => audioRef.current?.play().catch(() => {});

  const registerMiss = (cardId: number) => {
    missesRef.current.set(cardId, (missesRef.current.get(cardId) ?? 0) + 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!card || answered) return;
    // Пустой ввод + Enter = «не знаю» → засчитываем как неверно и раскрываем ответ
    if (!input.trim()) {
      setCorrect(false);
      registerMiss(card.id);
      setAnswered(true);
      return;
    }
    const ok = isCorrect(input, card.word);
    setCorrect(ok);
    if (!ok) registerMiss(card.id);
    setAnswered(true);
  };

  const next = useCallback(async () => {
    if (!card || !answered || advancingRef.current) return;
    advancingRef.current = true;
    try {
      // Слишком много промахов за сессию → выпускаем карточку в Review (Due),
      // чтобы она не возвращалась снова и снова в этой же сессии.
      const forceReview =
        !correct && (missesRef.current.get(card.id) ?? 0) >= MAX_MISSES;
      const q = await window.electronAPI.review.answer(
        card.id,
        correct ? 3 : 1,
        forceReview
      );
      setQueue(q);
      setInput('');
      setAnswered(false);
      setCorrect(false);
    } finally {
      advancingRef.current = false;
    }
  }, [card, answered, correct]);

  // В состоянии ответа: Enter/Space → следующая карточка
  useEffect(() => {
    if (!answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, next]);

  if (!queue) {
    return <div className="review">Loading...</div>;
  }

  const exampleFront =
    card && hasBold(card.definitionExample) ? blankOut(card.definitionExample) : '';
  const capsuleState = answered ? (correct ? 'is-correct' : 'is-wrong') : '';

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
          <p>🎉 Congrats! You're done with this deck for today.</p>
          <Button onClick={onExit}>To decks</Button>
        </div>
      ) : (
        <>
          <div className={`review-capsule ${capsuleState}`} key={card.id}>
            <div className="capsule-label">Definition</div>
            <p className="capsule-text">
              <Blanks text={stripTags(card.definition)} />
            </p>
            {exampleFront && (
              <>
                <div className="capsule-label">Example</div>
                <p className="capsule-text">
                  <Blanks text={exampleFront} />
                </p>
              </>
            )}
          </div>

          {!answered ? (
            <form className="review-input-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="review-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="type the word…"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="review-hint">Press Enter to check</div>
            </form>
          ) : (
            <div className="review-result">
              <div
                className={`review-input review-answer ${
                  correct ? 'is-correct' : 'is-wrong'
                }`}
              >
                <span className="answer-typed">{input || '—'}</span>
                <span className="answer-badge">
                  {correct ? <CheckIcon size={15} /> : <XIcon size={15} />}
                  {correct ? 'Correct' : 'Wrong'}
                </span>
              </div>

              <div className="review-reveal">
                <div className="reveal-word">{card.word}</div>
                {card.wordType && (
                  <div className="reveal-type">{card.wordType}</div>
                )}
                {card.transcription && (
                  <div className="reveal-transcription">
                    {stripTags(card.transcription)}
                  </div>
                )}
                {card.audioFilename && (
                  <Button size="small" variant="secondary" onClick={playAudio}>
                    ▶ Audio
                  </Button>
                )}
                {(card.definitionExample || card.examples.length > 0) && (
                  <ul className="reveal-examples">
                    {card.definitionExample && (
                      <li>
                        <BoldText html={card.definitionExample} />
                      </li>
                    )}
                    {card.examples.map((ex, i) => (
                      <li key={i}>
                        <BoldText html={ex} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="review-mnemonic">
                {mnemonic ? (
                  <div className="mnemonic-card">
                    <span className="mnemonic-icon">💡</span>
                    <p className="mnemonic-text">{mnemonic}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mnemonic-btn"
                    onClick={genMnemonic}
                    disabled={mnemonicLoading}
                  >
                    {mnemonicLoading ? '💭 Thinking…' : '💡 Mnemonic'}
                  </button>
                )}
                {mnemonicError && (
                  <p className="mnemonic-error">{mnemonicError}</p>
                )}
              </div>

              <Button size="large" onClick={next}>
                Next (Enter)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Review;
