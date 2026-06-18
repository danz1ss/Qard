# Qard Web-PWA Port v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Запустить Qard как web-PWA на Cloudflare Pages: тот же React-UI, локальная sql.js-база в IndexedDB, AI-генерация через Cloudflare Worker (прокси к ProxyAPI), произношение через Web Speech API — бесплатно, данные у юзера.

**Architecture:** Весь UI (`src/renderer`) общается только через `window.electronAPI` (контракт `ElectronAPI` из `src/renderer/global.d.ts`). Порт = новый модуль `src/web/`, который ДО рендера React заполняет `window.electronAPI` браузерной реализацией того же контракта, переиспользуя `CollectionService` и `SchedulerService` как есть. Desktop (Electron) не трогаем. AI-промпты выносятся в `src/shared/ai-prompts.ts` (DRY между electron и web). Cloudflare Worker проксирует запросы к ProxyAPI, добавляя CORS.

**Tech Stack:** React 18 + TS, sql.js (WASM SQLite), ts-fsrs, zustand, webpack 5, idb-keyval (IndexedDB), Workbox (PWA), Cloudflare Pages + Workers (wrangler), vitest + fake-indexeddb + jsdom (тесты).

---

## File Structure

**Создаём:**
- `src/shared/ai-prompts.ts` — чистые функции промптов и парсинга (вынос из `gemini.service.ts`)
- `src/web/index.tsx` — точка входа web: init backend → render `<App/>`
- `src/web/index.html` — HTML-шаблон + регистрация SW + ссылка на manifest
- `src/web/backend/sqljs-loader.ts` — `initSqlJs` с `locateFile` для браузера
- `src/web/backend/storage.ts` — load/save sql.js-дампа в IndexedDB (debounce)
- `src/web/backend/settings.ts` — settings поверх localStorage (контракт `settings`)
- `src/web/backend/ai.ts` — `ai.generateBatch/mnemonic` через fetch к Worker
- `src/web/backend/tts.ts` — `tts.generateAudio` через Web Speech API
- `src/web/backend/backup.ts` — экспорт/импорт дампа БД (файл ↔ IndexedDB)
- `src/web/backend/seed.ts` — seed магнит-колод A1/A2/B1 при пустой базе
- `src/web/backend/api.ts` — сборка объекта `ElectronAPI` и установка на `window`
- `src/web/seed-data/a1.json`, `a2.json`, `b1.json` — данные магнит-колод
- `src/web/manifest.webmanifest` — PWA-манифест
- `src/web/sw.ts` — service worker (Workbox precache + runtime)
- `webpack.web.config.js` — web-таргет сборки
- `worker/src/index.ts` — Cloudflare Worker (AI-прокси)
- `worker/wrangler.toml` — конфиг Worker
- Тесты: `src/web/backend/__tests__/{settings,storage,backup,seed}.test.ts`, `src/shared/__tests__/ai-prompts.test.ts`

**Модифицируем:**
- `src/renderer/global.d.ts` — добавить опциональное поле `backup` в `ElectronAPI`
- `src/main/services/gemini.service.ts` — использовать `ai-prompts.ts` (DRY, без смены поведения)
- `src/renderer/components/Settings/Settings.tsx` — кнопки «Экспорт/Импорт бэкапа» (если `window.electronAPI.backup` есть)
- `package.json` — скрипты `dev:web`, `build:web`, `worker:dev`, `worker:deploy`; зависимости

---

## Phase 0: Подготовка зависимостей и тест-окружения

### Task 0.1: Установить зависимости

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Установить рантайм- и dev-зависимости**

Run:
```bash
cd "C:/Users/muroc/OneDrive/Рабочий стол/AnkiGeEn"
npm install idb-keyval
npm install -D copy-webpack-plugin workbox-webpack-plugin fake-indexeddb jsdom wrangler
```
Expected: пакеты добавлены в `package.json`, установка без ошибок.

- [ ] **Step 2: Проверить, что desktop-сборка не сломалась**

Run: `npm run build`
Expected: `webpack ... compiled successfully` (три конфига main/preload/renderer).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json pnpm-lock.yaml 2>/dev/null; git commit -m "chore: deps for web port (idb-keyval, workbox, wrangler, test env)"
```

---

## Phase 1: Вынос AI-промптов в shared (DRY, без смены поведения desktop)

### Task 1.1: Создать `src/shared/ai-prompts.ts`

**Files:**
- Create: `src/shared/ai-prompts.ts`
- Test: `src/shared/__tests__/ai-prompts.test.ts`

- [ ] **Step 1: Написать падающий тест на парсинг ответа**

```ts
// src/shared/__tests__/ai-prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildBatchPrompt, parseBatchResponse, buildMnemonicPrompt } from '../ai-prompts';
import { ParsedWord, PartOfSpeech } from '../utils/wordParser';

describe('ai-prompts', () => {
  it('buildBatchPrompt включает слова и количество примеров', () => {
    const words: ParsedWord[] = [{ word: 'run', partOfSpeech: PartOfSpeech.Any }];
    const p = buildBatchPrompt(words, 2);
    expect(p).toContain('run');
    expect(p).toContain('2 additional examples');
  });

  it('parseBatchResponse извлекает JSON-массив и чистит транскрипцию', () => {
    const raw = 'тут текст [{"word":"run","meanings":[{"wordType":"verb","definition":"d","definitionExample":"e","exampleType":"run","examples":["a"],"transcription":"/rʌn/"}]}] хвост';
    const res = parseBatchResponse(raw);
    expect(res).toHaveLength(1);
    expect(res[0].word).toBe('run');
    expect(res[0].meanings[0].transcription).toBe('rʌn');
  });

  it('parseBatchResponse бросает на отсутствие массива', () => {
    expect(() => parseBatchResponse('нет json')).toThrow();
  });

  it('buildMnemonicPrompt подставляет слово вместо прочерков', () => {
    const p = buildMnemonicPrompt('run', 'If you ______, you move fast', 'verb');
    expect(p).toContain('run');
    expect(p).not.toContain('______');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/shared/__tests__/ai-prompts.test.ts`
Expected: FAIL — модуль `../ai-prompts` не найден.

- [ ] **Step 3: Реализовать `ai-prompts.ts` (перенос логики из `gemini.service.ts` дословно)**

```ts
// src/shared/ai-prompts.ts
import { BatchWordResult, ParsedWord } from './types';
import { formatPartOfSpeech } from './utils/wordParser';

export function buildBatchPrompt(
  parsedWords: ParsedWord[],
  examplesPerMeaning: number,
): string {
  const wordsList = parsedWords
    .map((pw, i) => `${i + 1}. "${pw.word}" (${formatPartOfSpeech(pw.partOfSpeech)})`)
    .join('\n');

  return `You are an expert lexicographer creating Anki flashcards.

TASK: For EACH word below, generate 1 MAIN meaning. Customize the language based on the input word.

WORDS:
${wordsList}

RULES:
1. **Language Detection & Output Language**:
   - If the input word is **English**: Generate definitions, examples, and word types in **English**. Use simple vocabulary (A1-B1).
   - If the input word is **Russian**: Generate definitions, examples, and word types in **Russian**. Use clear, simple Russian.
   - If the input word is mixed or other: Default to English.
   - Examples in the definition MUST be in the same language as the definition.

2. **Meaning Limit**: Generate only 1 most common/important meaning per word.

3. **Part of Speech Constraint**:
   - If "(verb only)" is specified: Generate only verb definitions (or Russian "глагол").
   - If "(noun only)" is specified: Generate only noun definitions (or Russian "существительное").
   - If "(any part of speech)" is specified: Pick the most common part of speech.
   - ALL meanings for a word MUST be the SAME part of speech.

4. **Definition Style (COBUILD)**:
   - Use full sentence definitions where possible (e.g., "If you ____, you...").
   - **Blank in Definition**: ALWAYS replace the target word with "______" (6 underscores) in the \`definition\` field ONLY.
   - **Clarity**: The definition must be easier to understand than the word itself.

5. **Examples (definitionExample and examples)**:
   - **NO BLANKS**: Do NOT use underscores in \`definitionExample\` or the \`examples\` array.
   - **BOLD TARGET**: ALWAYS wrap the target word (or its forms) with \`<b>\` tags in both \`definitionExample\` and the \`examples\` array.
   - Provide ${examplesPerMeaning} additional examples in the \`examples\` array.

6. **Transcription**:
   - Provide IPA transcription for the word.

Respond with a JSON array where each object represents ONE word with its meanings:
[
  {
    "word": "run",
    "meanings": [
      {
        "wordType": "verb",
        "definition": "If you ______, you move very quickly by moving your legs faster than when you walk.",
        "definitionExample": "I <b>run</b> every morning to stay healthy.",
        "exampleType": "run",
        "examples": ["She <b>runs</b> faster than anyone.", "The children were <b>running</b>."],
        "transcription": "rʌn"
      }
    ]
  }
]

IMPORTANT:
- Process ALL ${parsedWords.length} words
- Generate ONLY 1 meaning per word (not more!)
- ALL meanings for one word MUST have the SAME wordType
- Strictly follow part of speech constraints when specified
- Respond with ONLY the JSON array, no other text`;
}

export function parseBatchResponse(text: string): BatchWordResult[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Invalid response format from AI');
  }
  const parsed = JSON.parse(jsonMatch[0]) as any[];
  return parsed.map((wordResult: any) => ({
    word: wordResult.word || '',
    meanings: (wordResult.meanings || []).map((meaning: any) => ({
      wordType: meaning.wordType || '',
      definition: meaning.definition || '',
      definitionExample: meaning.definitionExample || '',
      exampleType: meaning.exampleType || '',
      examples: meaning.examples || [],
      transcription: (meaning.transcription || '').replace(/\//g, '').trim(),
    })),
  }));
}

export function buildMnemonicPrompt(
  word: string,
  definition: string,
  wordType: string,
): string {
  return `You are a memory coach who creates vivid mnemonics for language learners.

WORD: "${word}"${wordType ? ` (${wordType})` : ''}
MEANING: ${definition.replace(/_{3,}/g, word)}

TASK: Create ONE short, vivid mnemonic that helps memorize this word and its meaning.

RULES:
1. **Output language**: Write the mnemonic in the SAME language as the word above.
   - English word → English mnemonic. Russian word → Russian mnemonic. Default to English.
2. **Technique**: Use a sound-alike association, a vivid mental image, or a memorable mini-story that links the word's form to its meaning.
3. **Length**: 1-2 sentences max. Be concrete and visual, not abstract.
4. **Tone**: Playful and memorable. Slightly absurd images stick better.
5. Output ONLY the mnemonic text. No labels, no quotes, no preface.`;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/shared/__tests__/ai-prompts.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ai-prompts.ts src/shared/__tests__/ai-prompts.test.ts
git commit -m "feat: extract AI prompts to shared/ai-prompts (DRY)"
```

### Task 1.2: Переключить `gemini.service.ts` на `ai-prompts.ts`

**Files:**
- Modify: `src/main/services/gemini.service.ts`

- [ ] **Step 1: Заменить инлайн-промпты на вызовы хелперов**

В `generateWordMeaningsBatch` удалить локальную сборку `wordsList`+`prompt` и парсинг, использовать:
```ts
import { buildBatchPrompt, parseBatchResponse, buildMnemonicPrompt } from '../../shared/ai-prompts'
// ...
const prompt = buildBatchPrompt(parsedWords, examplesPerMeaning)
const completion = await this.client!.chat.completions.create({
  model: this.model,
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
})
const text = completion.choices[0]?.message?.content || ''
return parseBatchResponse(text)
```
В `generateMnemonic` заменить инлайн-`prompt` на `const prompt = buildMnemonicPrompt(word, definition, wordType)`.

- [ ] **Step 2: Прогнать существующие тесты + сборку desktop**

Run: `npx vitest run && npm run build`
Expected: все тесты PASS, сборка успешна (поведение desktop не изменилось).

- [ ] **Step 3: Commit**

```bash
git add src/main/services/gemini.service.ts
git commit -m "refactor: gemini.service uses shared ai-prompts"
```

---

## Phase 2: Web-backend ядро (storage, settings, sql.js)

### Task 2.1: sql.js loader для браузера

**Files:**
- Create: `src/web/backend/sqljs-loader.ts`

- [ ] **Step 1: Реализовать загрузчик с locateFile**

```ts
// src/web/backend/sqljs-loader.ts
import initSqlJs, { SqlJsStatic } from 'sql.js';

let promise: Promise<SqlJsStatic> | null = null;

/**
 * Грузит sql.js WASM в браузере. Файл sql-wasm.wasm копируется в корень
 * сборки через copy-webpack-plugin (см. webpack.web.config.js), поэтому
 * locateFile отдаёт абсолютный путь от корня сайта.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!promise) {
    promise = initSqlJs({ locateFile: (file: string) => `/${file}` });
  }
  return promise;
}
```

Примечание: в браузере `CollectionService.init()` вызывает `initSqlJs()` без `locateFile`. Чтобы переиспользовать сервис как есть, в web мы НЕ зовём `CollectionService.init` напрямую — вместо этого см. Task 2.2: грузим SQL заранее и патчим. Альтернатива (проще и используется здесь): добавить в `CollectionService.init` опциональный параметр загрузчика. Реализуем это в следующем шаге.

- [ ] **Step 2: Расширить `CollectionService.init`, чтобы принимать готовый SqlJsStatic (не ломая desktop)**

Modify `src/main/services/collection.service.ts`:
```ts
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
// ...
async init(data?: Uint8Array, sqlJs?: SqlJsStatic): Promise<void> {
  const SQL = sqlJs ?? (await initSqlJs());
  this.db = data ? new SQL.Database(data) : new SQL.Database();
  this.db.run('PRAGMA foreign_keys = ON');
  this.db.run(SCHEMA);
}
```
Desktop вызывает `init(data)` без второго аргумента — поведение не меняется.

- [ ] **Step 3: Прогнать тесты collection + сборку desktop**

Run: `npx vitest run src/main/services/__tests__ && npm run build`
Expected: PASS, сборка успешна.

- [ ] **Step 4: Commit**

```bash
git add src/web/backend/sqljs-loader.ts src/main/services/collection.service.ts
git commit -m "feat: sql.js browser loader + optional SqlJsStatic in CollectionService.init"
```

### Task 2.2: Settings поверх localStorage

**Files:**
- Create: `src/web/backend/settings.ts`
- Test: `src/web/backend/__tests__/settings.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// @vitest-environment jsdom
// src/web/backend/__tests__/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { webSettings } from '../settings';

describe('webSettings', () => {
  beforeEach(() => localStorage.clear());

  it('возвращает дефолты при пустом хранилище', async () => {
    expect(await webSettings.get('aiProvider')).toBe('proxyapi');
    expect(await webSettings.get('exampleCount')).toBe(3);
    expect(await webSettings.get('dailyGoal')).toBe(30);
  });

  it('сохраняет и читает значение', async () => {
    await webSettings.set('geminiApiKey', 'sk-test');
    expect(await webSettings.get('geminiApiKey')).toBe('sk-test');
  });

  it('getAll возвращает объект со всеми полями', async () => {
    await webSettings.set('dailyGoal', 50);
    const all = await webSettings.getAll();
    expect(all.dailyGoal).toBe(50);
    expect(all.aiProvider).toBe('proxyapi');
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/web/backend/__tests__/settings.test.ts`
Expected: FAIL — модуль `../settings` не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/web/backend/settings.ts
import { AppSettings } from '../../shared/types';

const KEY = 'qard-settings';

interface SettingsSchema {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  defaultDeckId?: number;
  exampleCount: number;
  dailyGoal: number;
  fieldMapping: Record<string, string>;
}

const defaults: SettingsSchema = {
  aiProvider: 'proxyapi',
  aiModel: 'gpt-4o-mini',
  exampleCount: 3,
  dailyGoal: 30,
  fieldMapping: {},
};

function read(): SettingsSchema {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function write(s: SettingsSchema): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const webSettings = {
  async get(key: string): Promise<any> {
    return (read() as any)[key];
  },
  async set(key: string, value: any): Promise<void> {
    const s = read();
    (s as any)[key] = value;
    write(s);
  },
  async getAll(): Promise<Partial<AppSettings>> {
    const s = read();
    return {
      geminiApiKey: s.geminiApiKey,
      aiProvider: s.aiProvider ?? 'proxyapi',
      aiModel: s.aiModel ?? 'gpt-4o-mini',
      aiBaseUrl: s.aiBaseUrl,
      defaultDeckId: s.defaultDeckId,
      exampleCount: s.exampleCount ?? 3,
      dailyGoal: s.dailyGoal ?? 30,
      fieldMapping: s.fieldMapping ?? {},
    };
  },
};
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/web/backend/__tests__/settings.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/web/backend/settings.ts src/web/backend/__tests__/settings.test.ts
git commit -m "feat: web settings over localStorage"
```

### Task 2.3: Storage — персист sql.js-дампа в IndexedDB

**Files:**
- Create: `src/web/backend/storage.ts`
- Test: `src/web/backend/__tests__/storage.test.ts`

- [ ] **Step 1: Написать падающий тест (fake-indexeddb)**

```ts
// @vitest-environment jsdom
// src/web/backend/__tests__/storage.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { loadDump, saveDump, BACKUP_PREFIX } from '../storage';
import { clear } from 'idb-keyval';

describe('web storage', () => {
  beforeEach(async () => { await clear(); });

  it('loadDump возвращает undefined на пустом хранилище', async () => {
    expect(await loadDump()).toBeUndefined();
  });

  it('saveDump/loadDump сохраняет и читает байты', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await saveDump(bytes);
    const got = await loadDump();
    expect(got).toBeInstanceOf(Uint8Array);
    expect(Array.from(got!)).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/web/backend/__tests__/storage.test.ts`
Expected: FAIL — модуль `../storage` не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/web/backend/storage.ts
import { get, set } from 'idb-keyval';

const DB_KEY = 'qard-collection-db';
export const BACKUP_PREFIX = 'qard-collection-db.bak-';

export async function loadDump(): Promise<Uint8Array | undefined> {
  const v = await get<Uint8Array>(DB_KEY);
  return v ? new Uint8Array(v) : undefined;
}

export async function saveDump(bytes: Uint8Array): Promise<void> {
  await set(DB_KEY, bytes);
}

export async function backupDump(bytes: Uint8Array): Promise<void> {
  await set(`${BACKUP_PREFIX}${Date.now()}`, bytes);
}

const DEBOUNCE_MS = 1000;

/**
 * Создаёт debounce-сохранятор: вызывается из CollectionService.onChange,
 * собирает export() и пишет в IndexedDB не чаще раза в секунду.
 */
export function createSaver(getBytes: () => Uint8Array): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const flush = () => {
    const bytes = getBytes();
    chain = chain.then(() => saveDump(bytes)).catch((e) => console.error('save failed', e));
  };
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/web/backend/__tests__/storage.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/web/backend/storage.ts src/web/backend/__tests__/storage.test.ts
git commit -m "feat: IndexedDB persistence for sql.js dump"
```

---

## Phase 3: AI через Cloudflare Worker

### Task 3.1: Cloudflare Worker — AI-прокси к ProxyAPI

**Files:**
- Create: `worker/src/index.ts`
- Create: `worker/wrangler.toml`

- [ ] **Step 1: Реализовать Worker (CORS + проксирование, BYOK насквозь)**

```ts
// worker/src/index.ts
const PROXYAPI_BASE = 'https://api.proxyapi.ru/openai/v1';
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://qard.pages.dev',
];

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }
    // Тело — стандартный OpenAI chat completions; ключ юзера в Authorization
    const auth = request.headers.get('Authorization') || '';
    const body = await request.text();
    const upstream = await fetch(`${PROXYAPI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
```

- [ ] **Step 2: Конфиг wrangler**

```toml
# worker/wrangler.toml
name = "qard-ai-proxy"
main = "src/index.ts"
compatibility_date = "2024-11-01"
```

- [ ] **Step 3: Локальный прогон Worker**

Run: `cd worker && npx wrangler dev`
Expected: Worker слушает на `http://localhost:8787`. Проверка вручную (с реальным ProxyAPI-ключом Данька):
```bash
curl -i -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PROXYAPI_KEY>" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'
```
Expected: HTTP 200 + JSON с ответом, заголовок `Access-Control-Allow-Origin` присутствует.

> **Нужно от Данька:** ProxyAPI-ключ для этой проверки.

- [ ] **Step 4: Commit**

```bash
git add worker/
git commit -m "feat: cloudflare worker AI proxy to ProxyAPI with CORS"
```

### Task 3.2: Web AI-адаптер (fetch к Worker)

**Files:**
- Create: `src/web/backend/ai.ts`

- [ ] **Step 1: Реализовать (использует ai-prompts + fetch к Worker)**

```ts
// src/web/backend/ai.ts
import { BatchWordResult, ParsedWord } from '../../shared/types';
import { buildBatchPrompt, parseBatchResponse, buildMnemonicPrompt } from '../../shared/ai-prompts';
import { webSettings } from './settings';

// URL Worker'а задаётся при сборке (DefinePlugin) либо дефолт для dev.
declare const __AI_PROXY_URL__: string;
const PROXY_URL =
  typeof __AI_PROXY_URL__ !== 'undefined' ? __AI_PROXY_URL__ : 'http://localhost:8787';

async function chat(prompt: string, temperature: number): Promise<string> {
  const apiKey = await webSettings.get('geminiApiKey');
  if (!apiKey) {
    throw new Error('API key not set. Please configure API key in settings.');
  }
  const model = (await webSettings.get('aiModel')) || 'gpt-4o-mini';
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature }),
  });
  if (!resp.ok) {
    throw new Error(`AI request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export const webAI = {
  async generateBatch(parsedWords: ParsedWord[], examplesCount: number): Promise<BatchWordResult[]> {
    const text = await chat(buildBatchPrompt(parsedWords, examplesCount), 0.7);
    return parseBatchResponse(text);
  },
  async mnemonic(word: string, definition: string, wordType: string): Promise<string> {
    const text = await chat(buildMnemonicPrompt(word, definition, wordType), 0.9);
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Empty response from AI');
    return trimmed;
  },
};
```

- [ ] **Step 2: Проверка типов**

Run: `npx tsc --noEmit -p tsconfig.json` (если отдельного нет — `npx tsc --noEmit`)
Expected: без ошибок по `src/web/backend/ai.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/web/backend/ai.ts
git commit -m "feat: web AI adapter via cloudflare worker"
```

---

## Phase 4: TTS, backup, seed-колоды

### Task 4.1: TTS через Web Speech API

**Files:**
- Create: `src/web/backend/tts.ts`

- [ ] **Step 1: Реализовать (озвучка на лету; контракт возвращает ArrayBuffer, поэтому отдаём пустой буфер и проигрываем сами)**

```ts
// src/web/backend/tts.ts

/**
 * Web Speech API: синтез на лету. Desktop-контракт возвращает ArrayBuffer
 * с mp3; в web мы проигрываем звук сразу и возвращаем пустой ArrayBuffer
 * (UI использует факт успешного резолва, не сами байты, для произношения).
 */
function detectLang(text: string): string {
  return /[а-яА-ЯёЁ]/.test(text) ? 'ru-RU' : 'en-US';
}

export const webTTS = {
  async generateAudio(text: string): Promise<ArrayBuffer> {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported');
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = detectLang(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return new ArrayBuffer(0);
  },
};
```

Примечание для исполнителя: проверить в `src/renderer/components/Review/Review.tsx` и `CardPreview.tsx`, как используется результат `tts.generateAudio`. Если UI создаёт `Blob`/`Audio` из ArrayBuffer и при пустом буфере молчит — в этих местах добавить ветку: если буфер пустой, считать, что звук уже воспроизведён. Этот шаг разбирается в Task 6.2 (интеграция UI).

- [ ] **Step 2: Проверка типов**

Run: `npx tsc --noEmit`
Expected: без ошибок по `tts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/web/backend/tts.ts
git commit -m "feat: web TTS via Web Speech API"
```

### Task 4.2: Backup экспорт/импорт

**Files:**
- Create: `src/web/backend/backup.ts`
- Test: `src/web/backend/__tests__/backup.test.ts`

- [ ] **Step 1: Написать падающий тест на сериализацию имени файла**

```ts
// @vitest-environment jsdom
// src/web/backend/__tests__/backup.test.ts
import { describe, it, expect } from 'vitest';
import { backupFilename } from '../backup';

describe('backup', () => {
  it('backupFilename содержит дату и расширение .qard', () => {
    const name = backupFilename(new Date('2026-06-18T10:00:00'));
    expect(name).toMatch(/^qard-backup-2026-06-18\.qard$/);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/web/backend/__tests__/backup.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

```ts
// src/web/backend/backup.ts
import { CollectionService } from '../../main/services/collection.service';
import { loadSqlJs } from './sqljs-loader';
import { saveDump } from './storage';

export function backupFilename(d: Date = new Date()): string {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `qard-backup-${iso}.qard`;
}

/** Экспорт текущего дампа БД в файл (скачивание). */
export function exportBackup(service: CollectionService): void {
  const bytes = service.export();
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Импорт дампа из файла: заменяет текущую базу. Возвращает новый
 * CollectionService с загруженными данными (вызывающий перезагружает UI).
 */
export async function importBackup(file: File): Promise<void> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const SQL = await loadSqlJs();
  // Валидация: пробуем открыть как sql.js базу
  const test = new SQL.Database(buf);
  test.run('SELECT 1');
  test.close();
  await saveDump(buf);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/web/backend/__tests__/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/backend/backup.ts src/web/backend/__tests__/backup.test.ts
git commit -m "feat: web backup export/import"
```

### Task 4.3: Seed магнит-колод A1/A2/B1

**Files:**
- Create: `src/web/seed-data/a1.json`, `a2.json`, `b1.json`
- Create: `src/web/backend/seed.ts`
- Test: `src/web/backend/__tests__/seed.test.ts`

- [ ] **Step 1: Создать данные колод (мин. жизнеспособный набор; полный контент Данёк добавит позже)**

```json
// src/web/seed-data/a1.json
{
  "name": "Лексика A1",
  "cards": [
    { "word": "house", "wordType": "noun", "definition": "A ______ is a building where people live.", "definitionExample": "They live in a big <b>house</b>.", "transcription": "haʊs", "examples": ["My <b>house</b> is small."] },
    { "word": "water", "wordType": "noun", "definition": "______ is the clear liquid that you drink.", "definitionExample": "I drink <b>water</b> every day.", "transcription": "ˈwɔːtə", "examples": ["The <b>water</b> is cold."] }
  ]
}
```
(Аналогично `a2.json` — name "Лексика A2", `b1.json` — name "Лексика B1", по 2+ карточки каждая в том же формате. Полный список слов готовит Данёк/генерируется AI позже — для v1 достаточно непустых колод.)

- [ ] **Step 2: Написать падающий тест**

```ts
// @vitest-environment jsdom
// src/web/backend/__tests__/seed.test.ts
import { describe, it, expect } from 'vitest';
import initSqlJs from 'sql.js';
import { CollectionService } from '../../../main/services/collection.service';
import { seedIfEmpty } from '../seed';

describe('seed', () => {
  it('создаёт магнит-колоды в пустой базе', async () => {
    const SQL = await initSqlJs();
    const col = new CollectionService();
    await col.init(undefined, SQL);
    await seedIfEmpty(col);
    const decks = col.listDecks(Date.now());
    const names = decks.map((d) => d.name).sort();
    expect(names).toContain('Лексика A1');
    expect(names).toContain('Лексика A2');
    expect(names).toContain('Лексика B1');
    expect(decks.find((d) => d.name === 'Лексика A1')!.totalCards).toBeGreaterThan(0);
  });

  it('не дублирует колоды при повторном вызове', async () => {
    const SQL = await initSqlJs();
    const col = new CollectionService();
    await col.init(undefined, SQL);
    await seedIfEmpty(col);
    await seedIfEmpty(col);
    expect(col.listDecks(Date.now())).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run src/web/backend/__tests__/seed.test.ts`
Expected: FAIL — модуль `../seed` не найден.

- [ ] **Step 4: Реализовать**

```ts
// src/web/backend/seed.ts
import { CollectionService } from '../../main/services/collection.service';
import { NewCardInput } from '../../shared/types';
import a1 from '../seed-data/a1.json';
import a2 from '../seed-data/a2.json';
import b1 from '../seed-data/b1.json';

interface SeedDeck {
  name: string;
  cards: Array<Omit<NewCardInput, 'tags' | 'audioFilename'>>;
}

const SEEDS: SeedDeck[] = [a1 as SeedDeck, a2 as SeedDeck, b1 as SeedDeck];

/** Если в базе нет колод — создаёт магнит-колоды A1/A2/B1. Идемпотентно. */
export async function seedIfEmpty(col: CollectionService): Promise<void> {
  if (col.listDecks(Date.now()).length > 0) {
    return;
  }
  const now = Date.now();
  for (const seed of SEEDS) {
    const deck = col.createDeck(seed.name);
    const inputs: NewCardInput[] = seed.cards.map((c) => ({
      word: c.word,
      wordType: c.wordType,
      definition: c.definition,
      definitionExample: c.definitionExample,
      transcription: c.transcription,
      examples: c.examples,
      audioFilename: null,
      tags: '',
    }));
    col.addCards(deck.id, inputs, now);
  }
}
```

Примечание: для импорта JSON в TS включить `resolveJsonModule` в `tsconfig.json` (проверить; если нет — добавить `"resolveJsonModule": true` в `compilerOptions`).

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run src/web/backend/__tests__/seed.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 6: Commit**

```bash
git add src/web/seed-data/ src/web/backend/seed.ts src/web/backend/__tests__/seed.test.ts tsconfig.json
git commit -m "feat: seed magnet decks A1/A2/B1 on empty db"
```

---

## Phase 5: Сборка API-моста и web entry point

### Task 5.1: Собрать `window.electronAPI` (api.ts)

**Files:**
- Create: `src/web/backend/api.ts`

- [ ] **Step 1: Реализовать сборку контракта**

```ts
// src/web/backend/api.ts
import { CollectionService } from '../../main/services/collection.service';
import { SchedulerService } from '../../main/services/scheduler.service';
import { ElectronAPI } from '../../renderer/global';
import { loadSqlJs } from './sqljs-loader';
import { loadDump, backupDump, createSaver } from './storage';
import { webSettings } from './settings';
import { webAI } from './ai';
import { webTTS } from './tts';
import { exportBackup, importBackup } from './backup';
import { seedIfEmpty } from './seed';

export interface WebBackend {
  api: ElectronAPI & { backup: { export: () => void; import: (f: File) => Promise<void> } };
  service: CollectionService;
}

/**
 * Инициализирует браузерный backend: грузит sql.js, открывает базу из
 * IndexedDB (битую — в бэкап и с нуля), сеет магнит-колоды, вешает
 * debounce-сохранение и возвращает реализацию контракта ElectronAPI.
 */
export async function initWebBackend(): Promise<WebBackend> {
  const SQL = await loadSqlJs();
  const service = new CollectionService();
  const dump = await loadDump();
  try {
    await service.init(dump, SQL);
  } catch (e) {
    console.error('DB corrupted, starting fresh:', e);
    if (dump) await backupDump(dump);
    await service.init(undefined, SQL);
  }
  await seedIfEmpty(service);

  const save = createSaver(() => service.export());
  service.setOnChange(save);

  const scheduler = new SchedulerService(service);

  const api = {
    shell: {
      openExternal: async (url: string) => { window.open(url, '_blank', 'noopener'); },
    },
    ai: webAI,
    tts: webTTS,
    settings: webSettings,
    collection: {
      listDecks: async () => service.listDecks(Date.now()),
      createDeck: async (name: string) => service.createDeck(name),
      renameDeck: async (id: number, name: string) => service.renameDeck(id, name),
      deleteDeck: async (id: number) => { service.deleteDeck(id); },
      updateDeckLimits: async (id: number, n: number, r: number) => service.updateDeckLimits(id, n, r),
      addCards: async (deckId: number, cards: any[]) => service.addCards(deckId, cards, Date.now()),
      updateCard: async (u: any) => service.updateCardText(u),
      deleteCards: async (ids: number[]) => { service.deleteCards(ids); },
      moveCards: async (ids: number[], deckId: number) => service.moveCards(ids, deckId),
      searchCards: async (q: any) => service.searchCards(q),
      getCard: async (id: number) => service.getCard(id),
      listWords: async (deckId: number) => service.listWords(deckId),
    },
    review: {
      getQueue: async (deckId: number) => scheduler.getQueue(deckId),
      answer: async (cardId: number, rating: any) => scheduler.answer(cardId, rating),
      previewIntervals: async (cardId: number) => scheduler.previewIntervals(cardId),
    },
    media: {
      // В v1 аудио не хранится (TTS на лету) — всегда null.
      getAudio: async (_filename: string) => null,
    },
    stats: {
      get: async () => service.getStudyStats(Date.now()),
    },
    importer: {
      // Anki-импорт отложен в фазу 2 (нужен .apkg-парсинг вместо AnkiConnect).
      getAnkiDecks: async () => [],
      run: async () => ({ imported: 0, skipped: 0, errors: 0 }),
      onProgress: (_cb: (p: any) => void) => () => {},
    },
    backup: {
      export: () => exportBackup(service),
      import: (f: File) => importBackup(f),
    },
  };

  return { api, service };
}
```

- [ ] **Step 2: Проверка типов**

Run: `npx tsc --noEmit`
Expected: без ошибок (контракт совпадает с `ElectronAPI`; `addCards` в web игнорирует параметр `audio` — сигнатура остаётся совместимой, т.к. вызывающий передаёт массив, который не используется).

Примечание: если tsc ругается на `addCards` (контракт требует 3-й аргумент), оставить параметр в сигнатуре: `addCards: async (deckId, cards, _audio) => ...`.

- [ ] **Step 3: Commit**

```bash
git add src/web/backend/api.ts
git commit -m "feat: assemble window.electronAPI web implementation"
```

### Task 5.2: Web entry point + типы backup

**Files:**
- Create: `src/web/index.tsx`
- Create: `src/web/index.html`
- Modify: `src/renderer/global.d.ts`

- [ ] **Step 1: Добавить опциональный `backup` в контракт**

В `src/renderer/global.d.ts`, внутри `interface ElectronAPI`, добавить:
```ts
  backup?: {
    export: () => void;
    import: (file: File) => Promise<void>;
  };
```

- [ ] **Step 2: Создать HTML-шаблон**

```html
<!-- src/web/index.html -->
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2D323E" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Qard — Anki для нормальных людей</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

- [ ] **Step 3: Создать точку входа**

```tsx
// src/web/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../renderer/App';
import { initWebBackend } from './backend/api';

async function bootstrap() {
  const { api } = await initWebBackend();
  (window as any).electronAPI = api;

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW reg failed', e));
    });
  }
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed', e);
  document.body.innerText = 'Ошибка запуска Qard. Обновите страницу.';
});
```

- [ ] **Step 4: Проверка типов**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/web/index.tsx src/web/index.html src/renderer/global.d.ts
git commit -m "feat: web entry point installs window.electronAPI before render"
```

---

## Phase 6: Webpack web-сборка и интеграция

### Task 6.1: webpack.web.config.js

**Files:**
- Create: `webpack.web.config.js`
- Modify: `package.json` (скрипты)

- [ ] **Step 1: Создать web-конфиг**

```js
// webpack.web.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/web/index.tsx',
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/web'),
    filename: 'app.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(woff2?|ttf|eot)$/, type: 'asset/resource', generator: { filename: 'fonts/[name][ext]' } },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    fallback: { fs: false, path: false, crypto: false },
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/web/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
        { from: 'src/web/manifest.webmanifest', to: 'manifest.webmanifest' },
      ],
    }),
    new webpack.DefinePlugin({
      __AI_PROXY_URL__: JSON.stringify(process.env.AI_PROXY_URL || 'http://localhost:8787'),
    }),
  ],
  devServer: {
    static: path.resolve(__dirname, 'dist/web'),
    port: 8080,
    historyApiFallback: true,
  },
};
```

- [ ] **Step 2: Добавить скрипты в package.json**

```json
"dev:web": "webpack serve --config webpack.web.config.js --mode development",
"build:web": "webpack --config webpack.web.config.js --mode production",
"worker:dev": "cd worker && wrangler dev",
"worker:deploy": "cd worker && wrangler deploy"
```
Установить webpack-dev-server: `npm install -D webpack-dev-server`.

- [ ] **Step 3: Собрать web**

Run: `npm run build:web`
Expected: `compiled successfully`, в `dist/web/` есть `index.html`, `app.*.js`, `sql-wasm.wasm`, `manifest.webmanifest`.

- [ ] **Step 4: Commit**

```bash
git add webpack.web.config.js package.json package-lock.json
git commit -m "feat: webpack web build target"
```

### Task 6.2: Запустить в браузере и починить TTS/媒体-интеграцию

**Files:**
- Modify (при необходимости): `src/renderer/components/Review/Review.tsx`, `src/renderer/components/Preview/CardPreview.tsx`

- [ ] **Step 1: Запустить dev-сервер web + Worker и проверить базовый поток**

Run (два терминала):
```bash
npm run worker:dev
npm run dev:web
```
Открыть `http://localhost:8080`. Ожидаемо: грузится UI, видны магнит-колоды A1/A2/B1.

- [ ] **Step 2: Прогнать критерии готовности вручную**

Проверить по чеклисту:
1. Создать колоду → появляется в списке.
2. Вставить список слов → нажать генерацию → карточки сгенерированы (через Worker; нужен ProxyAPI-ключ в Настройках).
3. Перезагрузить страницу (F5) → данные на месте (IndexedDB).
4. Зайти в review → ответить на карточки (type-in, FSRS-интервалы показываются).
5. Нажать произношение → слышен голос (Web Speech).
6. Статистика/streak обновляется.

- [ ] **Step 3: Починить воспроизведение звука, если нужно**

Найти использование `tts.generateAudio` в `Review.tsx`/`CardPreview.tsx`. Если код создаёт `Audio` из ArrayBuffer и при пустом буфере ничего не играет — добавить ветку:
```ts
const buf = await window.electronAPI.tts.generateAudio(text);
if (buf.byteLength === 0) {
  // web: звук уже воспроизведён Web Speech API
  return;
}
// ...существующая логика проигрывания mp3 для desktop
```

- [ ] **Step 4: Прогнать все юнит-тесты и обе сборки**

Run: `npx vitest run && npm run build && npm run build:web`
Expected: всё PASS/compiled.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: web app runs in browser (TTS/audio integration)"
```

---

## Phase 7: PWA (manifest + service worker)

### Task 7.1: Manifest

**Files:**
- Create: `src/web/manifest.webmanifest`

- [ ] **Step 1: Создать манифест**

```json
{
  "name": "Qard — учи английские слова",
  "short_name": "Qard",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2D323E",
  "theme_color": "#2D323E",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Сгенерировать иконки из `assets/icon.png` (192 и 512)**

Положить `icon-192.png`, `icon-512.png` в `src/web/icons/` и добавить копирование в `CopyWebpackPlugin` (`{ from: 'src/web/icons', to: 'icons' }`).
Run: `npm run build:web` → проверить `dist/web/icons/`.

- [ ] **Step 3: Commit**

```bash
git add src/web/manifest.webmanifest src/web/icons webpack.web.config.js
git commit -m "feat: PWA manifest + icons"
```

### Task 7.2: Service worker (Workbox)

**Files:**
- Modify: `webpack.web.config.js` (InjectManifest или GenerateSW)
- Create: `src/web/sw.ts` (если InjectManifest)

- [ ] **Step 1: Подключить Workbox GenerateSW (проще для precache статики + WASM)**

В `webpack.web.config.js` добавить:
```js
const { GenerateSW } = require('workbox-webpack-plugin');
// ...в plugins (только для production):
...(process.env.NODE_ENV === 'production'
  ? [new GenerateSW({
      swDest: 'sw.js',
      clientsClaim: true,
      skipWaiting: true,
      // .wasm и шрифты — в precache; запросы к Worker не кешируем
      include: [/\.(js|css|html|wasm|woff2?)$/],
      navigateFallback: '/index.html',
    })]
  : []),
```

- [ ] **Step 2: Собрать production и проверить SW**

Run: `NODE_ENV=production npm run build:web`
Expected: в `dist/web/` появился `sw.js`. (В Windows PowerShell: `$env:NODE_ENV='production'; npm run build:web`.)

- [ ] **Step 3: Проверить установку PWA вручную**

Раздать `dist/web` статикой (`npx serve dist/web`), открыть в Chrome → DevTools → Application → Manifest/Service Workers: манифест валиден, SW зарегистрирован, доступна установка («Install app»). Офлайн-режим: после загрузки выключить сеть → приложение открывается, локальные колоды доступны (генерация требует сети — ожидаемо).

- [ ] **Step 4: Commit**

```bash
git add webpack.web.config.js src/web/sw.ts 2>/dev/null
git commit -m "feat: PWA service worker (offline precache)"
```

---

## Phase 8: UI бэкапа и деплой

### Task 8.1: Кнопки экспорт/импорт бэкапа в настройках

**Files:**
- Modify: `src/renderer/components/Settings/Settings.tsx`

- [ ] **Step 1: Добавить секцию бэкапа (рендерится только если `window.electronAPI.backup` есть)**

Вставить в Settings.tsx (следуя существующей разметке секций):
```tsx
{window.electronAPI.backup && (
  <div className="settings-section">
    <h3>Резервная копия</h3>
    <button className="key-button" onClick={() => window.electronAPI.backup!.export()}>
      Экспорт базы
    </button>
    <label className="key-button">
      Импорт базы
      <input
        type="file"
        accept=".qard,application/octet-stream"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await window.electronAPI.backup!.import(f);
          location.reload();
        }}
      />
    </label>
  </div>
)}
```
(Классы подогнать под реальные в Settings.tsx — проверить файл и использовать существующие.)

- [ ] **Step 2: Прогнать сборки**

Run: `npm run build && npm run build:web`
Expected: обе compiled (desktop не показывает кнопки — `backup` отсутствует в Electron API).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Settings/Settings.tsx
git commit -m "feat: backup export/import UI in settings (web-only)"
```

### Task 8.2: Деплой Worker + Cloudflare Pages

**Files:** —

> **Нужно от Данька:** аккаунт Cloudflare (бесплатный). Шаги 1, 3 требуют его авторизации.

- [ ] **Step 1: Задеплоить Worker**

Run:
```bash
cd worker
npx wrangler login   # откроется браузер — авторизация Данька
npx wrangler deploy
```
Expected: Worker опубликован, выдан URL вида `https://qard-ai-proxy.<account>.workers.dev`. Записать URL.

- [ ] **Step 2: Обновить ALLOWED_ORIGINS и пересобрать web с прод-URL**

- В `worker/src/index.ts` добавить прод-домен Pages в `ALLOWED_ORIGINS` (после шага 3 узнаем точный) и `wrangler deploy` повторно.
- Собрать web с боевым адресом Worker:
```bash
# PowerShell:
$env:AI_PROXY_URL='https://qard-ai-proxy.<account>.workers.dev'; $env:NODE_ENV='production'; npm run build:web
```

- [ ] **Step 3: Задеплоить статику на Cloudflare Pages**

Вариант A (CLI):
```bash
npx wrangler pages deploy dist/web --project-name qard
```
Expected: выдан URL `https://qard.pages.dev`. Проверить, что сайт открывается, генерация работает (CORS Worker пропускает `qard.pages.dev`).

- [ ] **Step 4: Финальная сквозная проверка на проде**

Открыть `https://qard.pages.dev` в инкогнито: магнит-колоды видны → создать колоду → сгенерировать карточки (ключ ProxyAPI) → review → произношение → F5 (данные на месте) → установить как PWA → экспорт/импорт бэкапа.

- [ ] **Step 5: Commit финального состояния конфигов**

```bash
git add worker/src/index.ts
git commit -m "chore: production origins for cloudflare worker"
```

---

## Критерии готовности v1 (Definition of Done)

Открыл `qard.pages.dev` → создал колоду → вставил список слов → AI сгенерил карточки (через Worker) → прошёл review (type-in, FSRS) → данные пережили перезагрузку (IndexedDB) → услышал произношение (Web Speech) → установил как PWA → выгрузил/загрузил бэкап. Desktop-сборка (`npm run build` + `npm run package`) продолжает работать без изменений.

## Отложено в фазу 2 (НЕ в этом плане)

- Anki-импорт через `.apkg`-парсинг (сейчас `importer` в web возвращает пустые заглушки).
- Хранение медиа-аудио (импортированные mp3) в IndexedDB.
- ElevenLabs/премиум-голоса, синк, подписки, домен `qard.app`.
