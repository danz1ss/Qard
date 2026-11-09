import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import { useT } from './prefs/PreferencesProvider';
import Placement from './components/Placement/Placement';
import Settings from './components/Settings/Settings';
import WordInput from './components/WordInput/WordInput';
import Generation from './components/Generation/Generation';
import Preview from './components/Preview/Preview';
import Decks from './components/Decks/Decks';
import Browser from './components/Browser/Browser';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import './App.css';
import qardMark from './assets/qard-mark.svg';
import HeaderControls from './components/common/HeaderControls';

const LogoMark = () => (
  <img src={qardMark} alt="" className="brand-logo" width={30} height={35} />
);

type Tab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview' | 'placement';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('decks');
  const [placementOrigin, setPlacementOrigin] = useState<'decks' | 'setup'>('decks');
  const openPlacement = (origin: 'decks' | 'setup') => {
    setPlacementOrigin(origin);
    setActiveTab('placement');
  };
  const wordCount = useStore((s) => s.words.length);
  const t = useT();

  // Мобильная лента вкладок: активная вкладка всегда в зоне видимости
  useEffect(() => {
    document
      .querySelector('.tab.active')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTab]);

  return (
    <div className="app">
      <header className="app-header">
        {/* Логотип-ссылка → главная вкладка Decks (п.8) */}
        <button
          type="button"
          className="brand"
          onClick={() => setActiveTab('decks')}
          title={t('brand.gotoDecks')}
        >
          <span className="brand-mark"><LogoMark /></span>
          <div className="brand-text">
            <h1>Qard</h1>
            <p>{t('brand.subtitle')}</p>
          </div>
        </button>

        <nav className="app-tabs">
        <button
          className={`tab ${activeTab === 'decks' ? 'active' : ''}`}
          onClick={() => setActiveTab('decks')}
        >
          {t('nav.decks')}
        </button>
        <button
          className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          {t('nav.browse')}
        </button>
        <button
          className={`tab ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          {t('nav.setup')}
        </button>
        <button
          className={`tab ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          {t('nav.input')}
        </button>
        <button
          className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          {t('nav.generate')}
          {wordCount > 0 && <span className="tab-badge">{wordCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          {t('nav.preview')}
        </button>
        </nav>
        <HeaderControls />
      </header>

      <main className="app-content">
        {activeTab === 'decks' && (
          <div className="tab-content">
            <Decks onNavigate={setActiveTab} onPlacement={() => openPlacement('decks')} />
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="tab-content">
            <Browser />
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="tab-content">
            <Settings onPlacement={() => openPlacement('setup')} />
          </div>
        )}

        {activeTab === 'placement' && (
          <Placement onExit={() => setActiveTab(placementOrigin)} onDecks={() => setActiveTab('decks')} />
        )}

        {activeTab === 'input' && (
          <div className="tab-content">
            <WordInput onNavigate={setActiveTab} />
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="tab-content">
            <Generation onNavigate={setActiveTab} />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="tab-content">
            <Preview />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
