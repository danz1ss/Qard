import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { ttsService } from '../services/tts.service';

export function setupTTSHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.TTS_GENERATE_AUDIO,
    async (_, text: string) => {
      try {
        const audioBuffer = await ttsService.generateAudio(text);

        // Convert Buffer to ArrayBuffer for renderer process
        return audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        );
      } catch (error: any) {
        console.error('TTS audio generation error:', error);
        throw new Error(error.message || 'Failed to generate audio');
      }
    }
  );
}
