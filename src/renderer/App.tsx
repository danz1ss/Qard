import React, { useState } from 'react';
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
import ydnLogo from './assets/ydn-logo.png';
import HeaderControls from './components/common/HeaderControls';

const LogoMark = () => (
  <img src={ydnLogo} alt="YDN" className="brand-logo" width={30} height={35} />
);

type Tab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('decks');

  return (
    <div className="app">
      <header className="app-header">
        {/* Логотип-ссылка → главная вкладка Decks (п.8) */}
        <button
          type="button"
          className="brand"
          onClick={() => setActiveTab('decks')}
          title="Go to Decks"
        >
          <span className="brand-mark"><LogoMark /></span>
          <div className="brand-text">
            <h1>Qard</h1>
            <p>YDN education</p>
          </div>
        </button>

        <nav className="app-tabs">
        <button
          className={`tab ${activeTab === 'decks' ? 'active' : ''}`}
          onClick={() => setActiveTab('decks')}
        >
          Decks
        </button>
        <button
          className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse
        </button>
        <button
          className={`tab ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </button>
        <button
          className={`tab ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          Input
        </button>
        <button
          className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate
        </button>
        <button
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
        </nav>
        <HeaderControls />
      </header>

      <main className="app-content">
        {activeTab === 'decks' && (
          <div className="tab-content">
            <Decks onNavigate={setActiveTab} />
          </div>
        )}

        {activeTab === 'browse' && (
          <div className="tab-content">
            <Browser />
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="tab-content">
            <Settings />
          </div>
        )}

        {activeTab === 'input' && (
          <div className="tab-content">
            <WordInput />
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="tab-content">
            <Generation />
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
