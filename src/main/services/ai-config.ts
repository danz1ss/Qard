import { AI_PROVIDERS, DEFAULT_AI_PROVIDER } from '../../shared/types';
import { settingsService } from './settings.service';
import { geminiService } from './gemini.service';

/**
 * Reads provider/model/baseURL from settings and (re)configures the AI client.
 * No-op if the API key is not set yet.
 */
export async function applyAIConfig(): Promise<void> {
  const apiKey = await settingsService.get('geminiApiKey');
  if (!apiKey) {
    return;
  }

  const providerId =
    (await settingsService.get('aiProvider')) || DEFAULT_AI_PROVIDER;
  const model = (await settingsService.get('aiModel')) || '';
  const customBaseUrl = (await settingsService.get('aiBaseUrl')) || '';

  const preset = AI_PROVIDERS.find((p) => p.id === providerId);
  const baseURL =
    providerId === 'custom' ? customBaseUrl : preset?.baseURL || '';
  const finalModel = model || preset?.defaultModel || 'gpt-4o-mini';

  geminiService.configure({ apiKey, baseURL, model: finalModel });
}
