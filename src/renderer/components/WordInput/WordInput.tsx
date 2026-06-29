import React, { useRef, useState } from 'react';
import { useStore } from '../../store';
import { useT } from '../../prefs/PreferencesProvider';
import Button from '../common/Button';
import { XIcon } from '../common/icons';
import './WordInput.css';

// Split raw text into a clean word list (newlines, commas, semicolons)
const parseText = (text: string): string[] =>
  text
    .split(/[\n,;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

const WordInput: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const { words, setWords } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const handleParse = () => {
    setWords(parseText(inputText));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const combined = inputText ? `${inputText}\n${text}` : text;
      setInputText(combined);
      setWords(parseText(combined));
    };
    reader.onerror = () => {
      console.error('Failed to read file:', reader.error);
    };
    reader.readAsText(file);

    // Reset so selecting the same file again still triggers onChange
    e.target.value = '';
  };

  const handleClear = () => {
    setInputText('');
    setWords([]);
  };

  return (
    <div className="word-input">
      <h2>{t('input.title')}</h2>
      <p className="description">
        {t('input.description')}
      </p>

      <div className="form-group">
        <label htmlFor="word-textarea">{t('input.wordList')}</label>
        <textarea
          id="word-textarea"
          className="word-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('input.placeholder')}
          rows={12}
        />
      </div>

      <div className="button-group">
        <Button onClick={handleParse}>{t('input.parse')}</Button>
        <Button onClick={handleImportClick} variant="secondary">
          {t('input.importFile')}
        </Button>
        <Button onClick={handleClear} variant="secondary">
          {t('input.clear')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {words.length > 0 && (
        <div className="word-list">
          <h3>{t('input.parsedWords').replace('{n}', String(words.length))}</h3>
          <div className="word-chips">
            {words.map((word, index) => (
              <span key={index} className="word-chip">
                {word}
                <button
                  className="remove-word"
                  aria-label={t('input.remove').replace('{w}', word)}
                  onClick={() => {
                    const newWords = words.filter((_, i) => i !== index);
                    setWords(newWords);
                  }}
                >
                  <XIcon size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordInput;
