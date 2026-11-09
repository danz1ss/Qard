import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, DEFAULT_PROXY_MODEL } from '../../shared/types';
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
  const selectedModel = model || preset?.defaultModel || DEFAULT_PROXY_MODEL;
  const finalModel = providerId === 'proxyapi' && /^gpt-/.test(selectedModel)
    ? 'openai/' + selectedModel
    : selectedModel;

  geminiService.configure({ apiKey, baseURL, model: finalModel });
}
