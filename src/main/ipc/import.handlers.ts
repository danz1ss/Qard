import { IpcMain } from 'electron';
import { FieldMapping, IPC_CHANNELS } from '../../shared/types';
import { ankiConnectService } from '../services/anki-connect.service';
import { ImportService } from '../services/import.service';
import { settingsService } from '../services/settings.service';

export function setupImportHandlers(
  ipcMain: IpcMain,
  importService: ImportService
): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT_GET_ANKI_DECKS, async () => {
    const connected = await ankiConnectService.checkConnection();
    if (!connected) {
      throw new Error(
        'Anki не запущен или аддон AnkiConnect не установлен. Запусти Anki и попробуй снова.'
      );
    }
    return importService.getAnkiDecks();
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_RUN, async (event, deckNames: string[]) => {
    const fieldMapping =
      ((await settingsService.get('fieldMapping')) as FieldMapping) || {};
    return importService.run(deckNames, fieldMapping, (p) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.IMPORT_PROGRESS, p);
      }
    });
  });
}
