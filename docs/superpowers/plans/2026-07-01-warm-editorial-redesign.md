# Тёплый editorial-редизайн, фаза 1 (Decks + Review) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести дизайн-токены (обе темы), общие компоненты, экраны Decks и
Review с текущей тёмно-графитовой/неоновой палитры на тёплый
editorial-минимализм (кремовая светлая тема, тёплая шоколадная тёмная,
акцент — глубокий индиго), не меняя логику/поведение приложения.

**Architecture:** Чистая правка CSS-переменных в `src/renderer/App.css`
(источник токенов для обеих тем) + точечные правки в файлах, где раньше были
захардкожены литеральные hex/rgba вместо переменных (это отдельно
задокументировано в каждой задаче — найдено при аудите кода перед
планированием). `.tsx`-файлы не меняются вообще — только `.css`. Единственное
исключение — полностью переписывается `Review.css`, потому что там сейчас
живёт отдельная неоновая палитра, а не переменные.

**Tech Stack:** React + TypeScript (без изменений), чистый CSS с
custom properties, без Tailwind/новых зависимостей.

**Про тесты:** это визуальный/CSS-редизайн без изменения логики — юнит-тестов
на цвета не существует и писать их бессмысленно (TDD здесь неприменим в
привычном виде). Верификация — (1) существующий набор тестов `vitest`
(регресс: логика не задета), (2) успешная сборка (electron + web), (3) ручная
визуальная проверка по чек-листу в обеих темах. Это явное отступление от
TDD-паттерна "тест сначала", обоснованное природой задачи.

---

## Контекст для инженера (прочитать перед началом)

- Дизайн-спека: `docs/superpowers/specs/2026-07-01-warm-editorial-redesign-design.md`
  — там расписано, ПОЧЕМУ выбраны эти токены (одобрено пользователем через
  визуальный брейншторм).
- Утверждённые мокапы (референс, не в git, но остались на диске):
  `.superpowers/brainstorm/1121-1782913723/content/final-direction-v2.html` —
  открыть в браузере (`file://` путь) для сверки итогового вида Decks/Review.
- Два токенных блока в `src/renderer/App.css`:
  - `:root { ... }` (строки ~5-51 сейчас) — это **тёмная** тема по умолчанию.
  - `:root[data-theme='light'] { ... }` (строки ~54-88 сейчас) — светлая тема,
    переопределяет только часть переменных.
- `Review.css` держит СВОИ локальные переменные (`--neon`, `--ok`, `--bad`,
  `--bg-0`, `--bg-1`, `--text`, `--text-dim`) внутри `.review { ... }` — это
  единственное место в проекте, где тема объявлена не в App.css.
- При аудите перед планированием найдены захардкоженные (не через переменные)
  цвета в нескольких файлах — они привязаны к конкретным старым hex-значениям
  графитовой/неоновой палитры и **сломаются визуально**, если просто поменять
  токены в App.css и не потрогать эти места. Полный список — в задачах ниже.
  Каждый такой случай найден через `grep -n "#[0-9a-fA-F]\{3,6\}|rgba(" <файл>`
  — при желании можно перепроверить тем же способом перед началом.

---

### Task 1: Глобальные токены — `src/renderer/App.css`

**Files:**
- Modify: `src/renderer/App.css:1-324`

- [ ] **Шаг 1: Заменить блок тёмной темы (default `:root`, строки 5-51)**

Старое (строки 5-51) → новое:

```css
:root {
  --bg: #201c17;
  --bg-deep: #1a1713;
  --bg-elev: #2a251e;
  --surface: #2a251e;
  --surface-hi: #332c23;
  --border: #423a2e;
  --border-soft: #3a332a;

  --ivory: #f4efe6;
  --ivory-dim: #b9ac97;
  --muted: #8a7d6a;

  --new: #5fa3a6;
  --learn: #dba458;
  --due: #7bbf85;
  --green: #7bbf85;
  --amber: #dba458;

  --accent: #7b8fc4;
  --accent-hi: #93a4d1;
  --accent-press: #64769e;
  --accent-shade: #4a5a82;
  --accent-soft: rgba(123, 143, 196, 0.16);
  --on-accent: #1c2136;

  --coral: #e8856e;
  --coral-shade: #b85c48;
  --coral-soft: rgba(232, 133, 110, 0.14);

  --recess: rgba(0, 0, 0, 0.16);

  --key-shadow: #14110d;
  --radius: 16px;

  --header-overlay: linear-gradient(180deg, rgba(42, 37, 30, 0.55) 0%, rgba(32, 28, 23, 0) 100%);
  --card-end: #221e18;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-md: 18px;
  --text-lg: 22px;
  --text-xl: 28px;
  --text-2xl: 36px;

  --font: 'Rubik', system-ui, -apple-system, sans-serif;
}
```

Комментарий над блоком поменять с `/* Глобальная графитовая тема (mid-tone,
игра-головоломка) */` на `/* Глобальная тёплая тема — editorial-минимализм
(тёмный вариант). Единый источник дизайн-токенов. */`.

- [ ] **Шаг 2: Заменить блок светлой темы (`:root[data-theme='light']`, старые строки 54-88)**

```css
:root[data-theme='light'] {
  --bg: #f4efe6;
  --bg-deep: #ece5d8;
  --bg-elev: #fffdf9;
  --surface: #fffdf9;
  --surface-hi: #fbf6ee;
  --border: #e4dcc9;
  --border-soft: #ece5d5;

  --ivory: #2b2620;
  --ivory-dim: #6b6154;
  --muted: #8a8071;

  --accent: #3a4a6b;
  --accent-hi: #4d5f85;
  --accent-press: #2c3852;
  --accent-shade: #22304a;
  --accent-soft: rgba(58, 74, 107, 0.12);
  --on-accent: #fffdf9;

  --new: #3d6b6e;
  --learn: #b5793a;
  --due: #4d6e50;
  --green: #4d6e50;
  --amber: #b5793a;

  --coral: #d35f43;
  --coral-shade: #a9442d;
  --coral-soft: rgba(211, 95, 67, 0.12);

  --recess: rgba(43, 38, 32, 0.05);

  --key-shadow: #d8cdb8;

  --header-overlay: linear-gradient(180deg, rgba(255, 253, 249, 0.75) 0%, rgba(255, 253, 249, 0) 100%);
  --card-end: #ece2d0;
}
```

Оставить без изменений последующие правила `:root[data-theme='light'] .brand-logo`,
`.brand-text p`, `.tab`, `.tab:hover` (строки ~90-103 в текущем файле) — они уже
используют переменные (`--ivory-dim`) либо нейтральный тёмный оттенок для
тени/hover, оставить как есть.

- [ ] **Шаг 3: Поправить фон `.app` — убрать хардкод старых графитовых радиальных бликов**

Старое:
```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--font);
  color: var(--ivory);
  background:
    radial-gradient(120% 80% at 8% -10%, #383e4d 0%, rgba(56, 62, 77, 0) 52%),
    radial-gradient(120% 90% at 100% 0%, #353b49 0%, rgba(53, 59, 73, 0) 55%),
    var(--bg);
}
```

Новое (радиальные блики берутся из токена, а не хардкода — иначе в светлой
теме по углам будут видны тёмно-серые пятна):
```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--font);
  color: var(--ivory);
  background:
    radial-gradient(120% 80% at 8% -10%, var(--bg-elev) 0%, transparent 52%),
    radial-gradient(120% 90% at 100% 0%, var(--bg-elev) 0%, transparent 55%),
    var(--bg);
}
```

- [ ] **Шаг 4: Поправить свечение логотипа (было завязано на старый неон-акцент)**

Старое (строка ~155):
```css
.brand-logo {
  width: 32px;
  height: 37px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.4));
}
```

Новое:
```css
.brand-logo {
  width: 32px;
  height: 37px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px var(--accent-soft));
}
```

- [ ] **Шаг 5: Применить шкалу типографики к заголовку вкладки**

Старое:
```css
.tab-content h2 {
  font-size: 31px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ivory);
  margin-bottom: 8px;
}
```

Новое:
```css
.tab-content h2 {
  font-size: var(--text-xl);
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ivory);
  margin-bottom: 8px;
}
```

- [ ] **Шаг 6: Обновить цвет текста на кнопках (кнопка больше не светло-синяя, а тёмно-индиго/светло-индиго — старый жёстко закодированный тёмный текст перестаёт годиться)**

Старое (в блоке `:where(button:not(.tab))`, строка ~240):
```css
:where(button:not(.tab)) {
  padding: 11px 22px;
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  color: #16233b;
  border: none;
  border-radius: 999px;
  font-family: var(--font);
  font-size: 16.5px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.06s ease;
}
```

Новое (только строка `color`):
```css
:where(button:not(.tab)) {
  padding: 11px 22px;
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  color: var(--on-accent);
  border: none;
  border-radius: 999px;
  font-family: var(--font);
  font-size: 16.5px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.06s ease;
}
```

- [ ] **Шаг 7: Прогнать сборку electron-конфига, убедиться что CSS валиден**

Run: `npm run build`
Expected: сборка завершается без ошибок (webpack компилирует `App.css` через
`css-loader`/`style-loader`, синтаксическая ошибка в CSS уронит сборку).

- [ ] **Шаг 8: Коммит**

```bash
git add src/renderer/App.css
git commit -m "Токены: тёплая editorial-палитра вместо графита (обе темы)"
```

---

### Task 2: Общие компоненты — `Button.css`, `Input.css`, `Modal.css`

**Files:**
- Modify: `src/renderer/components/common/Button.css:27-66`
- Modify: `src/renderer/components/common/Input.css:32-39`
- Modify: `src/renderer/components/common/Modal.css:22-26`

- [ ] **Шаг 1: Button.css — текст на primary-кнопке и починка danger/success градиентов под новую палитру**

Старое (`.btn-primary`, строки 27-35):
```css
.btn-primary {
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  color: #16233b;
  box-shadow: 0 5px 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
.btn-primary:active:not(:disabled) {
  box-shadow: 0 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

Новое (только `color`):
```css
.btn-primary {
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  color: var(--on-accent);
  box-shadow: 0 5px 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
.btn-primary:active:not(:disabled) {
  box-shadow: 0 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

Старое (`.btn-success`, строки 58-66) — верхний стоп градиента и тень
захардкожены под старый ярко-мятный зелёный, с новым приглушённым
"лесным" `--green` это будет выглядеть разнобойно:
```css
.btn-success {
  background: linear-gradient(180deg, #9aebc1 0%, var(--green) 100%);
  color: #0e2c1d;
  box-shadow: 0 5px 0 #3f8f68, inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-success:hover:not(:disabled) { filter: brightness(1.05); }
.btn-success:active:not(:disabled) {
  box-shadow: 0 0 0 #3f8f68, inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

Новое:
```css
.btn-success {
  background: linear-gradient(180deg, color-mix(in srgb, var(--green) 55%, white) 0%, var(--green) 100%);
  color: #0e2c1d;
  box-shadow: 0 5px 0 color-mix(in srgb, var(--green) 65%, black), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-success:hover:not(:disabled) { filter: brightness(1.05); }
.btn-success:active:not(:disabled) {
  box-shadow: 0 0 0 color-mix(in srgb, var(--green) 65%, black), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

`color-mix()` поддерживается всеми современными Chromium/Electron-версиями
(Electron 28 → Chromium 120+), используется только тут — если при сборке/в
браузере понадобится fallback, можно вернуться к паре захардкоженных hex per
theme, но проще держать одну формулу, производную от токена.

`.btn-danger` (строки 48-56) не трогаем — `--coral`/`--coral-shade` не
менялись, текст `#3a1810` по-прежнему читаемый.

- [ ] **Шаг 2: Input.css — контраст ошибки завязать на переменную, а не на старый hex**

Старое (строки 32-39):
```css
.input-error {
  border-color: var(--coral);
}

.input-error:focus {
  border-color: var(--coral);
  box-shadow: 0 0 0 4px rgba(232, 133, 110, 0.16);
}
```

Новое:
```css
.input-error {
  border-color: var(--coral);
}

.input-error:focus {
  border-color: var(--coral);
  box-shadow: 0 0 0 4px var(--coral-soft);
}
```

(Раньше это было захардкожено под альфа-версию **тёмной** темы — в светлой
теме фокус-кольцо ошибки было чуть ярче, чем должно; теперь берётся правильный
оттенок для активной темы.)

- [ ] **Шаг 3: Modal.css — цвет текста ошибки создания колоды**

Старое (строки 22-26):
```css
.modal-create .modal-error {
  margin: 10px 0 0;
  color: #f0a892;
  font-size: 13.5px;
}
```

Новое:
```css
.modal-create .modal-error {
  margin: 10px 0 0;
  color: var(--coral);
  font-size: 13.5px;
}
```

- [ ] **Шаг 4: Сборка + прогон тестов**

Run: `npm run build && npm test`
Expected: сборка без ошибок, `vitest run` — все существующие тесты зелёные
(логика кнопок/инпутов не менялась, эти тесты не про CSS, но регресс-прогон
подтверждает, что ничего не сломано на уровне сборки).

- [ ] **Шаг 5: Коммит**

```bash
git add src/renderer/components/common/Button.css src/renderer/components/common/Input.css src/renderer/components/common/Modal.css
git commit -m "Общие компоненты: индиго-акцент, починка danger/success под новую палитру"
```

---

### Task 3: Decks — `Decks.css`

**Files:**
- Modify: `src/renderer/components/Decks/Decks.css:1-624`

Ниже — все места, где раньше был хардкод конкретных старых hex/rgba вместо
переменных (найдено при аудите, все остальные ~600 строк файла уже используют
переменные и подхватят новую палитру автоматически из Task 1 — трогать их не
нужно).

- [ ] **Шаг 1: Заголовок вкладки — единая шкала с `.tab-content h2`**

Старое (строки 14-20):
```css
.decks-title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ivory);
  margin: 0 0 6px;
}
```

Новое:
```css
.decks-title {
  font-size: var(--text-xl);
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ivory);
  margin: 0 0 6px;
}
```

- [ ] **Шаг 2: Легенда-бейджи и `.stat`/`.onboard-steps li` — заменить хардкод "утопленной" панели на токен**

Старое (строка 37, внутри `.legend-badge`):
```css
  background: rgba(0, 0, 0, 0.18);
```
Новое:
```css
  background: var(--recess);
```

Старое (строка 160, внутри `.stat`):
```css
  background: rgba(0, 0, 0, 0.16);
```
Новое:
```css
  background: var(--recess);
```

Старое (строка 484, внутри `.onboard-steps li`):
```css
  background: rgba(0, 0, 0, 0.16);
```
Новое:
```css
  background: var(--recess);
```

- [ ] **Шаг 3: Кнопка "Учить" / `.btn-accent` / `.onboard-num` — верхний стоп градиента и цвет текста**

Эти три блока (строки ~196-223 `.btn-learn`, ~278-287 `.btn-accent`, ~487-499
`.onboard-num`) используют одинаковый паттерн: верхний стоп градиента
захардкожен как старый светло-синий `#8fb2f2`, а текст — как старый тёмно-синий
`#16233b`. Заменить в каждом из трёх блоков:

`#8fb2f2` → `var(--accent-hi)`
`color: #16233b;` → `color: var(--on-accent);`

Пример на `.btn-learn` (строки 196-223), старое:
```css
.btn-learn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: inherit;
  font-size: 17px;
  font-weight: 600;
  color: #16233b;
  padding: 12px 24px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(180deg, #8fb2f2 0%, var(--accent) 100%);
  box-shadow:
    0 5px 0 0 var(--accent-shade),
    0 12px 20px -8px rgba(63, 94, 150, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.15s ease;
}
.btn-learn:hover { filter: brightness(1.05); }
.btn-learn:active {
  transform: translateY(5px);
  box-shadow:
    0 0 0 0 var(--accent-shade),
    0 4px 10px -6px rgba(63, 94, 150, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.btn-learn svg { margin-left: -2px; }
```

Новое:
```css
.btn-learn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: inherit;
  font-size: 17px;
  font-weight: 600;
  color: var(--on-accent);
  padding: 12px 24px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  box-shadow:
    0 5px 0 0 var(--accent-shade),
    0 12px 20px -8px var(--accent-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.15s ease;
}
.btn-learn:hover { filter: brightness(1.05); }
.btn-learn:active {
  transform: translateY(5px);
  box-shadow:
    0 0 0 0 var(--accent-shade),
    0 4px 10px -6px var(--accent-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.btn-learn svg { margin-left: -2px; }
```

(Обратите внимание: `rgba(63, 94, 150, 0.7)` — сильное цветное свечение под
кнопкой — заменено на `var(--accent-soft)`, оно мягче. Это осознанное
упрощение под "без тяжёлых декоративных эффектов" из утверждённого
направления, не случайная правка.)

`.btn-accent` (строки 278-287), старое:
```css
.btn-accent {
  color: #16233b;
  background: linear-gradient(180deg, #8fb2f2 0%, var(--accent) 100%);
  box-shadow: 0 5px 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-accent:hover { filter: brightness(1.05); }
.btn-accent:active {
  transform: translateY(5px);
  box-shadow: 0 0 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

Новое:
```css
.btn-accent {
  color: var(--on-accent);
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
  box-shadow: 0 5px 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-accent:hover { filter: brightness(1.05); }
.btn-accent:active {
  transform: translateY(5px);
  box-shadow: 0 0 0 0 var(--accent-shade), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

`.onboard-num` (строки 487-499), старое:
```css
.onboard-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 700;
  color: #16233b;
  background: linear-gradient(180deg, #8fb2f2 0%, var(--accent) 100%);
}
```

Новое:
```css
.onboard-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 700;
  color: var(--on-accent);
  background: linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 100%);
}
```

- [ ] **Шаг 4: Ховер названия колоды — не форсировать чистый белый текст**

Старое (строки 122-125):
```css
.deck-name:hover {
  border-bottom-color: var(--accent);
  color: #fff;
}
```

Новое (в светлой теме белый текст на кремовой карточке был бы невидим):
```css
.deck-name:hover {
  border-bottom-color: var(--accent);
  color: var(--accent-hi);
}
```

- [ ] **Шаг 5: Поповер лимитов — убрать захардкоженный графитовый градиент**

Старое (строки 320-345):
```css
.deck-popover {
  position: absolute;
  top: calc(100% - 6px);
  right: 16px;
  z-index: 50;
  width: min(320px, calc(100vw - 40px));
  padding: 18px 18px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, #3a404e 0%, #333845 100%);
  border: 1px solid var(--border);
  box-shadow: 0 22px 44px -18px rgba(0, 0, 0, 0.75);
  animation: popover-in 0.16s ease both;
}
/* Хвостик-стрелка к шестерёнке */
.deck-popover::before {
  content: '';
  position: absolute;
  top: -7px;
  right: 60px;
  width: 13px;
  height: 13px;
  background: #3a404e;
  border-left: 1px solid var(--border);
  border-top: 1px solid var(--border);
  transform: rotate(45deg);
}
```

Новое:
```css
.deck-popover {
  position: absolute;
  top: calc(100% - 6px);
  right: 16px;
  z-index: 50;
  width: min(320px, calc(100vw - 40px));
  padding: 18px 18px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, var(--surface-hi) 0%, var(--surface) 100%);
  border: 1px solid var(--border);
  box-shadow: 0 22px 44px -18px rgba(0, 0, 0, 0.75);
  animation: popover-in 0.16s ease both;
}
/* Хвостик-стрелка к шестерёнке */
.deck-popover::before {
  content: '';
  position: absolute;
  top: -7px;
  right: 60px;
  width: 13px;
  height: 13px;
  background: var(--surface-hi);
  border-left: 1px solid var(--border);
  border-top: 1px solid var(--border);
  transform: rotate(45deg);
}
```

- [ ] **Шаг 6: Инпут создания колоды и "искра" онбординга — снять завязку на старый accent-blue**

Старое (строки 432-435, внутри `.deck-create-input:focus`):
```css
.deck-create-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(111, 156, 232, 0.14);
}
```
Новое:
```css
.deck-create-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
```

Старое (строка 454, внутри `.onboard-spark`):
```css
  filter: drop-shadow(0 0 14px rgba(111, 156, 232, 0.5));
```
Новое:
```css
  filter: drop-shadow(0 0 14px var(--accent-soft));
```

- [ ] **Шаг 7: Блок ошибки Decks — завязать на токен ошибки**

Старое (строки 529-537):
```css
.decks-error {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(232, 133, 110, 0.12);
  border: 1px solid rgba(232, 133, 110, 0.4);
  color: #f0a892;
  font-size: 14px;
}
```

Новое:
```css
.decks-error {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--coral-soft);
  border: 1px solid var(--coral);
  color: var(--coral);
  font-size: 14px;
}
```

- [ ] **Шаг 8: Модалка импорта (`.modal`/`.modal-overlay`, низ файла) — снять хардкод старой графитовой темы**

Старое (строки 577-624):
```css
.modal {
  font-family: 'Rubik', system-ui, sans-serif;
  color: #ece9e1;
  background: linear-gradient(180deg, #3a404e 0%, #333845 100%);
  border: 1px solid #4b5365;
  border-radius: 20px;
  padding: 26px 28px;
  width: 560px;
  max-width: calc(100vw - 40px);
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
}

.modal h3 {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 14px;
  color: #fff;
}

.modal p {
  color: #aab0bd;
  font-size: 14px;
  line-height: 1.5;
}

.modal label {
  color: #ece9e1;
  font-size: 14px;
}

.modal input[type='checkbox'] {
  width: auto;
  accent-color: #6f9ce8;
}

.modal .help-text.error {
  color: #f0a892;
}
```

Новое:
```css
.modal {
  font-family: var(--font);
  color: var(--ivory);
  background: linear-gradient(180deg, var(--surface-hi) 0%, var(--surface) 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 26px 28px;
  width: 560px;
  max-width: calc(100vw - 40px);
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
}

.modal h3 {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 14px;
  color: var(--ivory);
}

.modal p {
  color: var(--ivory-dim);
  font-size: 14px;
  line-height: 1.5;
}

.modal label {
  color: var(--ivory);
  font-size: 14px;
}

.modal input[type='checkbox'] {
  width: auto;
  accent-color: var(--accent);
}

.modal .help-text.error {
  color: var(--coral);
}
```

`.modal-overlay { background: rgba(18, 21, 28, 0.62); ... }` (строки 565-575)
**не трогать** — тёмный скрим поверх всей страницы уместен в обеих темах
(стандартная конвенция для модалок), это не забытый графитовый хардкод.

- [ ] **Шаг 9: Сборка**

Run: `npm run build`
Expected: без ошибок.

- [ ] **Шаг 10: Коммит**

```bash
git add src/renderer/components/Decks/Decks.css
git commit -m "Decks: тёплая палитра, единая типографика, чистка хардкод-цветов"
```

---

### Task 4: StudyHeader — `StudyHeader.css`

**Files:**
- Modify: `src/renderer/components/Decks/StudyHeader.css:70-91`

- [ ] **Шаг 1: Кольцо и текст "цель достигнута" — снять хардкод старого зелёного**

Старое (строки 70-72):
```css
.sh-ring-fill.is-done {
  stroke: #4fc78a;
}
```
Новое:
```css
.sh-ring-fill.is-done {
  stroke: var(--due);
}
```

Старое (строки 87-90):
```css
.sh-goal-done {
  font-size: 22px;
  font-weight: 700;
  color: #4fc78a;
}
```
Новое:
```css
.sh-goal-done {
  font-size: 22px;
  font-weight: 700;
  color: var(--due);
}
```

Огонёк стрика (градиент `#ffd27a → #ff7a45`, строки 38 и 157) **не трогать** —
он уже тёплый (янтарь → терракот), вписывается в новую палитру без изменений.

- [ ] **Шаг 2: Сборка**

Run: `npm run build`
Expected: без ошибок.

- [ ] **Шаг 3: Коммит**

```bash
git add src/renderer/components/Decks/StudyHeader.css
git commit -m "StudyHeader: кольцо цели дня на токене --due вместо хардкода"
```

---

### Task 5: Review — полный перевод с неона на тёплую палитру

**Files:**
- Modify: `src/renderer/components/Review/Review.css` (переписывается целиком)

Здесь смысла делать точечные диффы нет — почти каждая строка файла ссылается
на локальные неоновые переменные (`--neon`, `--ok`, `--bad`, `--bg-0`,
`--bg-1`, `--text`, `--text-dim`), которых в новой системе не будет. Логика
`Review.tsx` не меняется вообще — только этот CSS-файл.

- [ ] **Шаг 1: Заменить весь файл `Review.css` на:**

```css
.review {
  font-family: var(--font);
  color: var(--ivory);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 80vh;
  padding: 28px 20px 48px;
  border-radius: var(--radius);
  background: transparent;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 860px;
  margin-bottom: 40px;
}

.review-counts {
  display: flex;
  gap: 14px;
  font-weight: 600;
}
.review-counts .count-new { color: var(--new); }
.review-counts .count-learn { color: var(--learn); }
.review-counts .count-due { color: var(--due); }

/* ===== Капсула ===== */
.review-capsule {
  position: relative;
  width: 100%;
  max-width: 760px;
  padding: 44px 52px;
  border-radius: var(--radius-lg, 24px);
  background: linear-gradient(180deg, var(--surface-hi) 0%, var(--surface) 100%);
  border: 1.5px solid var(--border);
  box-shadow: 0 20px 44px -26px rgba(0, 0, 0, 0.35);
  text-align: center;
  animation: capsule-in 0.45s ease both;
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
}

.review-capsule.is-correct {
  border-color: var(--due);
  box-shadow: 0 20px 44px -26px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--due) inset;
  animation: capsule-in 0.3s ease both;
}
.review-capsule.is-wrong {
  border-color: var(--coral);
  box-shadow: 0 20px 44px -26px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--coral) inset;
  animation: capsule-in 0.3s ease both;
}

.capsule-label {
  font-size: 0.92rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.85;
  margin: 24px 0 8px;
}
.capsule-label:first-child { margin-top: 0; }

.capsule-text {
  font-size: var(--text-2xl);
  line-height: 1.45;
  font-weight: 500;
  margin: 0;
  color: var(--ivory);
}
.capsule-text .blank {
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.04em;
  border-bottom: 2px solid var(--accent);
}

/* ===== Ввод ===== */
.review-input-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 36px;
  width: 100%;
  max-width: 480px;
}

.review-input {
  width: 100%;
  text-align: center;
  font-family: inherit;
  font-size: 1.85rem;
  font-weight: 600;
  color: var(--ivory);
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--border);
  border-radius: 10px 10px 0 0;
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.25s ease;
}
.review-input::placeholder { color: var(--muted); font-weight: 400; }
.review-input:focus {
  border-bottom-color: var(--accent);
}

.review-hint {
  margin-top: 10px;
  font-size: 0.9rem;
  color: var(--ivory-dim);
}

/* ===== Результат ===== */
.review-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 820px;
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
  background: var(--recess);
}
.review-answer.is-correct {
  border-bottom-color: var(--due);
  color: var(--due);
}
.review-answer.is-wrong {
  border-bottom-color: var(--coral);
  color: var(--coral);
  animation: shake 0.4s ease both;
}
.answer-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
}
.answer-badge svg { flex-shrink: 0; }

.review-reveal {
  margin-top: 28px;
  text-align: center;
  animation: reveal-in 0.45s ease both;
}
.reveal-word {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--ivory);
}
.reveal-type { color: var(--ivory-dim); font-style: italic; margin-top: 2px; font-size: 1.05rem; }
.reveal-transcription { color: var(--accent); margin: 8px 0 16px; font-size: 1.15rem; }

.reveal-examples {
  list-style: none;
  padding: 0;
  margin: 20px auto 26px;
  max-width: 660px;
  text-align: left;
}
.reveal-examples li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--ivory);
  font-size: 1.08rem;
  line-height: 1.5;
}
.reveal-examples strong { color: var(--accent); font-weight: 700; }

.review-done {
  text-align: center;
  margin-top: 72px;
  font-size: 1.2rem;
  color: var(--ivory);
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
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

@media (max-width: 600px) {
  .review { padding: 18px 12px 36px; min-height: 70vh; }
  .review-header { margin-bottom: 26px; }
  .review-capsule { padding: 30px 22px; border-radius: 20px; }
  .capsule-text { font-size: var(--text-xl); }
  .capsule-label { font-size: 0.78rem; margin: 18px 0 6px; }
  .review-input { font-size: 1.4rem; }
  .reveal-word { font-size: var(--text-xl); }
  .review-input-form { margin-top: 26px; }
}

@media (prefers-reduced-motion: reduce) {
  .review-capsule,
  .review-result,
  .review-reveal,
  .review-answer.is-wrong {
    animation: none !important;
  }
}

.review-input.flash-bad {
  animation: input-flash-bad 0.35s ease;
}
@keyframes input-flash-bad {
  0%, 100% { border-color: var(--border); }
  40% { border-color: var(--coral); }
}
```

Что изменилось по смыслу (для ревью):
- Убраны локальные переменные `--bg-0/--bg-1/--neon*/--ok*/--bad*/--text*` и
  их light-override — капсула и весь экран теперь целиком на глобальных
  токенах, как остальное приложение.
- `.review` больше не рисует свой тёмный радиальный фон — прозрачный, экран
  визуально сидит на фоне родительской `.tab-content` карточки (как Decks).
- Убраны все `text-shadow`/неоновые `box-shadow`-свечения — состояния
  верно/неверно показаны цветом рамки капсулы (`--due`/`--coral`), это и есть
  "без тяжёлых декоративных эффектов" из утверждённого направления.
- `capsule-text`/`reveal-word` переведены на `--text-2xl` (унификация с
  остальной шкалой типографики вместо произвольных `2.85rem`/`2.6rem`).
- Поведение (фокус на инпуте, Enter/Space → следующая карточка, автоплей
  аудио, shake при неверном ответе, `prefers-reduced-motion`) не изменилось —
  это чистая перекраска, `Review.tsx` не тронут.

- [ ] **Шаг 2: Сборка**

Run: `npm run build`
Expected: без ошибок.

- [ ] **Шаг 3: Коммит**

```bash
git add src/renderer/components/Review/Review.css
git commit -m "Review: убрать неоновую капсулу, единый тёплый визуальный язык"
```

---

### Task 6: Верификация — сборка, тесты, ручная проверка обеих тем

**Files:** нет изменений кода — только проверка.

- [ ] **Шаг 1: Полная пересборка electron и web**

Run: `npm run build`
Expected: `webpack --config webpack.config.js --mode production` завершается
без ошибок (0 warnings уровня error).

Run: `npm run build:web`
Expected: `webpack --config webpack.web.config.js --mode production`
завершается без ошибок.

- [ ] **Шаг 2: Прогон существующих тестов (регресс)**

Run: `npm test`
Expected: `vitest run` — все тесты зелёные (в частности
`src/renderer/components/Review/__tests__` для `htmlText.ts` и тесты
`collection.stats` — они не завязаны на CSS и должны быть не затронуты;
зелёный прогон подтверждает, что правки не задели логику).

- [ ] **Шаг 3: Ручная проверка — тёмная тема**

Run: `npm run dev` (или `npm run dev:web` для web-варианта)

Открыть приложение, оставить тему по умолчанию (тёмную, `data-theme`
отсутствует). Проверить:
- Decks: фон тёплый тёмно-шоколадный (не серо-синий графит), карточки колод
  на `--surface`, кнопка "Учить" — индиго-градиент со светлым текстом,
  бейджи New/Learning/Due — teal/охра/зелёный, StudyHeader (кольцо цели,
  стрик, недельные бары) читаемы.
- Review: капсула вопроса — карточка без синего свечения, рамка меняет цвет
  на зелёный/коралловый при верном/неверном ответе, инпут и подсказка
  читаемы, аудио и переход к следующей карточке (Enter/Space) работают как
  раньше.
- Переключить на светлую тему (переключатель в шапке, `HeaderControls`) —
  повторить те же проверки.

- [ ] **Шаг 4: Ручная проверка — экраны вне фазы 1 не сломаны**

Открыть Browse, Setup, Input, Generate, Preview — вкладки не редизайнились
структурно в этой фазе, но обязаны:
- не иметь визуальных поломок (нечитаемый текст, инвертированные цвета,
  "исчезающие" элементы на новом фоне);
- унаследовать новую базовую палитру автоматически (фон, кнопки, инпуты,
  шапка) — это ожидаемо и нормально, глубокая структурная переверстка этих
  экранов — отдельные будущие фазы (см. дизайн-спеку, раздел "Вне рамок").

- [ ] **Шаг 5: Итоговый коммит (если в шагах 3-4 найдены мелкие правки)**

Если ручная проверка не выявила проблем — коммитить нечего, финальное
состояние уже закоммичено по задачам 1-5. Если найдены mелкие огрехи —
исправить точечно в соответствующем файле и закоммитить отдельным коммитом
с описанием находки.

---

## Самопроверка плана (выполнена)

- **Покрытие спеки:** дизайн-токены обеих тем (Task 1), Decks (Task 3-4),
  Review (Task 5), общие компоненты Button/Input/Select/Modal (Task 2 —
  Select.css отдельно не редактируется: при аудите в нём не найдено ни одного
  хардкод-цвета, все правила уже на переменных и подхватят новую палитру из
  Task 1 без правок) — все разделы спеки закрыты задачами.
- **Плейсхолдеры:** отсутствуют, весь CSS-код в шагах — конечный, готовый к
  вставке.
- **Согласованность типов/имён:** новые токены (`--on-accent`, `--coral-soft`,
  `--recess`, `--text-*`, `--space-8`) используются одинаково во всех задачах,
  где встречаются; проверено построчно при написании.
- **Найдено и учтено сверх исходной спеки:** несколько мест захардкоженного
  старого accent-blue/графита в App.css, Decks.css, StudyHeader.css,
  Button.css, Input.css, Modal.css, которые без правки визуально сломались бы
  при простой замене токенов (см. контекст каждой задачи) — это не выход за
  рамки спеки, а необходимое условие, чтобы спека вообще сработала корректно.
