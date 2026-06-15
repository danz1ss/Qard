import { IpcMain } from 'electron';
import { IPC_CHANNELS, ParsedWord } from '../../shared/types';
import { geminiService } from '../services/gemini.service';
import { applyAIConfig } from '../services/ai-config';

export function setupGeminiHandlers(ipcMain: IpcMain): void {
  // Initialize AI client from settings on setup
  applyAIConfig().catch(console.error);

  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_BATCH, async (_, parsedWords: ParsedWord[], examplesCount: number) => {
    try {
      // Re-apply config in case provider/model/key changed
      await applyAIConfig();
      return await geminiService.generateWordMeaningsBatch(parsedWords, examplesCount);
    } catch (error: any) {
      console.error('AI batch generation error:', error);
      throw new Error(error.message || 'Failed to generate word meanings');
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.AI_MNEMONIC,
    async (_, word: string, definition: string, wordType: string) => {
      try {
        await applyAIConfig();
        return await geminiService.generateMnemonic(word, definition, wordType);
      } catch (error: any) {
        console.error('AI mnemonic error:', error);
        throw new Error(error.message || 'Failed to generate mnemonic');
      }
    }
  );
}
