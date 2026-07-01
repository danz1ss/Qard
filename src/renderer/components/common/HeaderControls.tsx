import React from 'react';
import { usePrefs } from '../../prefs/PreferencesProvider';
import './HeaderControls.css';

const HeaderControls: React.FC = () => {
  const { lang, setLang, theme, setTheme, soundEnabled, setSoundEnabled, t } = usePrefs();

  return (
    <div className="header-controls">
      <button
        type="button"
        className="hc-btn"
        title={t('ctrl.theme')}
        aria-label={t('ctrl.theme')}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>

      <div className="hc-lang" role="group" aria-label={t('ctrl.language')}>
        <span className={`hc-lang-indicator ${lang === 'en' ? 'is-second' : ''}`} aria-hidden="true" />
        <button
          type="button"
          className={`hc-lang-opt ${lang === 'ru' ? 'is-active' : ''}`}
          onClick={() => setLang('ru')}
        >
          RU
        </button>
        <button
          type="button"
          className={`hc-lang-opt ${lang === 'en' ? 'is-active' : ''}`}
          onClick={() => setLang('en')}
        >
          EN
        </button>
      </div>

      <button
        type="button"
        className="hc-btn"
        title={t('ctrl.sound')}
        aria-label={t('ctrl.sound')}
        aria-pressed={soundEnabled}
        onClick={() => setSoundEnabled(!soundEnabled)}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  );
};

export default HeaderControls;
