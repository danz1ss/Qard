import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DeckWithCounts } from '../../../shared/types';
import Review from '../Review/Review';
import ImportModal from './ImportModal';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './Decks.css';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M7 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);

const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 6h14M5 12h14M5 18h14" />
    <circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="8" cy="18" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ImportIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 19h14" />
  </svg>
);

const Decks: React.FC = () => {
  const { decks, refreshDecks } = useStore();
  const [newDeckName, setNewDeckName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<DeckWithCounts | null>(null);
  const [limitNew, setLimitNew] = useState('20');
  const [limitRev, setLimitRev] = useState('200');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [studyingDeck, setStudyingDeck] = useState<DeckWithCounts | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    refreshDecks();
  }, [refreshDecks]);

  const handleCreate = async () => {
    if (!newDeckName.trim()) return;
    setError(null);
    try {
      await window.electronAPI.collection.createDeck(newDeckName.trim());
      setNewDeckName('');
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startRename = (deck: DeckWithCounts) => {
    setRenamingId(deck.id);
    setRenameValue(deck.name);
  };

  const confirmRename = async (deck: DeckWithCounts) => {
    if (!renameValue.trim()) return;
    setError(null);
    try {
      await window.electronAPI.collection.renameDeck(deck.id, renameValue.trim());
      setRenamingId(null);
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
  };

  const handleDelete = async (deck: DeckWithCounts) => {
    const ok = window.confirm(
      `Удалить колоду «${deck.name}» и все её карточки (${deck.totalCards} шт.)?`
    );
    if (!ok) return;
    setError(null);
    try {
      await window.electronAPI.collection.deleteDeck(deck.id);
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openLimits = (deck: DeckWithCounts) => {
    setEditingLimits(deck);
    setLimitNew(String(deck.newPerDay));
    setLimitRev(String(deck.reviewsPerDay));
  };

  const saveLimits = async () => {
    if (!editingLimits) return;
    setError(null);
    try {
      await window.electronAPI.collection.updateDeckLimits(
        editingLimits.id,
        Math.max(0, parseInt(limitNew) || 0),
        Math.max(0, parseInt(limitRev) || 0)
      );
      setEditingLimits(null);
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (studyingDeck) {
    return (
      <Review
        deckId={studyingDeck.id}
        deckName={studyingDeck.name}
        onExit={() => {
          setStudyingDeck(null);
          refreshDecks();
        }}
      />
    );
  }

  return (
    <div className="decks">
      <header className="decks-head">
        <h2 className="decks-title">Колоды</h2>
        <p className="decks-sub">
          Новые · Учатся · К повторению — нажми «Учить», чтобы начать сессию.
        </p>
      </header>

      {decks.length === 0 ? (
        <div className="decks-empty">
          <div className="decks-empty-glyph">∅</div>
          <p>Пока нет колод. Создай первую ниже или импортируй из Anki.</p>
        </div>
      ) : (
        <ul className="deck-list">
          {decks.map((deck, i) => (
            <li
              className="deck-card"
              key={deck.id}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
            >
              <div className="deck-card-info">
                {renamingId === deck.id ? (
                  <div className="deck-rename">
                    <input
                      className="deck-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(deck);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                    />
                    <button
                      className="icon-btn icon-confirm"
                      title="Сохранить"
                      onClick={() => confirmRename(deck)}
                    >
                      <CheckIcon />
                    </button>
                    <button
                      className="icon-btn"
                      title="Отмена"
                      onClick={cancelRename}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <button
                    className="deck-name"
                    title="Переименовать"
                    onClick={() => startRename(deck)}
                  >
                    {deck.name}
                  </button>
                )}

                <div className="deck-stats">
                  <div className="stat">
                    <span className="stat-num stat-new">{deck.newCount}</span>
                    <span className="stat-label">Новые</span>
                  </div>
                  <div className="stat">
                    <span className="stat-num stat-learn">{deck.learnCount}</span>
                    <span className="stat-label">Учатся</span>
                  </div>
                  <div className="stat">
                    <span className="stat-num stat-due">{deck.dueCount}</span>
                    <span className="stat-label">Повтор</span>
                  </div>
                  <div className="stat stat-total">
                    <span className="stat-num">{deck.totalCards}</span>
                    <span className="stat-label">Всего</span>
                  </div>
                </div>
              </div>

              <div className="deck-actions">
                <button
                  className="btn-learn"
                  onClick={() => setStudyingDeck(deck)}
                >
                  <PlayIcon />
                  <span>Учить</span>
                </button>
                <button
                  className="icon-btn"
                  title="Переименовать"
                  onClick={() => startRename(deck)}
                >
                  <PencilIcon />
                </button>
                <button
                  className="icon-btn"
                  title="Лимиты"
                  onClick={() => openLimits(deck)}
                >
                  <SlidersIcon />
                </button>
                <button
                  className="icon-btn icon-danger"
                  title="Удалить"
                  onClick={() => handleDelete(deck)}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingLimits && (
        <div className="limits-panel">
          <h3 className="limits-title">
            Лимиты <span>«{editingLimits.name}»</span>
          </h3>
          <div className="limits-row">
            <label className="limits-field">
              <span>Новых в день</span>
              <input
                value={limitNew}
                onChange={(e) => setLimitNew(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="limits-field">
              <span>Повторений в день</span>
              <input
                value={limitRev}
                onChange={(e) => setLimitRev(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="limits-actions">
              <button className="btn-pill btn-accent" onClick={saveLimits}>
                Сохранить
              </button>
              <button
                className="btn-pill btn-muted"
                onClick={() => setEditingLimits(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="decks-footer">
        <div className="deck-create">
          <input
            className="deck-create-input"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="Название новой колоды"
          />
          <button className="btn-pill btn-accent" onClick={handleCreate}>
            Создать
          </button>
        </div>
        <button className="btn-pill btn-import" onClick={() => setImporting(true)}>
          <ImportIcon />
          <span>Импорт из Anki</span>
        </button>
      </div>

      {error && <p className="decks-error">{error}</p>}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={() => refreshDecks()}
        />
      )}
    </div>
  );
};

export default Decks;
