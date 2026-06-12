import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ParsedWord } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  // AnkiConnect APIs
  anki: {
    getDecks: () => ipcRenderer.invoke(IPC_CHANNELS.ANKI_GET_DECKS),
    getModels: () => ipcRenderer.invoke(IPC_CHANNELS.ANKI_GET_MODELS),
    getModelFields: (modelName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_GET_MODEL_FIELDS, modelName),
    storeMedia: (filename: string, data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_STORE_MEDIA, filename, data),
    addNote: (note: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_ADD_NOTE, note),
    addNotes: (notes: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_ADD_NOTES, notes),
    findNotes: (query: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_FIND_NOTES, query),
    checkConnection: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ANKI_CHECK_CONNECTION)
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
  }
});
