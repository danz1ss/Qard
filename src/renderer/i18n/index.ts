import { Lang, Dict } from './types';
import { en } from './en';
import { ru } from './ru';

const dicts: Record<Lang, Dict> = { en, ru };

export type TFunc = (key: string) => string;

export function makeT(lang: Lang): TFunc {
  const dict = dicts[lang];
  return (key: string) => dict[key] ?? key;
}

export type { Lang, Dict };
