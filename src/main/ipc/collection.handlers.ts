import { IpcMain } from 'electron';
import {
  AudioUpload,
  CardSearchQuery,
  CardTextUpdate,
  IPC_CHANNELS,
  NewCardInput
} from '../../shared/types';
import { CollectionService } from '../services/collection.service';
import { MediaService } from '../services/media.service';

export function setupCollectionHandlers(
  ipcMain: IpcMain,
  col: CollectionService,
  media: MediaService
): void {
  ipcMain.handle(IPC_CHANNELS.DECK_LIST, () => col.listDecks(Date.now()));
  ipcMain.handle(IPC_CHANNELS.DECK_CREATE, (_e, name: string) =>
    col.createDeck(name)
  );
  ipcMain.handle(IPC_CHANNELS.DECK_RENAME, (_e, id: number, name: string) =>
    col.renameDeck(id, name)
  );
  ipcMain.handle(IPC_CHANNELS.DECK_DELETE, async (_e, id: number) => {
    const orphans = col.deleteDeck(id);
    await media.remove(orphans);
  });
  ipcMain.handle(
    IPC_CHANNELS.DECK_UPDATE_LIMITS,
    (_e, id: number, newPerDay: number, reviewsPerDay: number) =>
      col.updateDeckLimits(id, newPerDay, reviewsPerDay)
  );

  ipcMain.handle(
    IPC_CHANNELS.CARD_ADD,
    async (_e, deckId: number, cards: NewCardInput[], audio: AudioUpload[]) => {
      for (const a of audio) {
        await media.save(a.filename, a.data);
      }
      return col.addCards(deckId, cards, Date.now());
    }
  );
  ipcMain.handle(IPC_CHANNELS.CARD_UPDATE, (_e, update: CardTextUpdate) =>
    col.updateCardText(update)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_DELETE, async (_e, ids: number[]) => {
    const orphans = col.deleteCards(ids);
    await media.remove(orphans);
  });
  ipcMain.handle(IPC_CHANNELS.CARD_MOVE, (_e, ids: number[], deckId: number) =>
    col.moveCards(ids, deckId)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_SEARCH, (_e, query: CardSearchQuery) =>
    col.searchCards(query)
  );
  ipcMain.handle(IPC_CHANNELS.CARD_GET, (_e, id: number) => col.getCard(id));
  ipcMain.handle(IPC_CHANNELS.CARD_LIST_WORDS, (_e, deckId: number) =>
    col.listWords(deckId)
  );

  ipcMain.handle(IPC_CHANNELS.MEDIA_GET_AUDIO, (_e, filename: string) =>
    media.getBase64(filename)
  );
}
