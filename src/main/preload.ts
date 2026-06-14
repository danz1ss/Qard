import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ParsedWord } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  // AI APIs (ProxyAPI)
  ai: {
    generateBatch: (parsedWords: ParsedWord[], examplesCount: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_BATCH, parsedWords, examplesCount)
  },

  // TTS APIs
  tts: {
    generateAudio: (text: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TTS_GENERATE_AUDIO, text)
  },

  // Settings APIs
  settings: {
    get: (key: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL)
  },

  // Local collection APIs
  collection: {
    listDecks: () => ipcRenderer.invoke(IPC_CHANNELS.DECK_LIST),
    createDeck: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_CREATE, name),
    renameDeck: (id: number, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_RENAME, id, name),
    deleteDeck: (id: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_DELETE, id),
    updateDeckLimits: (id: number, newPerDay: number, reviewsPerDay: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.DECK_UPDATE_LIMITS, id, newPerDay, reviewsPerDay),
    addCards: (deckId: number, cards: any[], audio: any[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_ADD, deckId, cards, audio),
    updateCard: (update: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_UPDATE, update),
    deleteCards: (ids: number[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_DELETE, ids),
    moveCards: (ids: number[], deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_MOVE, ids, deckId),
    searchCards: (query: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_SEARCH, query),
    getCard: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CARD_GET, id),
    listWords: (deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.CARD_LIST_WORDS, deckId)
  },

  // Review APIs
  review: {
    getQueue: (deckId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_GET_QUEUE, deckId),
    answer: (cardId: number, rating: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_ANSWER, cardId, rating),
    previewIntervals: (cardId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.REVIEW_PREVIEW_INTERVALS, cardId)
  },

  // Media APIs
  media: {
    getAudio: (filename: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET_AUDIO, filename)
  },

  // Study stats APIs
  stats: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.STATS_GET)
  },

  // Import APIs
  importer: {
    getAnkiDecks: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_GET_ANKI_DECKS),
    run: (deckNames: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.IMPORT_RUN, deckNames),
    onProgress: (cb: (p: any) => void) => {
      const listener = (_e: any, p: any) => cb(p);
      ipcRenderer.on(IPC_CHANNELS.IMPORT_PROGRESS, listener);
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.IMPORT_PROGRESS, listener);
    }
  }
});
