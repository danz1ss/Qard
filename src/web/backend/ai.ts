import { BatchWordResult, ParsedWord } from '../../shared/types';
import { buildBatchPrompt, parseBatchResponse, buildMnemonicPrompt } from '../../shared/ai-prompts';
import { webSettings } from './settings';

// URL Worker'а задаётся при сборке (DefinePlugin) либо дефолт для dev.
declare const __AI_PROXY_URL__: string;
const PROXY_URL =
  typeof __AI_PROXY_URL__ !== 'undefined' ? __AI_PROXY_URL__ : 'http://localhost:8787';

async function chat(prompt: string, temperature: number): Promise<string> {
  const apiKey = await webSettings.get('geminiApiKey');
  if (!apiKey) {
    throw new Error('API key not set. Please configure API key in settings.');
  }
  const model = (await webSettings.get('aiModel')) || 'gpt-4o-mini';
  const resp = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature }),
  });
  if (!resp.ok) {
    throw new Error(`AI request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export const webAI = {
  async generateBatch(parsedWords: ParsedWord[], examplesCount: number): Promise<BatchWordResult[]> {
    const text = await chat(buildBatchPrompt(parsedWords, examplesCount), 0.7);
    return parseBatchResponse(text);
  },
  async mnemonic(word: string, definition: string, wordType: string): Promise<string> {
    const text = await chat(buildMnemonicPrompt(word, definition, wordType), 0.9);
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Empty response from AI');
    return trimmed;
  },
};
