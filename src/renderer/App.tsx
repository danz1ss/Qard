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

const LogoMark = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
    <rect x="6.5" y="4.5" width="15" height="20" rx="4" fill="#3f5e96"
      transform="rotate(-9 14 14.5)" />
    <rect x="9" y="6" width="16" height="21" rx="4.5"
      fill="url(#lg)" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
    <path d="M17 12.5l1.4 3.1 3.4.4-2.5 2.3.7 3.3-3-1.7-3 1.7.7-3.3-2.5-2.3 3.4-.4 1.4-3.1z"
      fill="#16233b" />
    <defs>
      <linearGradient id="lg" x1="9" y1="6" x2="25" y2="27" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9cbcf6" />
        <stop offset="1" stopColor="#6f9ce8" />
      </linearGradient>
    </defs>
  </svg>
);

type Tab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('decks');

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><LogoMark /></span>
          <div className="brand-text">
            <h1>AnkiGenerator</h1>
            <p>Automatic Anki flashcard generation</p>
          </div>
        </div>
      </header>

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

      <main className="app-content">
        {activeTab === 'decks' && (
          <div className="tab-content">
            <Decks />
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
