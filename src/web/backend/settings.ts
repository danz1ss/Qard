import { AppSettings, FieldMapping } from '../../shared/types';

const KEY = 'qard-settings';

interface SettingsSchema {
  geminiApiKey?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  defaultDeckId?: number;
  exampleCount: number;
  dailyGoal: number;
  fieldMapping: FieldMapping;
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

// localStorage синхронен; методы async только чтобы совпадать с контрактом
// ElectronAPI (key: string — обязателен для совместимости с интерфейсом).
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
    // read() уже сливает дефолты, поэтому отдаём поля как есть —
    // единый источник дефолтов, без расхождения get vs getAll.
    const s = read();
    return {
      geminiApiKey: s.geminiApiKey,
      aiProvider: s.aiProvider,
      aiModel: s.aiModel,
      aiBaseUrl: s.aiBaseUrl,
      defaultDeckId: s.defaultDeckId,
      exampleCount: s.exampleCount,
      dailyGoal: s.dailyGoal,
      fieldMapping: s.fieldMapping,
    };
  },
};
