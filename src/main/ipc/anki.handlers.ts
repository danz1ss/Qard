import { IpcMain } from 'electron';
import { IPC_CHANNELS, AnkiNote } from '../../shared/types';
import { ankiConnectService } from '../services/anki-connect.service';

export function setupAnkiHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.ANKI_CHECK_CONNECTION, async () => {
    try {
      return await ankiConnectService.checkConnection();
    } catch (error: any) {
      console.error('AnkiConnect check connection error:', error);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_GET_DECKS, async () => {
    try {
      return await ankiConnectService.getDeckNames();
    } catch (error: any) {
      console.error('AnkiConnect getDeckNames error:', error);
      throw new Error(error.message || 'Failed to get deck names');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_GET_MODELS, async () => {
    try {
      return await ankiConnectService.getModelNames();
    } catch (error: any) {
      console.error('AnkiConnect getModelNames error:', error);
      throw new Error(error.message || 'Failed to get model names');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_GET_MODEL_FIELDS, async (_, modelName: string) => {
    try {
      return await ankiConnectService.getModelFieldNames(modelName);
    } catch (error: any) {
      console.error('AnkiConnect getModelFieldNames error:', error);
      throw new Error(error.message || 'Failed to get model field names');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_STORE_MEDIA, async (_, filename: string, data: string) => {
    try {
      return await ankiConnectService.storeMediaFile(filename, data);
    } catch (error: any) {
      console.error('AnkiConnect storeMediaFile error:', error);
      throw new Error(error.message || 'Failed to store media file');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_ADD_NOTE, async (_, note: AnkiNote) => {
    try {
      return await ankiConnectService.addNote(note);
    } catch (error: any) {
      console.error('AnkiConnect addNote error:', error);
      throw new Error(error.message || 'Failed to add note');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_ADD_NOTES, async (_, notes: AnkiNote[]) => {
    try {
      return await ankiConnectService.addNotes(notes);
    } catch (error: any) {
      console.error('AnkiConnect addNotes error:', error);
      throw new Error(error.message || 'Failed to add notes');
    }
  });

  ipcMain.handle(IPC_CHANNELS.ANKI_FIND_NOTES, async (_, query: string) => {
    try {
      return await ankiConnectService.findNotes(query);
    } catch (error: any) {
      console.error('AnkiConnect findNotes error:', error);
      return [];
    }
  });
}
