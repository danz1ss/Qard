# Спека: встроенный функционал Anki (колоды, браузер карточек, SRS)

Дата: 2026-06-13
Статус: одобрено пользователем (устно в сессии)

## Цель

Превратить AnkiGenerator из генератора карточек «на экспорт» в самостоятельное
приложение для изучения: собственное хранилище колод и карточек, браузер с
поиском, экран изучения с алгоритмом интервальных повторений FSRS.
AnkiConnect-экспорт полностью убирается; AnkiConnect остаётся только для
разового импорта существующей коллекции.

## Принятые решения

| Вопрос | Решение |
|---|---|
| Хранилище | SQLite через **sql.js** (WASM, без нативной пересборки под Electron 28) |
| SRS-алгоритм | **FSRS** через библиотеку `ts-fsrs`, параметры по умолчанию |
| AnkiConnect | Полностью заменить; оставить только для разового импорта |
| Экран Review | Полноценный: 4 кнопки (Снова/Трудно/Хорошо/Легко), дневные лимиты |
| Импорт | Разовый импорт колод и нот из запущенного Anki через AnkiConnect |
| Поиск | Текстовый (LIKE) + фильтры: колода, статус, тег. Без Anki-синтаксиса |
| Колоды | Плоский список, без вложенности |
| Аудио | Хранится локально в `userData/media/`, проигрывается в Review |
| Шаблоны карточек | Не копируем системы note types/templates Anki. Фиксированная схема полей как в `GeneratedCard`; рендер как в `CardPreview` |

## Схема БД

Файл: `app.getPath('userData')/collection.db`. sql.js держит БД в памяти,
на диск пишем атомарно (tmp + rename) с дебаунсом ~1 с и принудительно при
закрытии приложения.

```sql
CREATE TABLE decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  new_per_day INTEGER NOT NULL DEFAULT 20,
  reviews_per_day INTEGER NOT NULL DEFAULT 200,
  created_at INTEGER NOT NULL          -- unix ms
);

CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  word_type TEXT NOT NULL DEFAULT '',
  definition TEXT NOT NULL DEFAULT '',
  definition_example TEXT NOT NULL DEFAULT '',
  transcription TEXT NOT NULL DEFAULT '',
  examples_json TEXT NOT NULL DEFAULT '[]',   -- string[]
  audio_filename TEXT,                        -- файл в userData/media/
  tags TEXT NOT NULL DEFAULT '',              -- через пробел, как в Anki
  created_at INTEGER NOT NULL,
  -- FSRS-состояние (поля Card из ts-fsrs)
  state INTEGER NOT NULL DEFAULT 0,           -- 0 New, 1 Learning, 2 Review, 3 Relearning
  due INTEGER NOT NULL,                       -- unix ms
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER                         -- unix ms, NULL для новых
);
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_cards_due ON cards(deck_id, state, due);
CREATE INDEX idx_cards_word ON cards(word);

CREATE TABLE review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,                    -- 1 Again, 2 Hard, 3 Good, 4 Easy
  state INTEGER NOT NULL,                     -- состояние ДО ответа
  due INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  elapsed_days INTEGER NOT NULL,
  scheduled_days INTEGER NOT NULL,
  reviewed_at INTEGER NOT NULL                -- unix ms
);
CREATE INDEX idx_log_card ON review_log(card_id);
CREATE INDEX idx_log_time ON review_log(reviewed_at);
```

Дневные счётчики (сколько новых взято / повторений сделано сегодня) не
хранятся отдельно — считаются запросом по `review_log` за «сегодня»
(локальная полночь).

## Main-процесс

Новые сервисы в `src/main/services/`:

### collection.service.ts
- Инициализация sql.js, загрузка/создание файла БД, миграция схемы
  (таблица `meta` с версией схемы), дебаунс-сохранение, сохранение при quit.
- CRUD колод: `listDecks()` (со счётчиками new/learn/due на сегодня),
  `createDeck(name)`, `renameDeck(id, name)`, `deleteDeck(id)` (с карточками),
  `updateDeckLimits(id, newPerDay, reviewsPerDay)`.
- CRUD карточек: `addCards(deckId, cards[])`, `updateCard(card)`,
  `deleteCards(ids)`, `moveCards(ids, deckId)`, `getCard(id)`.
- Поиск: `searchCards({ text?, deckId?, state?, tag?, limit, offset })` —
  LIKE по word/definition/definition_example/examples_json, фильтры точные.
  Возвращает `{ total, cards }`.

### scheduler.service.ts
Обёртка над `ts-fsrs` (генератор `fsrs()` с дефолтными параметрами,
`enable_fuzz: true`):
- `getQueue(deckId)` — очередь на сейчас: learning/relearning с `due <= now`,
  затем новые (не больше остатка дневного лимита), затем review с
  `due <= конец сегодняшнего дня` (не больше остатка лимита повторений).
  Возвращает счётчики и первую карточку.
- `previewIntervals(cardId)` — для 4 кнопок: человекочитаемые интервалы
  («<10 мин», «3 дн», «1.2 мес»).
- `answerCard(cardId, rating)` — применяет `fsrs.repeat()`, пишет новое
  состояние в `cards`, добавляет запись в `review_log`, возвращает следующую
  карточку очереди.

### media.service.ts
- `saveAudio(filename, base64)` → файл в `userData/media/`.
- `getAudioPath(filename)` / отдача аудио в renderer как data URL
  (без включения webSecurity-хака с file://).
- `deleteAudio(filename)` при удалении карточки (если на файл больше никто
  не ссылается).

### import.service.ts
Разовый импорт из запущенного Anki (использует существующий
`anki-connect.service`):
1. `deckNames` → пользователь видит список, выбирает колоды (или все).
2. Для каждой колоды: `findNotes('deck:"<имя>"')` → `notesInfo` батчами.
3. Маппинг полей ноты → наша схема через **обратный** `fieldMapping`,
   ранее сохранённый в настройках (Anki-поле → DataSource), по именам полей
   ноты. Поля, не попавшие в маппинг, игнорируются. Если у ноты нет ни
   одного замапленного поля (или fieldMapping пуст) — первое поле ноты →
   `word`, конкатенация остальных → `definition`.
4. Аудио: из значения поля, замапленного на WordAudio, извлекается
   `[sound:имя]`; файл забирается `retrieveMediaFile` и кладётся в media.
5. Все импортированные карточки создаются со state = New (прогресс изучения
   из Anki не переносится — решение пользователя).
6. Прогресс импорта стримится в renderer (канал событий), дубликаты в рамках
   импорта (одинаковый word + definition в одной колоде) пропускаются.

### Удаляется / меняется
- `anki.handlers.ts` (IPC AnkiConnect) — удаляется; вместо него три файла:
  `collection.handlers.ts` (deck:* + card:* + media:getAudio),
  `review.handlers.ts`, `import.handlers.ts`.
- `anki-connect.service.ts` — остаётся, используется только import.service.

## IPC-каналы (`IPC_CHANNELS`)

```
deck:list | deck:create | deck:rename | deck:delete | deck:updateLimits
card:add | card:update | card:delete | card:move | card:search | card:get
review:getQueue | review:answer | review:previewIntervals
media:getAudio
import:getAnkiDecks | import:run | import:progress (event)
```

Старые `ANKI_*` каналы удаляются. Preload и `global.d.ts` обновляются.

## Renderer

Вкладки: `Decks | Browse | Input | Generate | Preview | Setup`
(Decks — стартовая вместо Setup).

### Decks (`components/Decks/`)
- Таблица колод: имя, счётчики New / Learn / Due (цвета как в Anki:
  синий/красный/зелёный), кнопка «Учить».
- Создание (инпут + кнопка), переименование и удаление (с подтверждением,
  показываем число карточек), редактирование лимитов.
- Кнопка «Импорт из Anki» (модалка: проверка соединения, выбор колод,
  прогресс).

### Review (`components/Review/`)
- Открывается из Decks по «Учить»; занимает основную область, кнопка выхода.
- Фронт: word (+ word_type), кнопка проигрывания аудио (автоплей).
- «Показать ответ» (пробел) → бэк: definition, definition_example,
  transcription, examples — раскладка как в `CardPreview`.
- 4 кнопки с интервалами из `previewIntervals`, хоткеи 1–4.
- Шапка: остаток new/learn/due. Очередь пуста → «Поздравляем, на сегодня
  всё».

### Browse (`components/Browser/`)
- Строка поиска (дебаунс 300 мс) + фильтры: колода (select), статус
  (select: любая/new/learning/review), тег (инпут).
- Таблица: word, deck, state, due, кратко definition. Пагинация
  (limit/offset). Мультивыбор (чекбоксы) → удалить / переместить в колоду.
- Клик по строке → модалка редактирования всех текстовых полей + тегов.

### Generation / Preview
- `useAddToAnki` → `useSaveToCollection`: селект локальной колоды
  (+ «создать новую»), сохранение карточек через `card:add`, аудио — через
  media.service. Проверка дубликатов — по `word` в выбранной колоде
  (заменяет `markDuplicatesInDeck` с findNotes).

### Setup
- Удаляются: выбор Anki-колоды/модели и FieldMapper UI (FieldMapper
  зависит от выбранной Anki-модели, которой больше нет). Уже сохранённый
  `fieldMapping` в настройках не трогаем — его молча использует импорт.
  AI-настройки и TTS без изменений.
- `AppSettings`: `selectedDeck`/`selectedModel` (Anki) заменяются на
  `defaultDeckId` (локальная колода по умолчанию).

## Поток данных

```
Generate (AI) ──> Preview ──> card:add ──> collection.db
                                              │
Anki (разово) ──> import:run ─────────────────┤
                                              ▼
                    Decks ──> review:getQueue ──> Review ──> review:answer
                                              │                  │
                    Browse <── card:search ───┘   review_log <───┘
```

## Обработка ошибок

- БД не открылась/битая → диалог с предложением создать новую (старый файл
  переименовывается в `collection.db.bak-<дата>`).
- Импорт: Anki не запущен → понятное сообщение; ошибка на ноте → пропуск
  и счётчик ошибок в итоге, импорт не прерывается.
- Запись на диск упала → ретрай при следующем дебаунсе + сообщение в
  renderer.

## Тестирование

- Unit через **vitest** (добавляется в devDependencies, скрипт `npm test`):
  - scheduler: новая карточка → Good → Good → интервалы растут; Again →
    lapse/relearning; дневной лимит новых соблюдается; очередь пуста, когда
    всё сделано.
  - collection: CRUD, поиск по тексту/фильтрам, каскадное удаление.
  - import: маппинг полей (с fieldMapping и без), извлечение `[sound:...]`.
- Ручная проверка: `npm run build` без ошибок TypeScript, прогон сценария
  «создать колоду → сгенерировать → сохранить → учить → найти в Browse».

## Вне скоупа

- Вложенные колоды, Anki-синтаксис поиска, перенос прогресса изучения из
  Anki, синхронизация обратно в Anki, статистика/графики, кастомные шаблоны
  карточек, undo ответа в Review.
