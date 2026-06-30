// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { webSettings } from '../settings';

describe('webSettings', () => {
  beforeEach(() => localStorage.clear());

  it('возвращает дефолты при пустом хранилище', async () => {
    expect(await webSettings.get('aiProvider')).toBe('proxyapi');
    expect(await webSettings.get('exampleCount')).toBe(3);
    expect(await webSettings.get('dailyGoal')).toBe(20);
  });

  it('сохраняет и читает значение', async () => {
    await webSettings.set('geminiApiKey', 'sk-test');
    expect(await webSettings.get('geminiApiKey')).toBe('sk-test');
  });

  it('getAll возвращает объект со всеми полями', async () => {
    await webSettings.set('dailyGoal', 50);
    const all = await webSettings.getAll();
    expect(all.dailyGoal).toBe(50);
    expect(all.aiProvider).toBe('proxyapi');
  });

  it('возвращает дефолты при битом JSON в хранилище', async () => {
    localStorage.setItem('qard-settings', 'invalid json {');
    expect(await webSettings.get('dailyGoal')).toBe(20);
    expect(await webSettings.get('aiProvider')).toBe('proxyapi');
  });
});
