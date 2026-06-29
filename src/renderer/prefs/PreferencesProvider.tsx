import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadPref, savePref } from '../lib/prefs';
import { makeT, Lang, TFunc } from '../i18n';

type Theme = 'dark' | 'light';

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  t: TFunc;
}

const Ctx = createContext<Prefs | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => loadPref<Lang>('qard:lang', 'ru'));
  const [theme, setThemeState] = useState<Theme>(() => loadPref<Theme>('qard:theme', 'dark'));
  const [soundEnabled, setSoundState] = useState<boolean>(() => loadPref<boolean>('qard:sound', true));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setLang = (l: Lang) => { setLangState(l); savePref('qard:lang', l); };
  const setTheme = (t: Theme) => { setThemeState(t); savePref('qard:theme', t); };
  const setSoundEnabled = (v: boolean) => { setSoundState(v); savePref('qard:sound', v); };

  const t = useMemo(() => makeT(lang), [lang]);

  const value: Prefs = { lang, setLang, theme, setTheme, soundEnabled, setSoundEnabled, t };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function usePrefs(): Prefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrefs must be used within PreferencesProvider');
  return ctx;
}

// Удобный хук только для перевода
export function useT(): TFunc {
  return usePrefs().t;
}
