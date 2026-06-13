import {
  AudioUpload,
  BatchWordResult,
  AppSettings,
  CardSearchQuery,
  CardSearchResult,
  CardTextUpdate,
  Deck,
  DeckWithCounts,
  ImportDeckChoice,
  ImportProgress,
  ImportResult,
  IntervalPreviews,
  NewCardInput,
  ParsedWord,
  ReviewQueueState,
  ReviewRating,
  StoredCard
} from '../shared/types';

export interface ElectronAPI {
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  ai: {
    generateBatch: (parsedWords: ParsedWord[], examplesCount: number) => Promise<BatchWordResult[]>;
  };
  tts: {
    generateAudio: (text: string) => Promise<ArrayBuffer>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<Partial<AppSettings>>;
  };
  collection: {
    listDecks: () => Promise<DeckWithCounts[]>;
    createDeck: (name: string) => Promise<Deck>;
    renameDeck: (id: number, name: string) => Promise<void>;
    deleteDeck: (id: number) => Promise<void>;
    updateDeckLimits: (id: number, newPerDay: number, reviewsPerDay: number) => Promise<void>;
    addCards: (deckId: number, cards: NewCardInput[], audio: AudioUpload[]) => Promise<number[]>;
    updateCard: (update: CardTextUpdate) => Promise<void>;
    deleteCards: (ids: number[]) => Promise<void>;
    moveCards: (ids: number[], deckId: number) => Promise<void>;
    searchCards: (query: CardSearchQuery) => Promise<CardSearchResult>;
    getCard: (id: number) => Promise<StoredCard | null>;
    listWords: (deckId: number) => Promise<string[]>;
  };
  review: {
    getQueue: (deckId: number) => Promise<ReviewQueueState>;
    answer: (cardId: number, rating: ReviewRating) => Promise<ReviewQueueState>;
    previewIntervals: (cardId: number) => Promise<IntervalPreviews>;
  };
  media: {
    getAudio: (filename: string) => Promise<string | null>;
  };
  importer: {
    getAnkiDecks: () => Promise<ImportDeckChoice[]>;
    run: (deckNames: string[]) => Promise<ImportResult>;
    onProgress: (cb: (p: ImportProgress) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
