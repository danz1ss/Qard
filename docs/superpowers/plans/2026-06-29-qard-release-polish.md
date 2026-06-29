# Qard Release Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отполировать Qard к публичному релизу: i18n RU/EN, светлая тема, звуки ответов, кастомный Select, приглушённое свечение, фиксы UX поля ввода и отступов.

**Architecture:** UI-преференсы (язык/тема/звук) живут в `localStorage` через единый `PreferencesProvider` (React context), обёрнутый вокруг `<App/>` в обеих сборках (Electron + web). i18n — собственные плоские словари + `t()` без библиотек. Звуки — синтез через Web Audio. Тема — атрибут `data-theme` + переопределение CSS-переменных. IPC-хендлеры не трогаем.

**Tech Stack:** React 18 + TypeScript, zustand, vitest, webpack, Electron + web. Шрифт Rubik. Тесты — vitest (`npm test`).

**Verification commands:**
- Юнит-тесты: `npm test` или точечно `npx vitest run <path>`
- TS-сборка проверки: `npm run build`
- Ручной прогон: `npm run dev` (Electron) или `npm run dev:web` (web)

---

## File Structure

**Создаются:**
- `src/renderer/lib/prefs.ts` — типобезопасный helper чтения/записи `localStorage`.
- `src/renderer/lib/prefs.test.ts` — тест helper'а.
- `src/renderer/i18n/types.ts` — тип словаря `Dict` и `Lang`.
- `src/renderer/i18n/en.ts`, `src/renderer/i18n/ru.ts` — словари.
- `src/renderer/i18n/t.test.ts` — тест функции перевода.
- `src/renderer/prefs/PreferencesProvider.tsx` — контекст {lang, theme, soundEnabled, t} + сеттеры + применение `data-theme`.
- `src/renderer/components/common/HeaderControls.tsx` + `.css` — тумблеры темы/языка/звука.
- `src/renderer/audio/sfx.ts` — Web Audio синтез.
- `src/renderer/audio/sfx.test.ts` — тест чистой функции огибающей/нот.
- `src/renderer/lib/latin.ts` — нормализация ввода (только латиница + пробел/дефис/апостроф).
- `src/renderer/lib/latin.test.ts` — тест нормализации.

**Модифицируются:**
- `src/renderer/index.tsx`, `src/web/index.tsx` — обернуть `<App/>` в `<PreferencesProvider>`.
- `src/renderer/App.tsx` / `App.css` — HeaderControls в правую колонку шапки; светлая тема (`:root`).
- `src/renderer/components/common/Select.tsx` / `Select.css` — кастомный дропдаун.
- `Browser.tsx`, `Preview.tsx`, `Settings.tsx` — обновить 6 вызовов `<Select>` под новый `onChange(value)`.
- `src/renderer/components/Generation/Generation.css` — отступ `.settings-summary`.
- `src/renderer/components/Review/Review.tsx` / `Review.css` — звуки, ограничение ввода, приглушённое свечение, светлая тема `.review`.
- i18n-замена строк по компонентам (Task 11).

---

## Task 1: localStorage helper (`prefs.ts`)

**Files:**
- Create: `src/renderer/lib/prefs.ts`
- Test: `src/renderer/lib/prefs.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/renderer/lib/prefs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPref, savePref } from './prefs';

describe('prefs', () => {
  beforeEach(() => localStorage.clear());

  it('returns fallback when key missing', () => {
    expect(loadPref('qard:lang', 'ru')).toBe('ru');
  });

  it('persists and reads back a value', () => {
    savePref('qard:lang', 'en');
    expect(loadPref('qard:lang', 'ru')).toBe('en');
  });

  it('falls back on malformed JSON', () => {
    localStorage.setItem('qard:theme', '{not json');
    expect(loadPref('qard:theme', 'dark')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/renderer/lib/prefs.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement**

```ts
// src/renderer/lib/prefs.ts
// Тонкая типобезопасная обёртка над localStorage для UI-преференсов.
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим / переполнение — тихо игнорируем */
  }
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/renderer/lib/prefs.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/prefs.ts src/renderer/lib/prefs.test.ts
git commit -m "feat(prefs): localStorage helper для UI-преференсов"
```

---

## Task 2: i18n словари + функция `t`

**Files:**
- Create: `src/renderer/i18n/types.ts`, `src/renderer/i18n/en.ts`, `src/renderer/i18n/ru.ts`, `src/renderer/i18n/index.ts`
- Test: `src/renderer/i18n/t.test.ts`

Словари — плоские ключи вида `area.label`. На этом шаге заводим инфраструктуру и СИД-набор ключей для шапки/навигации/Generation/Review (которые точно понадобятся). Остальные ключи добавляются в Task 11.

- [ ] **Step 1: Failing test**

```ts
// src/renderer/i18n/t.test.ts
import { describe, it, expect } from 'vitest';
import { makeT } from './index';
import { en } from './en';
import { ru } from './ru';

describe('i18n t()', () => {
  it('returns ru string', () => {
    expect(makeT('ru')('nav.decks')).toBe('Колоды');
  });
  it('returns en string', () => {
    expect(makeT('en')('nav.decks')).toBe('Decks');
  });
  it('ru and en have identical key sets', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
  it('falls back to key when missing', () => {
    expect(makeT('ru')('does.not.exist' as any)).toBe('does.not.exist');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/renderer/i18n/t.test.ts`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Implement**

```ts
// src/renderer/i18n/types.ts
export type Lang = 'ru' | 'en';
export type Dict = Record<string, string>;
```

```ts
// src/renderer/i18n/en.ts
import { Dict } from './types';
export const en: Dict = {
  'brand.subtitle': 'YDN education',
  'nav.decks': 'Decks',
  'nav.browse': 'Browse',
  'nav.setup': 'Setup',
  'nav.input': 'Input',
  'nav.generate': 'Generate',
  'nav.preview': 'Preview',
  'ctrl.theme': 'Theme',
  'ctrl.sound': 'Sound',
  'gen.title': 'Generate Flashcards',
  'gen.currentSettings': 'Current Settings',
  'review.typePlaceholder': 'type the word…',
  'review.checkHint': 'Press Enter to check',
  'review.englishOnly': 'English only',
};
```

```ts
// src/renderer/i18n/ru.ts
import { Dict } from './types';
export const ru: Dict = {
  'brand.subtitle': 'YDN education',
  'nav.decks': 'Колоды',
  'nav.browse': 'Обзор',
  'nav.setup': 'Настройки',
  'nav.input': 'Ввод',
  'nav.generate': 'Генерация',
  'nav.preview': 'Просмотр',
  'ctrl.theme': 'Тема',
  'ctrl.sound': 'Звук',
  'gen.title': 'Генерация карточек',
  'gen.currentSettings': 'Текущие настройки',
  'review.typePlaceholder': 'введите слово…',
  'review.checkHint': 'Нажмите Enter для проверки',
  'review.englishOnly': 'Только английский',
};
```

```ts
// src/renderer/i18n/index.ts
import { Lang, Dict } from './types';
import { en } from './en';
import { ru } from './ru';

const dicts: Record<Lang, Dict> = { en, ru };

export type TFunc = (key: string) => string;

export function makeT(lang: Lang): TFunc {
  const dict = dicts[lang];
  return (key: string) => dict[key] ?? key;
}

export type { Lang, Dict };
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/renderer/i18n/t.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/i18n
git commit -m "feat(i18n): словари ru/en + функция t (сид-набор ключей)"
```

---

## Task 3: PreferencesProvider (язык/тема/звук)

**Files:**
- Create: `src/renderer/prefs/PreferencesProvider.tsx`
- Modify: `src/renderer/index.tsx`, `src/web/index.tsx`

- [ ] **Step 1: Implement provider**

```tsx
// src/renderer/prefs/PreferencesProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadPref, savePref } from '../lib/prefs';
import { makeT, Lang, TFunc } from '../i18n';

type Theme = 'dark' | 'light';

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  t: TFunc;
}

const Ctx = createContext<Prefs | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => loadPref<Lang>('qard:lang', 'ru'));
  const [theme, setThemeState] = useState<Theme>(() => loadPref<Theme>('qard:theme', 'dark'));
  const [soundEnabled, setSoundState] = useState<boolean>(() => loadPref<boolean>('qard:sound', true));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setLang = (l: Lang) => { setLangState(l); savePref('qard:lang', l); };
  const setTheme = (t: Theme) => { setThemeState(t); savePref('qard:theme', t); };
  const setSoundEnabled = (v: boolean) => { setSoundState(v); savePref('qard:sound', v); };

  const t = useMemo(() => makeT(lang), [lang]);

  const value: Prefs = { lang, setLang, theme, setTheme, soundEnabled, setSoundEnabled, t };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function usePrefs(): Prefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrefs must be used within PreferencesProvider');
  return ctx;
}

// Удобный хук только для перевода
export function useT(): TFunc {
  return usePrefs().t;
}
```

- [ ] **Step 2: Wrap App in renderer entry**

В `src/renderer/index.tsx` заменить блок render:

```tsx
import { PreferencesProvider } from './prefs/PreferencesProvider';
// ...
root.render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Wrap App in web entry**

В `src/web/index.tsx` заменить блок render:

```tsx
import { PreferencesProvider } from '../renderer/prefs/PreferencesProvider';
// ...
root.render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: сборка без TS-ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/prefs/PreferencesProvider.tsx src/renderer/index.tsx src/web/index.tsx
git commit -m "feat(prefs): PreferencesProvider (язык/тема/звук) + монтирование в обеих сборках"
```

---

## Task 4: HeaderControls + размещение в шапке

**Files:**
- Create: `src/renderer/components/common/HeaderControls.tsx`, `src/renderer/components/common/HeaderControls.css`
- Modify: `src/renderer/App.tsx`, `src/renderer/App.css`

- [ ] **Step 1: Component**

```tsx
// src/renderer/components/common/HeaderControls.tsx
import React from 'react';
import { usePrefs } from '../../prefs/PreferencesProvider';
import './HeaderControls.css';

const HeaderControls: React.FC = () => {
  const { lang, setLang, theme, setTheme, soundEnabled, setSoundEnabled, t } = usePrefs();

  return (
    <div className="header-controls">
      <button
        type="button"
        className="hc-btn"
        title={t('ctrl.theme')}
        aria-label={t('ctrl.theme')}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>

      <div className="hc-lang" role="group" aria-label="Language">
        <button
          type="button"
          className={`hc-lang-opt ${lang === 'ru' ? 'is-active' : ''}`}
          onClick={() => setLang('ru')}
        >
          RU
        </button>
        <button
          type="button"
          className={`hc-lang-opt ${lang === 'en' ? 'is-active' : ''}`}
          onClick={() => setLang('en')}
        >
          EN
        </button>
      </div>

      <button
        type="button"
        className="hc-btn"
        title={t('ctrl.sound')}
        aria-label={t('ctrl.sound')}
        aria-pressed={soundEnabled}
        onClick={() => setSoundEnabled(!soundEnabled)}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  );
};

export default HeaderControls;
```

- [ ] **Step 2: CSS**

```css
/* src/renderer/components/common/HeaderControls.css */
.header-controls {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.hc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--space-2);
  border: 1px solid var(--border-soft);
  background: var(--surface);
  color: var(--ivory);
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.hc-btn:hover { background: var(--surface-hi); }
.hc-btn:active { transform: scale(0.95); }
.hc-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.hc-lang {
  display: inline-flex;
  border: 1px solid var(--border-soft);
  border-radius: var(--space-2);
  overflow: hidden;
}
.hc-lang-opt {
  padding: 6px 10px;
  border: none;
  background: var(--surface);
  color: var(--ivory-dim);
  font: 600 12px var(--font);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.hc-lang-opt.is-active { background: var(--accent); color: #fff; }
.hc-lang-opt:not(.is-active):hover { background: var(--surface-hi); color: var(--ivory); }
```

- [ ] **Step 3: Mount in App header**

В `src/renderer/App.tsx`: добавить импорт `import HeaderControls from './components/common/HeaderControls';` и вставить `<HeaderControls />` СРАЗУ после закрывающего `</nav>` (как третий элемент grid-сетки шапки):

```tsx
        </nav>
        <HeaderControls />
      </header>
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev:web`
Expected: в правом углу шапки видны тумблер темы, RU/EN, тумблер звука. Клики переключают состояние; перезагрузка сохраняет выбор (localStorage).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/common/HeaderControls.tsx src/renderer/components/common/HeaderControls.css src/renderer/App.tsx
git commit -m "feat(ui): HeaderControls (тема/язык/звук) в правой колонке шапки"
```

---

## Task 5: Светлая тема (CSS-переменные)

**Files:**
- Modify: `src/renderer/App.css`, `src/renderer/components/Review/Review.css`

- [ ] **Step 1: Светлая палитра глобальных токенов**

В `src/renderer/App.css` после блока `:root { … }` добавить:

```css
/* ---------- Светлая тема: переопределение глобальных токенов ---------- */
:root[data-theme='light'] {
  --bg: #eef1f6;
  --bg-deep: #e6eaf1;
  --bg-elev: #f4f6fa;
  --surface: #ffffff;
  --surface-hi: #f0f3f8;
  --border: #c9d0dd;
  --border-soft: #d7dde7;

  --ivory: #1f2530;
  --ivory-dim: #51607a;
  --muted: #6b7689;

  --accent: #3f6fd6;
  --accent-hi: #5e88e6;
  --accent-press: #335cb4;
  --accent-soft: rgba(63, 111, 214, 0.12);

  --key-shadow: #c2cad8;
}
```

- [ ] **Step 2: Светлая палитра токенов Review**

В `src/renderer/components/Review/Review.css` после блока `.review { … }` (где объявлены `--bg-0`, `--neon` и т.д.) добавить переопределение:

```css
/* Светлая тема для зоны Review (приглушённый акцент вместо неона) */
:root[data-theme='light'] .review {
  --bg-0: #eef1f6;
  --bg-1: #f7f9fc;
  --neon: #3f6fd6;
  --neon-soft: rgba(63, 111, 214, 0.28);
  --ok: #1aa57f;
  --ok-soft: rgba(26, 165, 127, 0.30);
  --bad: #d24a60;
  --bad-soft: rgba(210, 74, 96, 0.30);
  --text: #1f2530;
  --text-dim: #51607a;
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev:web`
Expected: тумблер темы перекрашивает и оболочку, и экран Review; светлая тема читаема, контраст текста достаточный.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.css src/renderer/components/Review/Review.css
git commit -m "feat(theme): светлая тема через data-theme для оболочки и Review"
```

---

## Task 6: Приглушить свечение карточки

**Files:**
- Modify: `src/renderer/components/Review/Review.css`

- [ ] **Step 1: Ослабить покой + убрать пульсацию**

В `.review-capsule` (строки ~50-64) заменить `box-shadow` и `animation`:

```css
  box-shadow:
    0 0 0 1px rgba(56, 189, 248, 0.10),
    0 0 16px rgba(56, 189, 248, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 0 50px rgba(0, 0, 0, 0.5);
  text-align: center;
  animation: capsule-in 0.45s ease both;
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
```

(Убран бесконечный `neon-pulse` и внешний `90px` слой; `--neon-soft`-слой сокращён.)

- [ ] **Step 2: Смягчить обратную связь correct/wrong**

В `.review-capsule.is-correct` и `.is-wrong` заменить внешние слои свечения на более мягкие:

```css
.review-capsule.is-correct {
  border-color: var(--ok-soft);
  box-shadow:
    0 0 0 1px rgba(34, 211, 166, 0.16),
    0 0 22px rgba(34, 211, 166, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 0 50px rgba(0, 0, 0, 0.5);
  animation: capsule-in 0.3s ease both;
}
.review-capsule.is-wrong {
  border-color: var(--bad-soft);
  box-shadow:
    0 0 0 1px rgba(251, 90, 115, 0.16),
    0 0 22px rgba(251, 90, 115, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 0 50px rgba(0, 0, 0, 0.5);
  animation: capsule-in 0.3s ease both;
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev:web` → зайти в Review колоды.
Expected: рамка в покое НЕ пульсирует, свечение мягче; вспышка correct/wrong видна, но не агрессивна.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Review/Review.css
git commit -m "fix(review): приглушить свечение карточки, убрать бесконечную пульсацию"
```

---

## Task 7: Звуки ответов (Web Audio)

**Files:**
- Create: `src/renderer/audio/sfx.ts`, `src/renderer/audio/sfx.test.ts`
- Modify: `src/renderer/components/Review/Review.tsx`

- [ ] **Step 1: Failing test (чистая функция спецификации нот)**

```ts
// src/renderer/audio/sfx.test.ts
import { describe, it, expect } from 'vitest';
import { toneSpec } from './sfx';

describe('toneSpec', () => {
  it('correct = две восходящие ноты', () => {
    const s = toneSpec('correct');
    expect(s.length).toBe(2);
    expect(s[1].freq).toBeGreaterThan(s[0].freq);
  });
  it('wrong = одна низкая нота', () => {
    const s = toneSpec('wrong');
    expect(s.length).toBe(1);
    expect(s[0].freq).toBeLessThan(300);
  });
  it('громкость тихая (<= 0.2)', () => {
    for (const n of [...toneSpec('correct'), ...toneSpec('wrong')]) {
      expect(n.gain).toBeLessThanOrEqual(0.2);
    }
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/renderer/audio/sfx.test.ts`
Expected: FAIL — `toneSpec` не найден.

- [ ] **Step 3: Implement**

```ts
// src/renderer/audio/sfx.ts
// Лёгкий синтез звуков ответа через Web Audio. Без файлов.
export interface Note { freq: number; start: number; dur: number; gain: number; }

export function toneSpec(kind: 'correct' | 'wrong'): Note[] {
  if (kind === 'correct') {
    return [
      { freq: 660, start: 0, dur: 0.12, gain: 0.15 },
      { freq: 880, start: 0.1, dur: 0.16, gain: 0.15 },
    ];
  }
  return [{ freq: 180, start: 0, dur: 0.22, gain: 0.14 }];
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function playNote(ac: AudioContext, n: Note) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + n.start;
  osc.type = 'sine';
  osc.frequency.value = n.freq;
  // быстрый attack, плавный release
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(n.gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + n.dur + 0.02);
}

export function playSfx(kind: 'correct' | 'wrong'): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  for (const n of toneSpec(kind)) playNote(ac, n);
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/renderer/audio/sfx.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Wire into Review.submit**

В `src/renderer/components/Review/Review.tsx`:

1. Добавить импорты вверху:
```tsx
import { playSfx } from '../../audio/sfx';
import { usePrefs } from '../../prefs/PreferencesProvider';
```

2. Внутри компонента, рядом с другими хуками:
```tsx
  const { soundEnabled } = usePrefs();
```

3. В функции `submit` после установки результата проигрывать звук. Заменить тело ветки про пустой ввод и финальную проверку:
```tsx
    if (!input.trim()) {
      setCorrect(false);
      registerMiss(card.id);
      setAnswered(true);
      if (soundEnabled) playSfx('wrong');
      return;
    }
    const ok = isCorrect(input, card.word);
    setCorrect(ok);
    if (!ok) registerMiss(card.id);
    setAnswered(true);
    if (soundEnabled) playSfx(ok ? 'correct' : 'wrong');
```

- [ ] **Step 6: Verify manually**

Run: `npm run dev:web` → Review. Ответить верно → звук вверх; неверно → низкий звук. Выключить звук тумблером → тишина.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/audio/sfx.ts src/renderer/audio/sfx.test.ts src/renderer/components/Review/Review.tsx
git commit -m "feat(review): звуки правильного/неправильного ответа (Web Audio) + учёт mute"
```

---

## Task 8: Кастомный анимированный Select

**Files:**
- Modify: `src/renderer/components/common/Select.tsx`, `src/renderer/components/common/Select.css`
- Modify: `Browser.tsx`, `Preview.tsx`, `Settings.tsx` (6 вызовов)

- [ ] **Step 1: Переписать Select на кастомный дропдаун**

```tsx
// src/renderer/components/common/Select.tsx
import React, { useEffect, useRef, useState } from 'react';
import './Select.css';

interface Option { value: string; label: string; }
interface SelectProps {
  label?: string;
  error?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  label, error, options, value, onChange, className = '', disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  const choose = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  };

  return (
    <div className={`select-wrapper ${className}`} ref={rootRef}>
      {label && <label className="select-label">{label}</label>}
      <div className={`cselect ${error ? 'cselect-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <button
          type="button"
          className="cselect-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
        >
          <span className="cselect-value">{selected ? selected.label : ''}</span>
          <span className={`cselect-caret ${open ? 'is-open' : ''}`}>▾</span>
        </button>
        <ul className={`cselect-list ${open ? 'is-open' : ''}`} role="listbox" tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`cselect-option ${i === active ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      </div>
      {error && <span className="select-error-text">{error}</span>}
    </div>
  );
};

export default Select;
```

- [ ] **Step 2: CSS с плавной анимацией**

```css
/* src/renderer/components/common/Select.css */
.select-wrapper { display: flex; flex-direction: column; gap: 6px; }
.select-label { font-size: 13px; font-weight: 600; color: var(--ivory-dim); }

.cselect { position: relative; }
.cselect-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--space-2);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ivory);
  font: 500 14px var(--font);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.cselect-trigger:hover { background: var(--surface-hi); }
.cselect-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cselect.is-disabled .cselect-trigger { opacity: 0.5; cursor: not-allowed; }
.cselect-error .cselect-trigger { border-color: var(--coral); }

.cselect-caret { transition: transform 0.18s ease; color: var(--ivory-dim); }
.cselect-caret.is-open { transform: rotate(180deg); }

.cselect-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 30;
  margin: 0;
  padding: 6px;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
  border-radius: var(--space-2);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.45);
  /* состояние закрыто */
  opacity: 0;
  transform: translateY(-6px) scaleY(0.98);
  transform-origin: top center;
  pointer-events: none;
  transition: opacity 0.16s ease-out, transform 0.16s ease-out;
}
.cselect-list.is-open {
  opacity: 1;
  transform: translateY(0) scaleY(1);
  pointer-events: auto;
}
.cselect-option {
  padding: 9px 11px;
  border-radius: 8px;
  color: var(--ivory);
  font: 500 14px var(--font);
  cursor: pointer;
}
.cselect-option.is-active { background: var(--surface-hi); }
.cselect-option.is-selected { color: var(--accent-hi); font-weight: 600; }
.select-error-text { font-size: 12px; color: var(--coral); }
```

- [ ] **Step 3: Обновить 6 вызовов (onChange(value) вместо e.target.value)**

`src/renderer/components/Browser/Browser.tsx`:
```tsx
          onChange={(v) => setDeckId(v)}
```
```tsx
          onChange={(v) => setStatus(v)}
```
```tsx
            onChange={(v) => setMoveTarget(v)}
```

`src/renderer/components/Preview/Preview.tsx`:
```tsx
              onChange={(v) => handleDeckChange(v)}
```

`src/renderer/components/Settings/Settings.tsx`:
```tsx
          onChange={(v) => handleProviderChange(v)}
```
```tsx
            onChange={(v) => setAiModel(v)}
```
```tsx
          onChange={(v) => setExampleCount(parseInt(v))}
```
```tsx
          onChange={(v) => setDailyGoal(parseInt(v))}
```

(Примечание: в Settings 4 вызова Select — provider, model, exampleCount, dailyGoal. Обновить все четыре.)

- [ ] **Step 4: Verify build + manual**

Run: `npm run build` → без TS-ошибок.
Run: `npm run dev:web` → во вкладках Browse/Preview/Setup дропдауны открываются плавно, управляются клавиатурой (Tab→Enter/стрелки/Esc), выбор работает.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/common/Select.tsx src/renderer/components/common/Select.css src/renderer/components/Browser/Browser.tsx src/renderer/components/Preview/Preview.tsx src/renderer/components/Settings/Settings.tsx
git commit -m "feat(ui): кастомный анимированный Select + обновление вызовов"
```

---

## Task 9: Отступ над «Current Settings»

**Files:**
- Modify: `src/renderer/components/Generation/Generation.css`

- [ ] **Step 1: Найти и уменьшить отступ**

Открыть `Generation.css`, найти правило `.settings-summary`. Уменьшить верхний отступ (если задан `margin-top`/`margin`) до `var(--space-3)` (12px). Если отступ создаётся нижним `margin` у `.generation .description` — уменьшить и его. Конкретно — установить:

```css
.settings-summary {
  margin-top: var(--space-3);
}
```

(Если в файле уже есть `.settings-summary { margin: … }` — отредактировать именно верхнее значение, не плодя дубль-правило.)

- [ ] **Step 2: Verify manually**

Run: `npm run dev:web` → вкладка Generate.
Expected: блок «Current Settings» ближе к описанию, лишнего воздуха нет.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Generation/Generation.css
git commit -m "fix(ui): уменьшить отступ над Current Settings в Generate"
```

---

## Task 10: Ограничение поля ввода (латиница + лимит длины)

**Files:**
- Create: `src/renderer/lib/latin.ts`, `src/renderer/lib/latin.test.ts`
- Modify: `src/renderer/components/Review/Review.tsx`

- [ ] **Step 1: Failing test нормализации**

```ts
// src/renderer/lib/latin.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeLatin } from './latin';

describe('sanitizeLatin', () => {
  it('убирает кириллицу', () => {
    expect(sanitizeLatin('helloпривет')).toBe('hello');
  });
  it('разрешает пробел, дефис, апостроф', () => {
    expect(sanitizeLatin("well-being don't")).toBe("well-being don't");
  });
  it('убирает цифры и прочие символы', () => {
    expect(sanitizeLatin('abc123!@#')).toBe('abc');
  });
  it('возвращает флаг, были ли отброшены символы', () => {
    expect(sanitizeLatin('helloф').changed).toBe(true);
    expect(sanitizeLatin('hello').changed).toBe(false);
  });
});
```

(Примечание: `sanitizeLatin` возвращает объект-обёртку со строковым `valueOf`/`toString`, чтобы тесты `toBe('hello')` и `.changed` оба работали — см. реализацию.)

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/renderer/lib/latin.test.ts`
Expected: FAIL — `sanitizeLatin` не найден.

- [ ] **Step 3: Implement**

```ts
// src/renderer/lib/latin.ts
// Оставляет только латинские буквы + пробел, дефис, апостроф.
// Возвращает строко-подобный объект с флагом changed.
export interface SanitizeResult {
  value: string;
  changed: boolean;
  toString(): string;
  valueOf(): string;
}

const ALLOWED = /[^a-zA-Z \-']/g;

export function sanitizeLatin(input: string): SanitizeResult {
  const value = input.replace(ALLOWED, '');
  const changed = value !== input;
  return {
    value,
    changed,
    toString: () => value,
    valueOf: () => value,
  };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/renderer/lib/latin.test.ts`
Expected: PASS (4 теста). Сравнение `toBe('hello')` проходит за счёт `valueOf`/`toString`; в строгом `toBe` vitest сравнивает примитивы — здесь сравниваем объект со строкой, поэтому тест в Step 1 использует приведение. ЕСЛИ `toBe` не проходит из-за сравнения объекта со строкой — заменить ассерты на `String(sanitizeLatin(...))` в тесте.

> Замечание исполнителю: если строгий `toBe(object, string)` падает, поправь тест на `expect(String(sanitizeLatin('helloпривет'))).toBe('hello')`. Это ожидаемая мелкая правка теста, не бага реализации.

- [ ] **Step 5: Применить в Review input**

В `src/renderer/components/Review/Review.tsx`:

1. Импорт: `import { sanitizeLatin } from '../../lib/latin';`
2. Состояние подсветки: рядом с `const [input, setInput] = useState('');` добавить:
```tsx
  const [inputFlash, setInputFlash] = useState(false);
```
3. Вычислить maxLength по самой длинной словоформе колоды (запас +5, потолок 40). Рядом с вычислением `card`:
```tsx
  const maxLen = Math.min(
    40,
    (queue?.cards?.reduce((m, c) => Math.max(m, c.word.length), 0) ?? 24) + 5
  );
```
> Если в `ReviewQueueState` нет поля `cards` с полным списком — использовать фиксированный потолок: `const maxLen = 40;`. Исполнитель: проверь тип `ReviewQueueState` в `src/shared/types`; если списка слов нет, ставь `const maxLen = 40;`.
4. Обновить `<input className="review-input" …>`:
```tsx
              <input
                ref={inputRef}
                className={`review-input ${inputFlash ? 'flash-bad' : ''}`}
                value={input}
                maxLength={maxLen}
                onChange={(e) => {
                  const res = sanitizeLatin(e.target.value);
                  setInput(res.value);
                  if (res.changed) {
                    setInputFlash(true);
                    window.setTimeout(() => setInputFlash(false), 350);
                  }
                }}
                placeholder={t('review.typePlaceholder')}
                autoComplete="off"
                spellCheck={false}
                lang="en"
              />
```
(Здесь `t` нужен из `usePrefs()`. В Task 7 был добавлен `const { soundEnabled } = usePrefs();` — расширь деструктуризацию до `const { soundEnabled, t } = usePrefs();`. Плейсхолдер и хинт теперь локализованы.)

5. Заменить `<div className="review-hint">Press Enter to check</div>` на:
```tsx
              <div className="review-hint">
                {inputFlash ? t('review.englishOnly') : t('review.checkHint')}
              </div>
```

- [ ] **Step 6: CSS мигания**

В `src/renderer/components/Review/Review.css` добавить:
```css
.review-input.flash-bad {
  animation: input-flash-bad 0.35s ease;
}
@keyframes input-flash-bad {
  0%, 100% { border-color: var(--neon-soft); }
  40% { border-color: var(--bad); box-shadow: 0 0 12px var(--bad-soft); }
}
```

- [ ] **Step 7: Verify manually**

Run: `npm run dev:web` → Review. Печать кириллицы → символы не появляются, поле мигает, хинт «English only». Латиница/пробел/дефис/апостроф работают. Длина ограничена.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/lib/latin.ts src/renderer/lib/latin.test.ts src/renderer/components/Review/Review.tsx src/renderer/components/Review/Review.css
git commit -m "feat(review): только латиница + лимит длины в поле ответа с мягкой обратной связью"
```

---

## Task 11: Полная i18n-замена строк интерфейса

Расширяем словари и заменяем хардкод-строки на `t('key')` в компонентах. Каждый под-шаг — отдельный компонент, чтобы коммиты были маленькими.

**Files (modify):** App.tsx, Decks.tsx, Browser.tsx, Settings.tsx, Generation.tsx, WordInput.tsx, Review.tsx, Preview.tsx, модалки (ConfirmModal, CreateDeckModal, ImportModal, CardEditModal); словари en.ts/ru.ts.

Общий приём для каждого компонента:
1. Добавить `import { useT } from '../../prefs/PreferencesProvider';` (путь скорректировать по вложенности) и `const t = useT();` внутри компонента.
2. Найти все видимые строки: `grep -n ">[A-Za-z]" <файл>` и атрибуты `placeholder=`, `title=`, `aria-label=`, `label=`.
3. На каждую строку завести ключ в `en.ts` и `ru.ts`, заменить в JSX на `{t('key')}`.
4. Сверить идентичность наборов ключей (тест из Task 2 это проверяет).

- [ ] **Step 1: Шапка/навигация (App.tsx)**
Заменить тексты табов и `brand-text p` на `t('nav.*')` / `t('brand.subtitle')` (ключи уже есть из Task 2). `<h1>Qard</h1>` оставить как есть (имя бренда).
Run: `npm test` (проверка идентичности ключей). Commit:
```bash
git add src/renderer/App.tsx
git commit -m "i18n(app): локализация навигации и шапки"
```

- [ ] **Step 2: Generation.tsx**
Завести и заменить ключи: `gen.title` (есть), `gen.description`, `gen.currentSettings` (есть), `gen.words`, `gen.examplesPerWord`, `gen.apiKey`, `gen.configured`, `gen.notConfigured`, `gen.validationTitle`, `gen.addWords`, `gen.enterApiKey`, `gen.start`, `gen.generating`, `gen.progressTitle`, `gen.currentWord`, `gen.stage`, `gen.completed`, `gen.completeTitle`, `gen.completeBody`, и стадии (`gen.stage.definition` и т.д.).
Добавить в en.ts/ru.ts соответствующие пары. Заменить в JSX и в `getStageText`.
Run: `npm test`. Commit:
```bash
git add src/renderer/components/Generation/Generation.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(generation): локализация вкладки Generate"
```

- [ ] **Step 3: WordInput.tsx**
Ключи: `input.title` ('Input Words'/'Ввод слов'), `input.description`, `input.label` ('Word List'/'Список слов'), `input.parse`, `input.import`, `input.clear`, `input.parsed` (с подстановкой числа — использовать шаблон: `t('input.parsed').replace('{n}', String(words.length))`, ключ = `Parsed Words ({n})` / `Распознано слов ({n})`), `input.placeholder`, `input.remove` ('Remove {w}'/'Удалить {w}').
Добавить пары в словари, заменить в JSX.
Run: `npm test`. Commit:
```bash
git add src/renderer/components/WordInput/WordInput.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(input): локализация вкладки Input"
```

- [ ] **Step 4: Review.tsx**
Ключи: `review.exit` уже частично; добавить `review.loading`, `review.doneTitle` ('🎉 Congrats! …'), `review.toDecks`, `review.definition`, `review.example`, `review.correct`, `review.wrong`, `review.audio`, `review.mnemonic`, `review.mnemonicThinking`, `review.next` ('Next (Enter)'/'Дальше (Enter)'), `review.typePlaceholder`/`review.checkHint`/`review.englishOnly` (есть). Метки `Definition`/`Example` — в `capsule-label`.
Заменить в JSX. Commit:
```bash
git add src/renderer/components/Review/Review.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(review): локализация экрана повторения"
```

- [ ] **Step 5: Decks.tsx**
Прочитать файл, извлечь все видимые строки (заголовки, кнопки, пустые состояния), завести ключи `decks.*`, заменить.
Run: `npm test`. Commit:
```bash
git add src/renderer/components/Decks/Decks.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(decks): локализация экрана колод"
```

- [ ] **Step 6: Browser.tsx + Settings.tsx + Preview.tsx**
Аналогично: извлечь строки (label у Select, кнопки, заголовки, help-text), ключи `browse.*`, `setup.*`, `preview.*`. Заменить, включая `label` в вызовах Select.
Run: `npm test`. Commit:
```bash
git add src/renderer/components/Browser/Browser.tsx src/renderer/components/Settings/Settings.tsx src/renderer/components/Preview/Preview.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(browse/setup/preview): локализация оставшихся вкладок"
```

- [ ] **Step 7: Модалки (ConfirmModal, CreateDeckModal, ImportModal, CardEditModal)**
Извлечь строки кнопок/заголовков, ключи `modal.*`. Заменить.
Run: `npm test`. Commit:
```bash
git add src/renderer/components/common/ConfirmModal.tsx src/renderer/components/common/CreateDeckModal.tsx src/renderer/components/Decks/ImportModal.tsx src/renderer/components/Browser/CardEditModal.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "i18n(modals): локализация модальных окон"
```

- [ ] **Step 8: Финальная проверка отсутствия хардкода**
Run: `npm test` (тест идентичности ключей зелёный).
Run: `npm run build` (без TS-ошибок).
Run: `npm run dev:web` → переключить EN/RU: все вкладки и модалки меняют язык, английских строк в RU-режиме не остаётся (визуальный обход).

---

## Финальная верификация (после всех задач)

- [ ] `npm test` — все юнит-тесты зелёные.
- [ ] `npm run build` — Electron-сборка без ошибок.
- [ ] `npm run build:web` — web-сборка без ошибок.
- [ ] Ручной чек-лист по критериям приёмки из спеки (7 фич).
- [ ] Финальный коммит, если остались несобранные изменения.
