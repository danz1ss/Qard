import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { DeckWithCounts } from '../../../shared/types';
import Review from '../Review/Review';
import ImportModal from './ImportModal';
import StudyHeader from './StudyHeader';
import ConfirmModal from '../common/ConfirmModal';
import CreateDeckModal from '../common/CreateDeckModal';
import { useT } from '../../prefs/PreferencesProvider';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './Decks.css';

type NavTab = 'decks' | 'browse' | 'setup' | 'input' | 'generate' | 'preview';

interface DecksProps {
  /** Переключение вкладок (для CTA пустого состояния). */
  onNavigate: (tab: NavTab) => void;
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M7 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
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

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"
    stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
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

const Decks: React.FC<DecksProps> = ({ onNavigate }) => {
  const t = useT();
  const { decks, refreshDecks, stats, refreshStats, dailyGoal, loadSettings } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<DeckWithCounts | null>(null);
  const [limitNew, setLimitNew] = useState('20');
  const [limitRev, setLimitRev] = useState('200');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [studyingDeck, setStudyingDeck] = useState<DeckWithCounts | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState<DeckWithCounts | null>(null);
  // Чтобы Escape отменял переименование, а не сохранял его через onBlur.
  const skipBlurRef = useRef(false);

  useEffect(() => {
    refreshDecks();
    refreshStats();
    loadSettings();
  }, [refreshDecks, refreshStats, loadSettings]);

  // Создание колоды (бросает ошибку — CreateDeckModal покажет её инлайн).
  const createDeck = async (name: string) => {
    await window.electronAPI.collection.createDeck(name);
    await refreshDecks();
  };

  const startRename = (deck: DeckWithCounts) => {
    setRenamingId(deck.id);
    setRenameValue(deck.name);
  };

  const confirmRename = async (deck: DeckWithCounts) => {
    if (renamingId !== deck.id) return;
    const next = renameValue.trim();
    if (!next || next === deck.name) {
      setRenamingId(null);
      return;
    }
    setError(null);
    try {
      await window.electronAPI.collection.renameDeck(deck.id, next);
      setRenamingId(null);
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelRename = () => {
    skipBlurRef.current = true;
    setRenamingId(null);
  };

  const confirmDelete = async () => {
    if (!deletingDeck) return;
    setError(null);
    try {
      await window.electronAPI.collection.deleteDeck(deletingDeck.id);
      setDeletingDeck(null);
      await refreshDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeletingDeck(null);
    }
  };

  // Поповер лимитов: повторный клик по той же шестерёнке — закрыть.
  const toggleLimits = (deck: DeckWithCounts) => {
    if (editingLimits?.id === deck.id) {
      setEditingLimits(null);
      return;
    }
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
          refreshStats();
        }}
      />
    );
  }

  // Суммарные счётчики для легенды-бейджей.
  const totals = decks.reduce(
    (acc, d) => ({
      newCount: acc.newCount + d.newCount,
      learnCount: acc.learnCount + d.learnCount,
      dueCount: acc.dueCount + d.dueCount
    }),
    { newCount: 0, learnCount: 0, dueCount: 0 }
  );

  return (
    <div className="decks">
      <header className="decks-head">
        <h2 className="decks-title">{t('decks.title')}</h2>
        <div className="decks-legend">
          <span className="legend-badge legend-new">
            <i className="legend-dot" /> {t('decks.legendNew').replace('{n}', String(totals.newCount))}
          </span>
          <span className="legend-badge legend-learn">
            <i className="legend-dot" /> {t('decks.legendLearning').replace('{n}', String(totals.learnCount))}
          </span>
          <span className="legend-badge legend-due">
            <i className="legend-dot" /> {t('decks.legendDue').replace('{n}', String(totals.dueCount))}
          </span>
          <span className="legend-hint">{t('decks.legendHint')}</span>
        </div>
      </header>

      {stats && (stats.reviewedTotal > 0 || stats.studiedToday > 0) && (
        <StudyHeader stats={stats} goal={dailyGoal} />
      )}

      {decks.length === 0 ? (
        /* ---------- Onboarding / Empty State (п.4) ---------- */
        <div className="decks-onboard">
          <div className="onboard-spark">✦</div>
          <h3 className="onboard-title">{t('decks.onboardTitle')}</h3>
          <p className="onboard-sub">
            {t('decks.onboardSub')}
          </p>
          <ol className="onboard-steps">
            <li>
              <span className="onboard-num">1</span>
              <div className="onboard-step-text">
                <strong>{t('decks.onboardStep1Title')}</strong>
                <span>{t('decks.onboardStep1Sub')}</span>
              </div>
              <button className="btn-pill btn-muted" onClick={() => onNavigate('setup')}>
                {t('nav.setup')}
              </button>
            </li>
            <li>
              <span className="onboard-num">2</span>
              <div className="onboard-step-text">
                <strong>{t('decks.onboardStep2Title')}</strong>
                <span>{t('decks.onboardStep2Sub')}</span>
              </div>
              <button className="btn-pill btn-muted" onClick={() => onNavigate('input')}>
                {t('nav.input')}
              </button>
            </li>
            <li>
              <span className="onboard-num">3</span>
              <div className="onboard-step-text">
                <strong>{t('decks.onboardStep3Title')}</strong>
                <span>{t('decks.onboardStep3Sub')}</span>
              </div>
              <button className="btn-pill btn-muted" onClick={() => onNavigate('generate')}>
                {t('nav.generate')}
              </button>
            </li>
          </ol>
          <div className="onboard-cta">
            <button className="btn-pill btn-accent" onClick={() => setCreating(true)}>
              <PlusIcon />
              <span>{t('decks.newDeck')}</span>
            </button>
            <button className="btn-pill btn-import" onClick={() => setImporting(true)}>
              <ImportIcon />
              <span>{t('decks.importAnki')}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- Sticky-тулбар: Create / Import (п.2) ---------- */}
          <div className="decks-toolbar">
            <button className="btn-pill btn-accent" onClick={() => setCreating(true)}>
              <PlusIcon />
              <span>{t('decks.newDeck')}</span>
            </button>
            <button className="btn-pill btn-import" onClick={() => setImporting(true)}>
              <ImportIcon />
              <span>{t('decks.importAnki')}</span>
            </button>
          </div>

          <ul className="deck-list">
            {decks.map((deck, i) => (
              <li
                className={`deck-card ${editingLimits?.id === deck.id ? 'has-popover' : ''}`}
                key={deck.id}
                style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
              >
                <div className="deck-card-info">
                  {renamingId === deck.id ? (
                    <input
                      className="deck-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (skipBlurRef.current) {
                          skipBlurRef.current = false;
                          return;
                        }
                        confirmRename(deck);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(deck);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                    />
                  ) : (
                    /* Инлайн-редактирование по клику (п.3) */
                    <button
                      className="deck-name"
                      title={t('decks.clickRename')}
                      onClick={() => startRename(deck)}
                    >
                      {deck.name}
                    </button>
                  )}

                  <div className="deck-stats">
                    <div className="stat">
                      <span className="stat-num stat-new">{deck.newCount}</span>
                      <span className="stat-label">{t('decks.statNew')}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-num stat-learn">{deck.learnCount}</span>
                      <span className="stat-label">{t('decks.statLearning')}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-num stat-due">{deck.dueCount}</span>
                      <span className="stat-label">{t('decks.statDue')}</span>
                    </div>
                    <div className="stat stat-total">
                      <span className="stat-num">{deck.totalCards}</span>
                      <span className="stat-label">{t('decks.statTotal')}</span>
                    </div>
                  </div>
                </div>

                <div className="deck-actions">
                  <button className="btn-learn" onClick={() => setStudyingDeck(deck)}>
                    <PlayIcon />
                    <span>{t('decks.study')}</span>
                  </button>
                  <button
                    className={`icon-btn ${editingLimits?.id === deck.id ? 'is-active' : ''}`}
                    title={t('decks.dailyLimits')}
                    onClick={() => toggleLimits(deck)}
                  >
                    <SlidersIcon />
                  </button>
                  <button
                    className="icon-btn icon-danger"
                    title={t('modal.delete')}
                    onClick={() => setDeletingDeck(deck)}
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* ---------- Поповер лимитов под шестерёнкой (п.1) ---------- */}
                {editingLimits?.id === deck.id && (
                  <div className="deck-popover">
                    <h4 className="popover-title">{t('decks.dailyLimits')}</h4>
                    <div className="popover-fields">
                      <label className="popover-field">
                        <span>{t('decks.newPerDay')}</span>
                        <input
                          value={limitNew}
                          onChange={(e) => setLimitNew(e.target.value)}
                          inputMode="numeric"
                          autoFocus
                        />
                      </label>
                      <label className="popover-field">
                        <span>{t('decks.reviewsPerDay')}</span>
                        <input
                          value={limitRev}
                          onChange={(e) => setLimitRev(e.target.value)}
                          inputMode="numeric"
                        />
                      </label>
                    </div>
                    <div className="popover-actions">
                      <button className="btn-pill btn-muted" onClick={() => setEditingLimits(null)}>
                        {t('modal.cancel')}
                      </button>
                      <button className="btn-pill btn-accent" onClick={saveLimits}>
                        {t('modal.save')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Backdrop поповера на уровне .decks (вне transform'а карточки) */}
      {editingLimits && (
        <div className="popover-backdrop" onClick={() => setEditingLimits(null)} />
      )}

      {error && <p className="decks-error">{error}</p>}

      {creating && (
        <CreateDeckModal onCreate={createDeck} onClose={() => setCreating(false)} />
      )}

      {deletingDeck && (
        <ConfirmModal
          title={t('decks.deleteDeckTitle')}
          message={
            <>
              {t('decks.deleteDeckMsgPre')}<strong>”{deletingDeck.name}”</strong>{t('decks.deleteDeckMsgPost').replace('{n}', String(deletingDeck.totalCards))}
            </>
          }
          confirmLabel={t('modal.delete')}
          onConfirm={confirmDelete}
          onClose={() => setDeletingDeck(null)}
        />
      )}

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
