import { AppSettings } from '../../shared/types';

const KEY = 'qard-settings';

interface SettingsSchema {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  defaultDeckId?: number;
  exampleCount: number;
  dailyGoal: number;
  fieldMapping: Record<string, string>;
}

const defaults: SettingsSchema = {
  aiProvider: 'proxyapi',
  aiModel: 'gpt-4o-mini',
  exampleCount: 3,
  dailyGoal: 30,
  fieldMapping: {},
};

function read(): SettingsSchema {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function write(s: SettingsSchema): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const webSettings = {
  async get(key: string): Promise<any> {
    return (read() as any)[key];
  },
  async set(key: string, value: any): Promise<void> {
    const s = read();
    (s as any)[key] = value;
    write(s);
  },
  async getAll(): Promise<Partial<AppSettings>> {
    const s = read();
    return {
      geminiApiKey: s.geminiApiKey,
      aiProvider: s.aiProvider ?? 'proxyapi',
      aiModel: s.aiModel ?? 'gpt-4o-mini',
      aiBaseUrl: s.aiBaseUrl,
      defaultDeckId: s.defaultDeckId,
      exampleCount: s.exampleCount ?? 3,
      dailyGoal: s.dailyGoal ?? 30,
      fieldMapping: s.fieldMapping ?? {},
    };
  },
};
