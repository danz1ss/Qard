import Store from 'electron-store';
import { AppSettings, DataSource } from '../../shared/types';

interface SettingsSchema {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  selectedDeck?: string;
  selectedModel?: string;
  exampleCount: number;
  fieldMapping: { [key: string]: DataSource };
}

const defaultSettings: SettingsSchema = {
  aiProvider: 'proxyapi',
  aiModel: 'gpt-4o-mini',
  exampleCount: 3,
  fieldMapping: {}
};

class SettingsService {
  private store: Store<SettingsSchema>;

  constructor() {
    this.store = new Store<SettingsSchema>({
      name: 'anki-generator-settings',
      defaults: defaultSettings
    });
  }

  async get(key: keyof SettingsSchema): Promise<any> {
    return this.store.get(key);
  }

  async set(key: keyof SettingsSchema, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async getAll(): Promise<Partial<AppSettings>> {
    return {
      geminiApiKey: this.store.get('geminiApiKey'),
      aiProvider: this.store.get('aiProvider', 'proxyapi'),
      aiModel: this.store.get('aiModel', 'gpt-4o-mini'),
      aiBaseUrl: this.store.get('aiBaseUrl'),
      selectedDeck: this.store.get('selectedDeck'),
      selectedModel: this.store.get('selectedModel'),
      exampleCount: this.store.get('exampleCount', 3),
      fieldMapping: this.store.get('fieldMapping', {})
    };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const settingsService = new SettingsService();
