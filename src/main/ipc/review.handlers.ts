import { IpcMain } from 'electron';
import { IPC_CHANNELS, ReviewRating } from '../../shared/types';
import { SchedulerService } from '../services/scheduler.service';

export function setupReviewHandlers(
  ipcMain: IpcMain,
  scheduler: SchedulerService
): void {
  ipcMain.handle(IPC_CHANNELS.REVIEW_GET_QUEUE, (_e, deckId: number) =>
    scheduler.getQueue(deckId)
  );
  ipcMain.handle(
    IPC_CHANNELS.REVIEW_ANSWER,
    (_e, cardId: number, rating: ReviewRating) =>
      scheduler.answer(cardId, rating)
  );
  ipcMain.handle(IPC_CHANNELS.REVIEW_PREVIEW_INTERVALS, (_e, cardId: number) =>
    scheduler.previewIntervals(cardId)
  );
}
