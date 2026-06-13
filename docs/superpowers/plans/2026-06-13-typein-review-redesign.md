# Type-in Review с премиум-капсулой — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать экран Review в режим активного припоминания с вводом слова (type-in) и премиум-визуалом: тёмный фон, неоновая капсула с определением и примером, бинарная оценка верно/неверно.

**Architecture:** Чистые хелперы парсинга/проверки выносятся в отдельный модуль `htmlText.ts` (юнит-тестируются vitest без DOM). `Review.tsx` переписывается на поток вопрос → ввод → результат → раскрытие, маппит верно/неверно в FSRS Good/Again через существующий `review.answer`. `Review.css` переписывается под тёмную неоновую тему; премиум-шрифт Sora подключается через `@fontsource` + webpack asset-rule.

**Tech Stack:** React 18, TypeScript, vitest, webpack 5 (asset modules), @fontsource/sora.

**Спека:** `docs/superpowers/specs/2026-06-13-typein-review-redesign-design.md`

---

## Контекст кодовой базы (прочитать перед началом)

- `src/renderer/components/Review/Review.tsx` — текущий Review: показывает `card.word`, по «Показать ответ» раскрывает определение/примеры и 4 кнопки рейтинга (Снова/Трудно/Хорошо/Легко). Содержит хелпер `audioMimeFromFilename` (сохранить как есть) и in-flight guards.
- `src/renderer/components/Review/Review.css` — текущие светлые стили (будут заменены).
- IPC (готовы, не меняются): `window.electronAPI.review.getQueue(deckId)` → `ReviewQueueState {current, newCount, learnCount, dueCount}`; `window.electronAPI.review.answer(cardId, rating)` → новый `ReviewQueueState`; `window.electronAPI.media.getAudio(filename)` → base64 | null.
- `StoredCard` (в `src/shared/types`): поля `word`, `wordType`, `definition` (генерация кладёт в него `______` вместо слова), `definitionExample` (одно предложение, слово обёрнуто в `<b>…</b>`), `examples: string[]` (слово в `<b>…</b>`), `transcription`, `audioFilename`.
- `ReviewRating` = `1 | 2 | 3 | 4` (Again|Hard|Good|Easy). Используем только 3 (верно) и 1 (неверно).
- Тесты: vitest, окружение node по умолчанию (`npm test` = `vitest run`). 31 тест существует. Юнитим только чистые функции (htmlText) — компонент Review проверяется сборкой + ручным прогоном (как остальной UI в проекте).
- Component `Button` (`../common/Button`) — принимает `variant` ('primary'|'secondary'|'danger'|'success'), `size` ('small'|'large'), `onClick`.
- webpack `rendererConfig` обрабатывает `.css` через `style-loader`+`css-loader`, но НЕ обрабатывает шрифты — нужно добавить asset-rule.

---

### Task 1: Хелперы htmlText (TDD)

**Files:**
- Create: `src/renderer/components/Review/htmlText.ts`
- Test: `src/renderer/components/Review/__tests__/htmlText.test.ts`

- [ ] **Step 1: Написать падающий тест `src/renderer/components/Review/__tests__/htmlText.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { stripTags, parseBold, blankOut, hasBold, isCorrect } from '../htmlText';

describe('stripTags', () => {
  it('removes tags, converts <br> to space, collapses whitespace', () => {
    expect(stripTags('line1<br>line2')).toBe('line1 line2');
    expect(stripTags('<b>bold</b> text')).toBe('bold text');
    expect(stripTags('a   b')).toBe('a b');
  });
  it('decodes common entities', () => {
    expect(stripTags('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripTags('a&nbsp;b')).toBe('a b');
  });
});

describe('parseBold', () => {
  it('splits into segments preserving surrounding spaces', () => {
    const segs = parseBold('She travels around the <b>world</b> every year.');
    expect(segs).toEqual([
      { text: 'She travels around the ', bold: false },
      { text: 'world', bold: true },
      { text: ' every year.', bold: false }
    ]);
  });
  it('handles text without bold as a single normal segment', () => {
    expect(parseBold('plain text')).toEqual([{ text: 'plain text', bold: false }]);
  });
  it('handles multiple bold spans', () => {
    const segs = parseBold('<b>a</b> and <b>b</b>');
    expect(segs).toEqual([
      { text: 'a', bold: true },
      { text: ' and ', bold: false },
      { text: 'b', bold: true }
    ]);
  });
});

describe('blankOut', () => {
  it('replaces <b>…</b> with the placeholder and strips other tags', () => {
    expect(blankOut('She saw the <b>world</b> today.')).toBe(
      'She saw the ______ today.'
    );
  });
  it('uses a custom placeholder', () => {
    expect(blankOut('<b>x</b> y', '[ ]')).toBe('[ ] y');
  });
  it('returns plain text unchanged when there is no bold', () => {
    expect(blankOut('no bold here')).toBe('no bold here');
  });
});

describe('hasBold', () => {
  it('detects a bold span', () => {
    expect(hasBold('a <b>b</b> c')).toBe(true);
    expect(hasBold('no bold')).toBe(false);
    expect(hasBold('')).toBe(false);
  });
});

describe('isCorrect', () => {
  it('compares case- and whitespace-insensitively', () => {
    expect(isCorrect('World', 'world')).toBe(true);
    expect(isCorrect('  world ', 'world')).toBe(true);
    expect(isCorrect('word', 'world')).toBe(false);
    expect(isCorrect('', 'world')).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test` — Expected: FAIL — `Cannot find module '../htmlText'`.

- [ ] **Step 3: Создать `src/renderer/components/Review/htmlText.ts`**

```ts
export interface TextSegment {
  text: string;
  bold: boolean;
}

const TAG_RE = /<[^>]+>/g;
const BOLD_SPAN_RE = /<b>([\s\S]*?)<\/b>/gi;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Inline-очистка БЕЗ схлопывания/тримминга — чтобы пробелы между сегментами жили. */
function cleanInline(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(TAG_RE, ''));
}

/** Полная очистка до простого текста: теги прочь, <br>→пробел, схлопнуть пробелы, trim. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(TAG_RE, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Есть ли в строке непустой <b>…</b>. */
export function hasBold(html: string): boolean {
  return /<b>[\s\S]*?<\/b>/i.test(html);
}

/** Разбить строку с <b>…</b> на сегменты {text, bold}, сохраняя соседние пробелы. */
export function parseBold(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(BOLD_SPAN_RE);
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIndex) {
      const before = cleanInline(html.slice(lastIndex, m.index));
      if (before) segments.push({ text: before, bold: false });
    }
    const inner = cleanInline(m[1]);
    if (inner) segments.push({ text: inner, bold: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < html.length) {
    const rest = cleanInline(html.slice(lastIndex));
    if (rest) segments.push({ text: rest, bold: false });
  }
  return segments;
}

/** Заменить <b>…</b> на placeholder, остальные теги убрать. */
export function blankOut(html: string, placeholder = '______'): string {
  return stripTags(html.replace(BOLD_SPAN_RE, placeholder));
}

/** Сравнение ответа со словом: без регистра и крайних пробелов, точное совпадение. */
export function isCorrect(input: string, word: string): boolean {
  return input.trim().toLowerCase() === word.trim().toLowerCase();
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test` — Expected: PASS все тесты htmlText (и прежние 31 не затронуты).

- [ ] **Step 5: Commit**

```powershell
git add src/renderer/components/Review/htmlText.ts src/renderer/components/Review/__tests__/htmlText.test.ts
git commit -m "feat: htmlText helpers for type-in review (parse/blank/check)"
```

---

### Task 2: Подключить премиум-шрифт Sora

**Files:**
- Modify: `package.json` (+ `package-lock.json`)
- Modify: `webpack.config.js`

- [ ] **Step 1: Установить шрифт**

```powershell
npm install @fontsource/sora
```

Проверить: появилась папка `node_modules/@fontsource/sora` с файлами `400.css`, `600.css`, `700.css` и каталогом `files/*.woff2`.

- [ ] **Step 2: Добавить asset-rule для шрифтов в `rendererConfig` webpack**

`@fontsource/*.css` ссылается на `.woff2`/`.woff` файлы — без loader'а сборка упадёт. Добавить правило в `module.rules` ТОЛЬКО у `rendererConfig` (после правила для css):

```diff
       {
         test: /\.css$/,
         use: ['style-loader', 'css-loader']
+      },
+      {
+        test: /\.(woff2?|ttf|eot)$/,
+        type: 'asset/resource',
+        generator: {
+          filename: 'fonts/[name][ext]'
+        }
       }
     ]
   },
```

- [ ] **Step 3: Проверка сборки**

Run: `npm run build` — Expected: успех (woff2 эмитятся в `dist/renderer/fonts/`). Шрифт ещё не импортируется в код — это в Task 3; здесь проверяем только что правило не ломает сборку.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json webpack.config.js
git commit -m "chore: add Sora font and webpack font asset rule"
```

---

### Task 3: Переписать Review.tsx на type-in поток

**Files:**
- Modify (full rewrite): `src/renderer/components/Review/Review.tsx`

- [ ] **Step 1: Полностью заменить `src/renderer/components/Review/Review.tsx`**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ReviewQueueState, StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import { blankOut, hasBold, isCorrect, parseBold, stripTags } from './htmlText';
import '@fontsource/sora/400.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const advancingRef = useRef(false);

  const card: StoredCard | null = queue?.current ?? null;

  const loadQueue = useCallback(async () => {
    const q = await window.electronAPI.review.getQueue(deckId);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!card || answered || !input.trim()) return;
    setCorrect(isCorrect(input, card.word));
    setAnswered(true);
  };

  const next = useCallback(async () => {
    if (!card || !answered || advancingRef.current) return;
    advancingRef.current = true;
    try {
      const q = await window.electronAPI.review.answer(card.id, correct ? 3 : 1);
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
    return <div className="review">Загрузка...</div>;
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
          <p>🎉 Поздравляем! На сегодня в этой колоде всё.</p>
          <Button onClick={onExit}>К колодам</Button>
        </div>
      ) : (
        <>
          <div className={`review-capsule ${capsuleState}`} key={card.id}>
            <div className="capsule-label">Определение</div>
            <p className="capsule-text">{stripTags(card.definition)}</p>
            {exampleFront && (
              <>
                <div className="capsule-label">Пример</div>
                <p className="capsule-text">{exampleFront}</p>
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
                placeholder="впиши слово…"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="review-hint">Enter — проверить</div>
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
                  {correct ? '✓ Верно' : '✗ Неверно'}
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
                    ▶ Аудио
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

              <Button size="large" onClick={next}>
                Дальше (Enter)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Review;
```

- [ ] **Step 2: Проверка сборки**

Run: `npm run build` — Expected: успех, 0 ошибок TS.
Run: `npm test` — Expected: прежние тесты (31 + htmlText) проходят (компонент не юнит-тестируется).

- [ ] **Step 3: Commit**

```powershell
git add src/renderer/components/Review/Review.tsx
git commit -m "feat: type-in review flow with binary correct/wrong rating"
```

---

### Task 4: Премиум-редизайн Review.css

**Files:**
- Modify (full rewrite): `src/renderer/components/Review/Review.css`

- [ ] **Step 1: Полностью заменить `src/renderer/components/Review/Review.css`**

```css
.review {
  --bg-0: #0b1220;
  --bg-1: #111a2e;
  --neon: #38bdf8;
  --neon-soft: rgba(56, 189, 248, 0.55);
  --ok: #22d3a6;
  --ok-soft: rgba(34, 211, 166, 0.6);
  --bad: #fb5a73;
  --bad-soft: rgba(251, 90, 115, 0.6);
  --text: #e8eefc;
  --text-dim: #8aa0c4;

  font-family: 'Sora', system-ui, sans-serif;
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 80vh;
  padding: 28px 20px 48px;
  border-radius: 16px;
  background:
    radial-gradient(120% 80% at 50% 0%, var(--bg-1) 0%, var(--bg-0) 70%),
    var(--bg-0);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 720px;
  margin-bottom: 36px;
}

.review-counts {
  display: flex;
  gap: 14px;
  font-weight: 600;
}
.review-counts .count-new { color: #60a5fa; }
.review-counts .count-learn { color: #fbbf24; }
.review-counts .count-due { color: var(--ok); }

/* ===== Капсула ===== */
.review-capsule {
  position: relative;
  width: 100%;
  max-width: 680px;
  padding: 34px 40px;
  border-radius: 999px / 64px;
  background:
    radial-gradient(120% 140% at 50% 50%, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.35) 100%),
    var(--bg-1);
  border: 1px solid var(--neon-soft);
  box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.15),
    0 0 22px var(--neon-soft),
    0 0 60px rgba(56, 189, 248, 0.18),
    inset 0 0 36px rgba(0, 0, 0, 0.55);
  text-align: center;
  animation: capsule-in 0.45s ease both, neon-pulse 3.2s ease-in-out infinite;
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
}

.review-capsule.is-correct {
  border-color: var(--ok-soft);
  box-shadow:
    0 0 0 1px rgba(34, 211, 166, 0.2),
    0 0 26px var(--ok-soft),
    0 0 70px rgba(34, 211, 166, 0.2),
    inset 0 0 36px rgba(0, 0, 0, 0.55);
  animation: capsule-in 0.3s ease both;
}
.review-capsule.is-wrong {
  border-color: var(--bad-soft);
  box-shadow:
    0 0 0 1px rgba(251, 90, 115, 0.2),
    0 0 26px var(--bad-soft),
    0 0 70px rgba(251, 90, 115, 0.2),
    inset 0 0 36px rgba(0, 0, 0, 0.55);
  animation: capsule-in 0.3s ease both;
}

.capsule-label {
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--neon);
  opacity: 0.75;
  margin: 14px 0 4px;
}
.capsule-label:first-child { margin-top: 0; }

.capsule-text {
  font-size: 1.15rem;
  line-height: 1.5;
  margin: 0;
  color: var(--text);
}

/* ===== Ввод ===== */
.review-input-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 30px;
  width: 100%;
  max-width: 420px;
}

.review-input {
  width: 100%;
  text-align: center;
  font-family: inherit;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text);
  background: rgba(255, 255, 255, 0.03);
  border: none;
  border-bottom: 2px solid var(--neon-soft);
  border-radius: 10px 10px 0 0;
  padding: 12px 14px;
  outline: none;
  box-shadow: 0 6px 24px -12px var(--neon-soft);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.review-input::placeholder { color: var(--text-dim); font-weight: 400; }
.review-input:focus {
  border-bottom-color: var(--neon);
  box-shadow: 0 8px 30px -10px var(--neon);
}

.review-hint {
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--text-dim);
}

/* ===== Результат ===== */
.review-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 680px;
  animation: capsule-in 0.4s ease both;
}

.review-answer {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  margin-top: 30px;
  width: auto;
  min-width: 260px;
  border-bottom-width: 2px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}
.review-answer.is-correct {
  border-bottom-color: var(--ok);
  box-shadow: 0 8px 30px -10px var(--ok-soft);
  color: var(--ok);
}
.review-answer.is-wrong {
  border-bottom-color: var(--bad);
  box-shadow: 0 8px 30px -10px var(--bad-soft);
  color: var(--bad);
  animation: shake 0.4s ease both;
}
.answer-badge { font-size: 0.85rem; font-weight: 600; }

.review-reveal {
  margin-top: 28px;
  text-align: center;
  animation: reveal-in 0.45s ease both;
}
.reveal-word {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.reveal-type { color: var(--text-dim); font-style: italic; margin-top: 2px; }
.reveal-transcription { color: var(--neon); margin: 6px 0 14px; }

.reveal-examples {
  list-style: none;
  padding: 0;
  margin: 18px auto 24px;
  max-width: 560px;
  text-align: left;
}
.reveal-examples li {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text);
}
.reveal-examples strong { color: var(--neon); font-weight: 700; }

.review-done {
  text-align: center;
  margin-top: 72px;
  font-size: 1.2rem;
  color: var(--text);
}

/* ===== Анимации ===== */
@keyframes capsule-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes reveal-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes neon-pulse {
  0%, 100% { box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.15),
    0 0 22px var(--neon-soft),
    0 0 60px rgba(56, 189, 248, 0.18),
    inset 0 0 36px rgba(0, 0, 0, 0.55); }
  50% { box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.22),
    0 0 30px var(--neon-soft),
    0 0 78px rgba(56, 189, 248, 0.28),
    inset 0 0 36px rgba(0, 0, 0, 0.55); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

@media (prefers-reduced-motion: reduce) {
  .review-capsule,
  .review-result,
  .review-reveal,
  .review-answer.is-wrong {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Проверка сборки**

Run: `npm run build` — Expected: успех.

- [ ] **Step 3: Commit**

```powershell
git add src/renderer/components/Review/Review.css
git commit -m "feat: premium dark neon redesign for review screen"
```

---

### Task 5: Финальная верификация

- [ ] **Step 1: Автоматические проверки**

```powershell
npm test
npm run build
```

Expected: все тесты PASS (31 + htmlText), сборка без ошибок TS.

- [ ] **Step 2: Ручной сквозной сценарий (`npm run dev` или `npm run build` + `npm start`)**

1. Decks → у колоды с карточками нажать «Учить».
2. Капсула на тёмном фоне с голубым неоном; видны метки «ОПРЕДЕЛЕНИЕ» и «ПРИМЕР»; в тексте `______` вместо слова (НЕ сырые `<b>`); поле ввода в фокусе.
3. Ввести ВЕРНОЕ слово → Enter: капсула/ответ зелёные, раскрылись слово, транскрипция, аудио (играет), примеры со словом жирным голубым. Enter → следующая карточка.
4. Ввести НЕВЕРНОЕ слово → Enter: красный неон + shake, всё равно раскрывается правильное слово и примеры. Enter → следующая.
5. Дойти до конца очереди → «🎉 … всё». Выйти, зайти снова в «Учить» — счётчики корректны (FSRS: верно=Good, неверно=Again сработали).
6. (Опц.) Включить системную «уменьшенную анимацию» — пульс/шейк отключаются, функциональность цела.

- [ ] **Step 3: Итоговое сообщение**

Перечислить проверенное: тесты ✓, сборка ✓, type-in верно/неверно ✓, неон/анимации ✓, нет сырых `<b>` ✓, аудио на раскрытии ✓.

---

## Самопроверка плана (выполнена)

- **Покрытие спеки:** бинарный type-in + FSRS Good/Again (Task 3), лицевая сторона определение+пример с пропуском (Task 3 + `blankOut`/`hasBold` из Task 1), раскрытие со словом/транскрипцией/аудио/примерами (Task 3), `<b>`→жирный на бэке и →пропуск на фронте (Task 1 `parseBold`/`blankOut`, Task 3 `BoldText`), проверка ответа без регистра/пробелов (Task 1 `isCorrect`), метки ОПРЕДЕЛЕНИЕ/ПРИМЕР (Task 3 разметка + Task 4 `.capsule-label`), тёмная неоновая капсула + виньетка + анимации + `prefers-reduced-motion` (Task 4), премиум-шрифт Sora (Task 2 + импорт в Task 3), только Review (другие экраны не трогаются).
- **Типы согласованы:** `TextSegment {text, bold}` определён в Task 1 и используется в `BoldText` (Task 3); `isCorrect/blankOut/hasBold/parseBold/stripTags` — сигнатуры совпадают между Task 1 и Task 3; `review.answer(cardId, 3|1)` соответствует существующему `ReviewRating`.
- **Без плейсхолдеров:** весь код приведён целиком (htmlText, Review.tsx, Review.css), команды и ожидаемые результаты указаны.
- **Заложенные риски:** шрифт требует webpack asset-rule (Task 2 до импорта в Task 3); фон Review тёмный через `.review` (перекрывает светлую тему вкладки, остальные экраны не затронуты); определение на бэке остаётся с `______` (слово показывается отдельно крупно — by design).
```
