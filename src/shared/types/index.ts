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
  selectedDeck?: string;
  selectedModel?: string;
  exampleCount: number;
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

// Anki types

export interface AnkiDeck {
  name: string;
}

export interface AnkiModel {
  name: string;
  fields: string[];
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: { [key: string]: string };
  audio?: {
    filename: string;
    data: string; // base64
  }[];
  tags?: string[];
}

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

// IPC channel names

export const IPC_CHANNELS = {
  // AnkiConnect
  ANKI_GET_DECKS: 'anki:getDecks',
  ANKI_GET_MODELS: 'anki:getModels',
  ANKI_GET_MODEL_FIELDS: 'anki:getModelFields',
  ANKI_STORE_MEDIA: 'anki:storeMedia',
  ANKI_ADD_NOTE: 'anki:addNote',
  ANKI_ADD_NOTES: 'anki:addNotes',
  ANKI_FIND_NOTES: 'anki:findNotes',
  ANKI_CHECK_CONNECTION: 'anki:checkConnection',

  // AI (ProxyAPI)
  AI_GENERATE_BATCH: 'ai:generateBatch',

  // TTS
  TTS_GENERATE_AUDIO: 'tts:generateAudio',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll'
} as const;
