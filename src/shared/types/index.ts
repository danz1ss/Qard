// Re-export word parser types
export { ParsedWord, PartOfSpeech } from '../utils/wordParser';

// Core data types

export interface GeneratedCard {
  id: string;
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription?: string;
  examples: string[];
  exampleType?: string;
  audioFilename?: string;
  audioData?: Buffer;
  isDuplicate?: boolean;
  error?: string;
}

export interface Example {
  sentence: string;
}

export enum DataSource {
  Word = 'Word',
  WordType = 'Word Type',
  Definition = 'Definition',
  DefinitionExample = 'Definition Example',
  Transcription = 'Transcription',
  Examples = 'Example(s)',
  WordAudio = 'Word Audio',
  ExampleType = 'Example Type',
  None = 'None'
}

export interface FieldMapping {
  [ankiFieldName: string]: DataSource;
}

// Settings types

export interface AppSettings {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  defaultDeckId?: number;
  exampleCount: number;
  dailyGoal?: number;
  fieldMapping: FieldMapping;
}

// AI provider presets (all OpenAI-compatible, used via the openai SDK)

export interface AIProviderPreset {
  id: string;
  label: string;
  baseURL: string;
  defaultModel: string;
  models: string[];
}

export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    id: 'proxyapi',
    label: 'ProxyAPI',
    baseURL: 'https://api.proxyapi.ru/openai/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-sonnet',
      'deepseek/deepseek-chat',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat'],
  },
  {
    id: 'gemini',
    label: 'Gemini (OpenAI-compatible)',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseURL: '',
    defaultModel: '',
    models: [],
  },
];

export const DEFAULT_AI_PROVIDER = 'proxyapi';

// API response types

export interface WordMeaningResponse {
  wordType: string;
  definition: string;
  definitionExample: string;
  exampleType: string;
  examples: string[];
  transcription: string;
}

export interface BatchWordResult {
  word: string;
  meanings: WordMeaningResponse[];
}

// Generation progress types

export enum GenerationStage {
  Idle = 'Idle',
  Definition = 'Definition',
  Examples = 'Examples',
  Audio = 'Audio',
  Complete = 'Complete',
  Error = 'Error'
}

export interface GenerationProgress {
  currentWord: string;
  currentStage: GenerationStage;
  completedCards: number;
  totalCards: number;
  error?: string;
}

// ===== Local collection types =====

export interface Deck {
  id: number;
  name: string;
  newPerDay: number;
  reviewsPerDay: number;
  createdAt: number;
}

export interface DeckWithCounts extends Deck {
  newCount: number;
  learnCount: number;
  dueCount: number;
  totalCards: number;
}

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3
}

export interface StoredCard {
  id: number;
  deckId: number;
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  audioFilename: string | null;
  tags: string;
  createdAt: number;
  state: CardState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface NewCardInput {
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  audioFilename?: string | null;
  tags?: string;
}

export interface CardTextUpdate {
  id: number;
  word: string;
  wordType: string;
  definition: string;
  definitionExample: string;
  transcription: string;
  examples: string[];
  tags: string;
}

export type CardStatusFilter = 'new' | 'learning' | 'review';

export interface CardSearchQuery {
  text?: string;
  deckId?: number;
  status?: CardStatusFilter;
  tag?: string;
  limit: number;
  offset: number;
}

export interface CardSearchResult {
  total: number;
  cards: StoredCard[];
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

export interface ReviewQueueState {
  current: StoredCard | null;
  newCount: number;
  learnCount: number;
  dueCount: number;
}

export interface IntervalPreviews {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

// ===== Study stats (streak / daily goal / activity) =====

export interface DailyCount {
  /** Локальная полночь дня (мс). */
  dayStart: number;
  /** Сколько повторов сделано в этот день. */
  count: number;
}

export interface StudyStats {
  /** Дней подряд с ≥1 повтором, оканчивая сегодня (или вчера, если сегодня ещё не учил). */
  streakDays: number;
  /** Повторов сделано сегодня. */
  studiedToday: number;
  /** Повторов за всё время. */
  reviewedTotal: number;
  /** Активность за последние 7 дней (старый → новый, последний элемент = сегодня). */
  last7Days: DailyCount[];
}

export interface AudioUpload {
  filename: string;
  data: string; // base64
}

export interface ImportDeckChoice {
  name: string;
  noteCount: number;
}

export interface ImportProgress {
  deck: string;
  done: number;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  finished: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

// IPC channel names

export const IPC_CHANNELS = {
  // AI (ProxyAPI)
  AI_GENERATE_BATCH: 'ai:generateBatch',

  // TTS
  TTS_GENERATE_AUDIO: 'tts:generateAudio',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',

  // Local collection
  DECK_LIST: 'deck:list',
  DECK_CREATE: 'deck:create',
  DECK_RENAME: 'deck:rename',
  DECK_DELETE: 'deck:delete',
  DECK_UPDATE_LIMITS: 'deck:updateLimits',
  CARD_ADD: 'card:add',
  CARD_UPDATE: 'card:update',
  CARD_DELETE: 'card:delete',
  CARD_MOVE: 'card:move',
  CARD_SEARCH: 'card:search',
  CARD_GET: 'card:get',
  CARD_LIST_WORDS: 'card:listWords',
  REVIEW_GET_QUEUE: 'review:getQueue',
  REVIEW_ANSWER: 'review:answer',
  REVIEW_PREVIEW_INTERVALS: 'review:previewIntervals',
  STATS_GET: 'stats:get',
  MEDIA_GET_AUDIO: 'media:getAudio',
  IMPORT_GET_ANKI_DECKS: 'import:getAnkiDecks',
  IMPORT_RUN: 'import:run',
  IMPORT_PROGRESS: 'import:progress'
} as const;
