import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { settingsService } from '../services/settings.service';
import { applyAIConfig } from '../services/ai-config';

const AI_KEYS = ['geminiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl'];

export function setupSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
    try {
      return await settingsService.get(key as any);
    } catch (error: any) {
      console.error('Settings get error:', error);
      throw new Error(error.message || 'Failed to get setting');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, key: string, value: any) => {
    try {
      await settingsService.set(key as any, value);

      // Re-configure the AI client when any provider-related setting changes
      if (AI_KEYS.includes(key)) {
        await applyAIConfig();
      }
    } catch (error: any) {
      console.error('Settings set error:', error);
      throw new Error(error.message || 'Failed to set setting');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    try {
      return await settingsService.getAll();
    } catch (error: any) {
      console.error('Settings getAll error:', error);
      throw new Error(error.message || 'Failed to get all settings');
    }
  });
}
