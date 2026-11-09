import Store from 'electron-store';
import { DEFAULT_PROXY_MODEL, AppSettings, DataSource, LearnerLevel } from '../../shared/types';

interface SettingsSchema {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  defaultDeckId?: number;
  exampleCount: number;
  dailyGoal: number;
  learnerLevel: LearnerLevel;
  fieldMapping: { [key: string]: DataSource };
}

const defaultSettings: SettingsSchema = {
  aiProvider: 'proxyapi',
  aiModel: DEFAULT_PROXY_MODEL,
  exampleCount: 3,
  dailyGoal: 20,
  learnerLevel: 'A1',
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
      aiModel: this.store.get('aiModel', DEFAULT_PROXY_MODEL),
      aiBaseUrl: this.store.get('aiBaseUrl'),
      defaultDeckId: this.store.get('defaultDeckId'),
      exampleCount: this.store.get('exampleCount', 3),
      dailyGoal: this.store.get('dailyGoal', 20),
      learnerLevel: this.store.get('learnerLevel', 'A1'),
      fieldMapping: this.store.get('fieldMapping', {})
    };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const settingsService = new SettingsService();
