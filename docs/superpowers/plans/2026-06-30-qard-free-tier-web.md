# Бесплатный web-режим + удаление мнемоник — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать web-версию Qard бесплатной (ключ ИИ держит Cloudflare Worker, лимит 1 генерация/день до 30 слов по IP), ввести продуктовые лимиты и полностью убрать мнемоники. Desktop не меняется.

**Architecture:** Web ходит в ИИ через Worker `qard-ai-proxy` (секрет-ключ + KV-лимит); desktop — напрямую в ProxyAPI со своим ключом. Платформа определяется build-флагом `__IS_WEB__`.

**Tech Stack:** TypeScript, React, Zustand, Cloudflare Workers (KV), webpack DefinePlugin, vitest.

**Точка возврата:** тег `stable/ownkey-v1`. Ветка работы: `feature/free-tier-web`.

---

## Структура файлов

- `worker/src/ratelimit.ts` (создать) — чистая логика дневного лимита, тестируемая.
- `worker/src/ratelimit.test.ts` (создать) — юнит-тесты лимита.
- `worker/src/index.ts` (переписать) — секрет-ключ, KV, обход по своему ключу, 429/413.
- `worker/wrangler.toml` (изменить) — биндинг KV + (опц.) vars.
- `src/web/backend/ai.ts` (изменить) — ключ опционален, обработка 429, убрать `mnemonic`.
- `webpack.web.config.js`, `webpack.config.js` (изменить) — define `__IS_WEB__`.
- `src/renderer/global.d.ts` (изменить) — объявить `__IS_WEB__`, убрать `ai.mnemonic`.
- `src/renderer/store/index.ts`, `src/web/backend/settings.ts`, `src/main/services/settings.service.ts` (изменить) — дефолты + подрезка лимитов.
- `src/renderer/components/Settings/Settings.tsx` + `.css` (изменить) — web-инфо лимитов + «Продвинутое».
- `src/renderer/components/Generation/Generation.tsx` (изменить) — web без ключа, счётчик слов, сообщение лимита.
- `src/renderer/hooks/useCardGeneration.ts` (изменить) — на web один батч; всплытие ошибки лимита.
- Удаление мнемоник: `gemini.service.ts`, `gemini.handlers.ts`, `preload.ts`, `ai-prompts.ts`, `ai-prompts.test.ts`, `shared/types/index.ts` (AI_MNEMONIC), `Review.tsx`, `Review.css`, `i18n/en.ts`, `i18n/ru.ts`.

---

## Task 1: Полностью убрать мнемоники

**Files:**
- Modify: `src/renderer/components/Review/Review.tsx`
- Modify: `src/renderer/components/Review/Review.css:219-262`
- Modify: `src/main/ipc/gemini.handlers.ts:21-32`
- Modify: `src/main/preload.ts:14-16`
- Modify: `src/main/services/gemini.service.ts:58-87`
- Modify: `src/shared/ai-prompts.ts:118-139`
- Modify: `src/shared/__tests__/ai-prompts.test.ts:2,25-27`
- Modify: `src/web/backend/ai.ts:33-38`
- Modify: `src/renderer/global.d.ts:26-29`
- Modify: `src/shared/types/index.ts:301-304`
- Modify: `src/renderer/i18n/en.ts:64-65`, `src/renderer/i18n/ru.ts:64-65`

- [ ] **Step 1: Review.tsx — убрать state и колбэк мнемоники**

Удалить строки state (≈64-67): `mnemonic`, `mnemonicLoading`, `mnemonicError`. Удалить их сбросы в `reset` (≈100-102). Удалить весь `genMnemonic` useCallback (≈105-121). В импорте React убрать `useCallback`, если он больше нигде не используется (проверить: `grep -n useCallback Review.tsx`).

- [ ] **Step 2: Review.tsx — убрать UI-блок мнемоники**

Удалить блок `<div className="review-mnemonic"> … </div>` (строки ≈307-326) целиком, оставив `<Button size="large" onClick={next}>` ниже.

- [ ] **Step 3: Review.css — убрать стили мнемоники**

Удалить правила `.review-mnemonic`, `.mnemonic-btn`, `.mnemonic-btn:hover…`, `.mnemonic-btn:disabled`, `.mnemonic-card`, `.mnemonic-icon`, `.mnemonic-text`, `.mnemonic-error` (строки ≈219-262).

- [ ] **Step 4: Убрать серверную часть (desktop)**

`gemini.handlers.ts`: удалить весь `ipcMain.handle(IPC_CHANNELS.AI_MNEMONIC, …)` (строки 21-32).
`gemini.service.ts`: удалить метод `generateMnemonic` (строки ≈58-87) и из импорта на строке 3 убрать `buildMnemonicPrompt`.
`preload.ts`: удалить поле `mnemonic: (…) => ipcRenderer.invoke(IPC_CHANNELS.AI_MNEMONIC, …)` (строки 14-16).
`ai-prompts.ts`: удалить `export function buildMnemonicPrompt(...) {…}` (строки ≈118-139).
`shared/types/index.ts`: удалить строку `AI_MNEMONIC: 'ai:mnemonic',` из `IPC_CHANNELS` (≈304).
`global.d.ts`: в `ai:` убрать строку `mnemonic: (...) => Promise<string>;` (28).
`web/backend/ai.ts`: убрать метод `mnemonic` из `webAI` (33-38) и `buildMnemonicPrompt` из импорта (2).

- [ ] **Step 5: Убрать тест и i18n-ключи**

`ai-prompts.test.ts`: убрать `buildMnemonicPrompt` из импорта (2) и удалить тест `it('buildMnemonicPrompt …', …)` (≈25-27).
`i18n/en.ts` и `i18n/ru.ts`: удалить ключи `'review.mnemonic'` и `'review.thinking'` (64-65 в обоих).

- [ ] **Step 6: Проверка сборки и тестов**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0 (нет висячих ссылок на mnemonic).
Run: `grep -rniE "mnemonic|мнемон" src` → пусто.
Run: `npx vitest run`
Expected: все тесты проходят.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Удалить фичу мнемоник полностью"
```

---

## Task 2: Build-флаг `__IS_WEB__`

**Files:**
- Modify: `webpack.web.config.js:39-46`
- Modify: `webpack.config.js:101-106`
- Modify: `src/renderer/global.d.ts:78-82`

- [ ] **Step 1: web-конфиг — добавить define**

В `webpack.web.config.js` внутри существующего `new webpack.DefinePlugin({ … })` добавить поле рядом с `__AI_PROXY_URL__`:

```js
      __IS_WEB__: JSON.stringify(true),
```

- [ ] **Step 2: renderer-конфиг (desktop) — добавить DefinePlugin**

В `webpack.config.js` вверху файла добавить `const webpack = require('webpack');` (после строки 1). В `rendererConfig.plugins` (строки 101-106) добавить:

```js
    new webpack.DefinePlugin({
      __IS_WEB__: JSON.stringify(false),
    }),
```

- [ ] **Step 3: объявить глобал**

В `src/renderer/global.d.ts` внутри `declare global { … }` добавить:

```ts
  // eslint-disable-next-line no-var
  declare const __IS_WEB__: boolean;
```

(Если линтер ругается на расположение — вынести `declare const __IS_WEB__: boolean;` на верхний уровень файла вне `declare global`.)

- [ ] **Step 4: Проверка обеих сборок**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0.
Run: `npm run build` (desktop) → успех.
Run: `npm run build:web` → успех.

- [ ] **Step 5: Commit**

```bash
git add webpack.web.config.js webpack.config.js src/renderer/global.d.ts
git commit -m "Добавить build-флаг __IS_WEB__"
```

---

## Task 3: Продуктовые лимиты (примеры ≤3, цель ≤20) + дефолты + подрезка

**Files:**
- Modify: `src/renderer/store/index.ts:66-67,84-85`
- Modify: `src/web/backend/settings.ts:16-22`
- Modify: `src/main/services/settings.service.ts` (дефолты — найти)
- Modify: `src/renderer/components/Settings/Settings.tsx:71-79`

- [ ] **Step 1: store — дефолт цели 20 + подрезка при загрузке**

В `store/index.ts` начальные значения (строки 66-67): оставить `exampleCount: 3`, поменять `dailyGoal: 30` → `dailyGoal: 20`.
В `loadSettings` (строки 84-86) заменить на подрезку:

```ts
				exampleCount: Math.min(settings.exampleCount || 3, 3),
				dailyGoal: Math.min(settings.dailyGoal || 20, 20),
```

- [ ] **Step 2: web settings defaults**

В `src/web/backend/settings.ts` объекте `defaults` (16-22) поменять `dailyGoal: 30` → `dailyGoal: 20`. `exampleCount: 3` оставить.

- [ ] **Step 3: main settings defaults**

Найти дефолты: `grep -n "dailyGoal\|exampleCount" src/main/services/settings.service.ts`. Привести `dailyGoal` к `20`, `exampleCount` к `3` (если больше). Если значения берутся из `electron-store` defaults — поменять там же.

- [ ] **Step 4: Settings.tsx — обрезать опции селекторов**

`exampleCountOptions` (71-74): заменить `[1, 2, 3, 4, 5]` на `[1, 2, 3]`.
`dailyGoalOptions` (76-79): заменить `[10, 15, 20, 30, 50, 75, 100]` на `[10, 15, 20]`.

- [ ] **Step 5: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0.
Ручная проверка логики подрезки: старое `dailyGoal=50` в localStorage → store грузит 20; `exampleCount=5` → 3.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/store/index.ts src/web/backend/settings.ts src/main/services/settings.service.ts src/renderer/components/Settings/Settings.tsx
git commit -m "Лимиты бесплатного тарифа: примеры ≤3, цель обучения ≤20"
```

---

## Task 4: Worker — чистая логика дневного лимита + тесты

**Files:**
- Create: `worker/src/ratelimit.ts`
- Create: `worker/src/ratelimit.test.ts`

- [ ] **Step 1: Написать падающий тест**

`worker/src/ratelimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dayKey, secondsUntilUtcMidnight, isRateLimited, markUsed, KVLike } from './ratelimit';

function fakeKV(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k)! : null; },
    async put(k, v) { store.set(k, v); },
  };
}

describe('ratelimit', () => {
  it('dayKey формирует ключ по IP и дате UTC', () => {
    const d = new Date('2026-06-30T12:00:00Z');
    expect(dayKey('1.2.3.4', d)).toBe('gen:1.2.3.4:2026-06-30');
  });

  it('secondsUntilUtcMidnight > 0 и < 24ч', () => {
    const d = new Date('2026-06-30T23:00:00Z');
    const s = secondsUntilUtcMidnight(d);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(3600);
  });

  it('первый запрос не лимитирован, после markUsed — лимитирован', async () => {
    const kv = fakeKV();
    const ip = '9.9.9.9';
    const now = new Date('2026-06-30T08:00:00Z');
    expect(await isRateLimited(kv, ip, now)).toBe(false);
    await markUsed(kv, ip, now);
    expect(await isRateLimited(kv, ip, now)).toBe(true);
  });

  it('другой день — снова не лимитирован', async () => {
    const kv = fakeKV();
    const ip = '9.9.9.9';
    await markUsed(kv, ip, new Date('2026-06-30T08:00:00Z'));
    expect(await isRateLimited(kv, ip, new Date('2026-07-01T08:00:00Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — тест падает**

Run: `npx vitest run worker/src/ratelimit.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Реализация**

`worker/src/ratelimit.ts`:

```ts
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export function dayKey(ip: string, now: Date): string {
  const d = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `gen:${ip}:${d}`;
}

export function secondsUntilUtcMidnight(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.floor((next - now.getTime()) / 1000));
}

export async function isRateLimited(kv: KVLike, ip: string, now: Date): Promise<boolean> {
  return (await kv.get(dayKey(ip, now))) !== null;
}

export async function markUsed(kv: KVLike, ip: string, now: Date): Promise<void> {
  await kv.put(dayKey(ip, now), '1', { expirationTtl: secondsUntilUtcMidnight(now) });
}
```

- [ ] **Step 4: Запустить — тест проходит**

Run: `npx vitest run worker/src/ratelimit.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add worker/src/ratelimit.ts worker/src/ratelimit.test.ts
git commit -m "Worker: чистая логика дневного лимита + тесты"
```

---

## Task 5: Worker index — секрет-ключ, KV, обход по своему ключу, 429/413

**Files:**
- Modify: `worker/src/index.ts` (переписать тело fetch)
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: wrangler.toml — биндинги**

Заменить `worker/wrangler.toml` на:

```toml
name = "qard-ai-proxy"
main = "src/index.ts"
compatibility_date = "2024-11-01"

# id будет вписан после `wrangler kv namespace create RL` (Task 9)
[[kv_namespaces]]
binding = "RL"
id = "REPLACE_WITH_KV_ID"

[vars]
MAX_BODY_BYTES = "16384"
MAX_TOKENS = "8000"
```

- [ ] **Step 2: index.ts — переписать**

```ts
import { isRateLimited, markUsed, KVLike } from './ratelimit';

const PROXYAPI_BASE = 'https://api.proxyapi.ru/openai/v1';
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://qard-7rn.pages.dev',
];

interface Env {
  PROXYAPI_KEY: string;
  RL: KVLike;
  MAX_BODY_BYTES?: string;
  MAX_TOKENS?: string;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    const body = await request.text();
    const maxBytes = Number(env.MAX_BODY_BYTES ?? '16384');
    if (body.length > maxBytes) {
      return json({ error: 'too_large' }, 413, origin);
    }

    const userAuth = request.headers.get('Authorization');
    const now = new Date();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Бесплатный режим (без своего ключа): проверяем дневной лимит.
    if (!userAuth) {
      if (await isRateLimited(env.RL, ip, now)) {
        return json({ error: 'daily_limit' }, 429, origin);
      }
    }

    // Подставляем ключ + потолок max_tokens.
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return json({ error: 'bad_json' }, 400, origin);
    }
    const maxTokens = Number(env.MAX_TOKENS ?? '8000');
    if (typeof payload.max_tokens !== 'number' || payload.max_tokens > maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const auth = userAuth || `Bearer ${env.PROXYAPI_KEY}`;
    const upstream = await fetch(`${PROXYAPI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();

    // Списываем дневную попытку только при успехе бесплатного запроса.
    if (!userAuth && upstream.ok) {
      await markUsed(env.RL, ip, now);
    }

    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
```

- [ ] **Step 3: Проверка типов воркера**

Run: `cd worker && npx tsc --noEmit src/index.ts src/ratelimit.ts` (если нет tsconfig в worker — пропустить, проверка типов будет на деплое в Task 9).
Run: `npx vitest run worker/src/ratelimit.test.ts` → PASS (логика не сломана).

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts worker/wrangler.toml
git commit -m "Worker: секрет-ключ + дневной лимит по IP + защита тела"
```

---

## Task 6: Web ai.ts — ключ опционален + обработка 429

**Files:**
- Modify: `src/web/backend/ai.ts:10-26`

- [ ] **Step 1: Переписать функцию chat**

Заменить функцию `chat` на:

```ts
async function chat(prompt: string, temperature: number): Promise<string> {
  const apiKey = await webSettings.get('geminiApiKey'); // опционально (продвинутое)
  const model = (await webSettings.get('aiModel')) || 'gpt-4o-mini';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature }),
  });
  if (resp.status === 429) {
    throw new Error('DAILY_LIMIT');
  }
  if (!resp.ok) {
    throw new Error(`AI request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}
```

(Метод `mnemonic` уже удалён в Task 1.)

- [ ] **Step 2: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add src/web/backend/ai.ts
git commit -m "Web ИИ: ключ опционален, обработка дневного лимита (429)"
```

---

## Task 7: useCardGeneration — на web один батч + всплытие ошибки лимита

**Files:**
- Modify: `src/renderer/hooks/useCardGeneration.ts:91-141,189-197`

- [ ] **Step 1: Один батч на web**

Заменить строку 92 (`const batches = chunkArray(parsedWords, AI_BATCH_SIZE);`) на:

```ts
    // На web вся генерация — один запрос (дневной лимит = 1 запрос/день).
    const batchSize = __IS_WEB__ ? Math.max(parsedWords.length, 1) : AI_BATCH_SIZE;
    const batches = chunkArray(parsedWords, batchSize);
```

- [ ] **Step 2: Захватить ошибку дневного лимита**

Перед `const aiBatchPromises = …` (строка 98) добавить:

```ts
    let dailyLimitHit = false;
```

Внутри `catch (error: any)` блока батча (строки 110-117), перед `throw error;` добавить:

```ts
        if (error?.message === 'DAILY_LIMIT') dailyLimitHit = true;
```

- [ ] **Step 3: Показать сообщение и не плодить error-карточки**

После `await Promise.allSettled([...]);` (строка 141) добавить:

```ts
    if (dailyLimitHit) {
      setIsGenerating(false);
      setGenerationProgress({
        currentWord: '',
        currentStage: GenerationStage.Error,
        completedCards: 0,
        totalCards: totalWords,
        error: 'DAILY_LIMIT',
      });
      return;
    }
```

- [ ] **Step 4: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0 (флаг `__IS_WEB__` объявлен в Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useCardGeneration.ts
git commit -m "Генерация: на web один батч + всплытие дневного лимита"
```

---

## Task 8: Generation.tsx — web без ключа, счётчик слов, сообщение лимита

**Files:**
- Modify: `src/renderer/components/Generation/Generation.tsx:22-93,130-134`
- Modify: `src/renderer/i18n/en.ts`, `src/renderer/i18n/ru.ts`

- [ ] **Step 1: i18n-ключи**

В `en.ts` добавить в блок `gen.*`:

```ts
  'gen.wordCount': 'Words',
  'gen.wordLimit': 'Up to {n} words per day on the free plan',
  'gen.dailyLimitReached': 'Daily limit reached. Come back tomorrow, or add your own key in Setup → Advanced.',
  'gen.tooManyWords': 'Too many words — maximum {n} per generation.',
```

В `ru.ts` — те же ключи:

```ts
  'gen.wordCount': 'Слов',
  'gen.wordLimit': 'До {n} слов в день на бесплатном тарифе',
  'gen.dailyLimitReached': 'Дневной лимит исчерпан. Загляни завтра или добавь свой ключ в Setup → Продвинутое.',
  'gen.tooManyWords': 'Слишком много слов — максимум {n} за одну генерацию.',
```

- [ ] **Step 2: canGenerate и лимит слов**

В `Generation.tsx` заменить `canGenerate` (22-24) на:

```ts
  const WORD_LIMIT = 30;
  const overLimit = __IS_WEB__ && words.length > WORD_LIMIT;
  const canGenerate =
    words.length > 0 &&
    !overLimit &&
    (__IS_WEB__ || !!geminiApiKey);
```

- [ ] **Step 3: Summary — счётчик слов вместо ключа на web**

Заменить summary-блок «API Key» (71-80). Сделать пункт ключа только для desktop, а на web показывать лимит слов:

```tsx
          {!__IS_WEB__ && (
            <div className="summary-item">
              <span className="summary-label">{t('gen.apiKey')}</span>
              <span className={`summary-value ${geminiApiKey ? 'is-ok' : 'is-missing'}`}>
                {geminiApiKey ? (
                  <><CheckIcon size={15} /> {t('gen.configured')}</>
                ) : (
                  <><XIcon size={15} /> {t('gen.notConfigured')}</>
                )}
              </span>
            </div>
          )}
          {__IS_WEB__ && (
            <div className="summary-item">
              <span className="summary-label">{t('gen.wordCount')}</span>
              <span className={`summary-value ${overLimit ? 'is-missing' : 'is-ok'}`}>
                {words.length} / {WORD_LIMIT}
              </span>
            </div>
          )}
```

- [ ] **Step 4: Блок валидации — web vs desktop**

Заменить `<ul>` внутри `validation-errors` (88-91) на:

```tsx
          <ul>
            {words.length === 0 && <li>{t('gen.addWords')}</li>}
            {!__IS_WEB__ && !geminiApiKey && <li>{t('gen.enterKey')}</li>}
            {overLimit && <li>{t('gen.tooManyWords').replace('{n}', String(WORD_LIMIT))}</li>}
          </ul>
```

- [ ] **Step 5: Сообщение дневного лимита**

Заменить блок ошибки прогресса (130-134) на маппинг `DAILY_LIMIT` в дружелюбный текст:

```tsx
          {generationProgress.error && (
            <div className="progress-error">
              <strong>{t('gen.error')}</strong>{' '}
              {generationProgress.error === 'DAILY_LIMIT'
                ? t('gen.dailyLimitReached')
                : generationProgress.error}
            </div>
          )}
```

- [ ] **Step 6: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Generation/Generation.tsx src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "Generate: web без ключа, счётчик слов, сообщение дневного лимита"
```

---

## Task 9: Settings.tsx/.css — web-инфо лимитов + «Продвинутое»

**Files:**
- Modify: `src/renderer/components/Settings/Settings.tsx:81-149`
- Modify: `src/renderer/components/Settings/Settings.css`
- Modify: `src/renderer/i18n/en.ts`, `src/renderer/i18n/ru.ts`

- [ ] **Step 1: i18n-ключи**

В `en.ts` блок `setup.*`:

```ts
  'setup.freeInfo': 'Free plan: 1 generation per day, up to 30 words. Model and examples are configurable.',
  'setup.advanced': 'Advanced',
  'setup.ownKeyHint': 'Paste your own ProxyAPI key to remove the daily limit.',
```

В `ru.ts`:

```ts
  'setup.freeInfo': 'Бесплатно: 1 генерация в день, до 30 слов. Модель и примеры настраиваются.',
  'setup.advanced': 'Продвинутое',
  'setup.ownKeyHint': 'Вставь свой ключ ProxyAPI, чтобы снять дневной лимит.',
```

- [ ] **Step 2: Settings.tsx — добавить state раскрытия «Продвинутое»**

После `const [saveMessage, setSaveMessage] = useState('');` (строка 30) добавить:

```ts
  const [showAdvanced, setShowAdvanced] = useState(false);
```

- [ ] **Step 3: Settings.tsx — web-вариант секции AI Provider**

В секции `<div className="settings-section">` для AI Provider (строки 86-149): на web показать инфо-блок и спрятать ключ/провайдер в «Продвинутое», на desktop оставить как есть. Заменить содержимое секции на:

```tsx
      <div className="settings-section">
        <h3>{t('setup.aiProvider')}</h3>

        {__IS_WEB__ && (
          <p className="help-text settings-free-info">{t('setup.freeInfo')}</p>
        )}

        {!__IS_WEB__ && (
          <Select
            label={t('setup.provider')}
            value={aiProvider}
            onChange={(v) => handleProviderChange(v)}
            options={providerOptions}
          />
        )}

        {/* Модель доступна на обеих платформах */}
        {isCustomProvider && !__IS_WEB__ ? (
          <>
            <Input
              label={t('setup.baseUrl')}
              type="text"
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://your-endpoint/v1"
            />
            <Input
              label={t('setup.model')}
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={t('setup.modelPlaceholder')}
            />
          </>
        ) : (
          <Select
            label={t('setup.model')}
            value={aiModel}
            onChange={(v) => setAiModel(v)}
            options={aiModelOptions}
          />
        )}

        {/* Ключ: на desktop всегда, на web — под «Продвинутое» */}
        {!__IS_WEB__ ? (
          <>
            <Input
              label={t('setup.apiKey')}
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder={t('setup.apiKeyPlaceholder')}
            />
            {aiProvider === 'proxyapi' && (
              <p className="help-text">
                {t('setup.proxyApiHint')}{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.electronAPI.shell.openExternal('https://proxyapi.ru/cabinet/api');
                  }}
                >
                  ProxyAPI Cabinet
                </a>
              </p>
            )}
          </>
        ) : (
          <div className="settings-advanced">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▾' : '▸'} {t('setup.advanced')}
            </button>
            {showAdvanced && (
              <>
                <Input
                  label={t('setup.apiKey')}
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={t('setup.apiKeyPlaceholder')}
                />
                <p className="help-text">{t('setup.ownKeyHint')}</p>
              </>
            )}
          </div>
        )}

        <Select
          label={t('setup.exampleCount')}
          value={exampleCount.toString()}
          onChange={(v) => setExampleCount(parseInt(v))}
          options={exampleCountOptions}
        />
      </div>
```

- [ ] **Step 4: Settings.css — стили инфо/«Продвинутое»**

Добавить в конец `Settings.css`:

```css
.settings-free-info {
  margin-top: 0;
  margin-bottom: var(--space-4);
  color: var(--ivory-dim);
}
.settings-advanced {
  margin-bottom: var(--space-4);
}
.advanced-toggle {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: 600 13px var(--font);
  color: var(--accent);
}
.advanced-toggle:hover { text-decoration: underline; }
```

- [ ] **Step 5: Проверка**

Run: `npx tsc --noEmit -p tsconfig.json` → EXIT 0.
Run: `npm run build:web` → успех.
Run: `npm run build` → успех (desktop-вид секции не изменился).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Settings/Settings.tsx src/renderer/components/Settings/Settings.css src/renderer/i18n/en.ts src/renderer/i18n/ru.ts
git commit -m "Setup: web-инфо лимитов и свой ключ в «Продвинутом»"
```

---

## Task 10: Деплой Worker (KV + секрет + публикация) и дымовой тест

**Files:** —

> Ассистент выполняет `wrangler kv` и `deploy` сам (токен уже в `CLOUDFLARE_API_TOKEN`).
> Шаг с секретом (`wrangler secret put`) запускает **владелец** — ключ не должен попасть в историю.

- [ ] **Step 1: Создать KV namespace**

Run: `cd worker && ../node_modules/.bin/wrangler kv namespace create RL`
Скопировать выданный `id` и вписать в `worker/wrangler.toml` вместо `REPLACE_WITH_KV_ID`.

- [ ] **Step 2: Залить секрет (делает владелец)**

Команда для владельца (ввод ключа скрытый):
`cd worker && npx wrangler secret put PROXYAPI_KEY`

- [ ] **Step 3: Деплой**

Run: `npm run worker:deploy`
Expected: успешная публикация, без ошибок типов.

- [ ] **Step 4: Дымовой тест бесплатного лимита**

Первый запрос (должен пройти):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://qard-ai-proxy.yudin091006.workers.dev \
  -H "Content-Type: application/json" \
  --data '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'
```
Expected: `200`.
Повторный запрос тем же curl сразу → Expected: `429`.

- [ ] **Step 5: Commit (id KV)**

```bash
git add worker/wrangler.toml
git commit -m "Worker: подключить KV-namespace RL"
```

---

## Финальная проверка (после всех тасков)

- [ ] `npx tsc --noEmit -p tsconfig.json` → EXIT 0.
- [ ] `npx vitest run` → все тесты зелёные.
- [ ] `npm run build:web` и `npm run build` → обе сборки успешны.
- [ ] `grep -rniE "mnemonic|мнемон" src worker` → пусто.
- [ ] Ручной прогон web (`npm run dev:web` + `npm run worker:dev`): генерация без ключа работает; повторная за день → сообщение лимита; в Setup нет поля ключа вне «Продвинутого»; примеры до 3, цель до 20.
- [ ] Ручной прогон desktop (`npm run dev`): генерация со своим ключом как раньше; мнемоник нет.

## Откат

`git checkout stable/ownkey-v1` (или `git reset --hard stable/ownkey-v1` на ветке). Worker-деплой откатывается через `wrangler rollback` или повторный деплой версии с тега.
