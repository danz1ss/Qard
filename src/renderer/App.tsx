import React, { useState } from 'react';
import Settings from './components/Settings/Settings';
import WordInput from './components/WordInput/WordInput';
import Generation from './components/Generation/Generation';
import Preview from './components/Preview/Preview';
import Decks from './components/Decks/Decks';
import './App.css';

type Tab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('decks');

  return (
    <div className="app">
      <header className="app-header">
        <h1>AnkiGenerator</h1>
        <p>Automatic Anki flashcard generation</p>
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

        {activeTab === 'browse' && <div className="tab-content" />}

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
