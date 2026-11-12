import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useSaveToCollection } from '../../hooks/useSaveToCollection';
import Button from '../common/Button';
import Select from '../common/Select';
import CreateDeckModal from '../common/CreateDeckModal';
import CardPreview from './CardPreview';
import { useT } from '../../prefs/PreferencesProvider';
import { CardMeaning, GeneratedCard, StoredCard } from '../../../shared/types';
import { normalizeWord, planCardSave } from '../../../shared/utils/meanings';
import './Preview.css';

const Preview: React.FC = () => {
  const t = useT();
  const {
    generatedCards,
    setGeneratedCards,
    removeGeneratedCard,
    decks,
    refreshDecks,
    defaultDeckId,
    setDefaultDeckId
  } = useStore();
  const { saveAll, resetStatus, status, savedCount, error } =
    useSaveToCollection();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [targetDeckId, setTargetDeckId] = useState<number | null>(defaultDeckId);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [matchResult, setMatchResult] = useState<{ key: string; cards: StoredCard[] }>();
  const [lookupFailed, setLookupFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<{ text: string; failed: boolean }>();

  const isSaving = status === 'saving';
  const busy = isSaving || merging;
  const wordsKey = JSON.stringify([...new Set(generatedCards.filter(card => !card.error).map(card => normalizeWord(card.word)))]);
  const lookupKey = `${targetDeckId}:${revision}:${wordsKey}`;
  const matches = matchResult?.key === lookupKey ? matchResult.cards : undefined;
  const drafts = generatedCards.map(card => ({ card, plan: matches && !card.error ? planCardSave(card, matches) : undefined }));
  const duplicateCount = drafts.filter(({ plan }) => plan?.kind === 'duplicate').length;
  const newCards = drafts.filter(({ plan }) => plan?.kind === 'new').map(({ card }) => card);

  useEffect(() => {
    refreshDecks();
  }, []);

  useEffect(() => {
    if (targetDeckId === null) return;
    let active = true;
    setLookupFailed(false);
    window.electronAPI.collection.searchCards({ deckId: targetDeckId, words: JSON.parse(wordsKey), limit: -1, offset: 0 })
      .then(({ cards }) => { if (active) setMatchResult({ key: lookupKey, cards }); })
      .catch(() => { if (active) setLookupFailed(true); });
    return () => { active = false; };
  }, [targetDeckId, lookupKey, wordsKey]);

  const handleDeckChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    setTargetDeckId(id);
    setDefaultDeckId(id);
    setMergeMessage(undefined);
  };

  // Создаёт колоду и сразу выбирает её целевой (бросает ошибку — модалка покажет её).
  const createDeck = async (name: string) => {
    const deck = await window.electronAPI.collection.createDeck(name);
    await refreshDecks();
    setTargetDeckId(deck.id);
    setDefaultDeckId(deck.id);
  };

  const handleSave = async () => {
    if (targetDeckId === null || busy || !newCards.length) return;
    if (await saveAll(targetDeckId, newCards)) setRevision(value => value + 1);
  };

  const appendMeaning = async (card: GeneratedCard, target: StoredCard, meaning: CardMeaning) => {
    if (targetDeckId === null || busy) return;
    setMerging(true);
    setMergeMessage(undefined);
    try {
      const added = await window.electronAPI.collection.appendMeaning(targetDeckId, target.id, card.word, meaning);
      setMergeMessage({ text: t(added ? 'preview.meaningAdded' : 'preview.meaningChanged'), failed: !added });
    } catch {
      setMergeMessage({ text: t('preview.meaningSaveError'), failed: true });
    } finally {
      setRevision(value => value + 1);
      setMerging(false);
    }
  };

  const toggleSecondaryMeaning = (card: GeneratedCard) => {
    setGeneratedCards(generatedCards.map(draft => draft.id === card.id
      ? { ...draft, includeSecondaryMeaning: !draft.includeSecondaryMeaning }
      : draft));
  };

  const handleRemoveCard = (id: string) => {
    removeGeneratedCard(id);
    if (expandedCard === id) {
      setExpandedCard(null);
    }
  };

  const handleToggleCard = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const getButtonText = () => {
    switch (status) {
      case 'saving':
        return t('preview.saving');
      case 'success':
        return t('preview.saved').replace('{n}', String(savedCount));
      case 'error':
        return t('preview.errorRetry');
      default:
        return t('preview.saveToDeck');
    }
  };

  const getButtonVariant = (): 'primary' | 'success' | 'danger' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const deckOptions = [
    { value: '', label: t('preview.selectDeck') },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];

  return (
    <div className="preview">
      <h2>{t('preview.title')}</h2>
      <p className="description">
        {t('preview.description')}
      </p>

      {generatedCards.length === 0 ? (
        <div className="empty-state">
          <p>{t('preview.empty')}</p>
        </div>
      ) : (
        <>
          <div className="preview-summary">
            <span className="card-count">
              {t('preview.cardCount').replace('{n}', String(generatedCards.length))}
              {duplicateCount > 0 && (
                <span className="duplicate-count">
                  {' '}{t('preview.duplicates').replace('{n}', String(duplicateCount))}
                </span>
              )}
            </span>
            <Select
              value={targetDeckId !== null ? String(targetDeckId) : ''}
              onChange={(v) => handleDeckChange(v)}
              options={deckOptions}
              disabled={busy}
            />
            <Button
              onClick={() => setCreatingDeck(true)}
              variant="secondary"
              size="small"
              disabled={busy}
            >
              {t('preview.newDeck')}
            </Button>
            <Button
              onClick={status === 'error' ? resetStatus : handleSave}
              disabled={busy || (status !== 'error' && !newCards.length)}
              variant={getButtonVariant()}
              size="large"
            >
              {getButtonText()}
            </Button>
          </div>

          {error && <div className="adding-error">{t('preview.error').replace('{msg}', error)}</div>}
          {mergeMessage && <p role={mergeMessage.failed ? 'alert' : 'status'}>{mergeMessage.text}</p>}
          {lookupFailed && (
            <p role="alert">{t('preview.meaningLookupError')}{' '}
              <Button size="small" variant="secondary" onClick={() => setRevision(value => value + 1)}>{t('preview.errorRetry')}</Button>
            </p>
          )}

          <div className="card-list">
            {drafts.map(({ card, plan }) => (
              <div key={card.id} className="card-item">
                <div className="card-header">
                  <button type="button" className="card-title" aria-expanded={expandedCard === card.id} onClick={() => handleToggleCard(card.id)}>
                    <span className="card-word">{card.word}</span>
                    {card.transcription && (
                      <span className="card-transcription">{card.transcription}</span>
                    )}
                    {card.secondaryMeaning && (
                      <span className="card-badge meaning-count">{t('preview.twoMeanings')}</span>
                    )}
                    {plan?.kind === 'duplicate' && (
                      <span className="card-badge duplicate">{t('preview.alreadyInDeck')}</span>
                    )}
                    {plan?.kind === 'full' && <span className="card-badge">{t('preview.meaningFull')}</span>}
                    {card.error && (
                      <span className="card-badge error">{t('preview.errorBadge')}</span>
                    )}
                    <span className="expand-icon" aria-hidden="true">{expandedCard === card.id ? '▼' : '▶'}</span>
                  </button>
                  <div className="card-actions">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCard(card.id);
                      }}
                      variant="danger"
                      size="small"
                      disabled={busy}
                    >
                      {t('preview.remove')}
                    </Button>
                  </div>
                </div>

                {card.secondaryMeaning && (targetDeckId === null || plan?.kind === 'new') && (
                  <div className="meaning-actions">
                    <Button type="button" size="small"
                      variant={card.includeSecondaryMeaning ? 'secondary' : 'primary'}
                      disabled={busy} onClick={() => toggleSecondaryMeaning(card)}>
                      {t(card.includeSecondaryMeaning ? 'preview.excludeSecondary' : 'preview.includeSecondary')}
                    </Button>
                  </div>
                )}

                {plan?.kind === 'merge' && (
                  <div className="meaning-actions">
                    <p>{t('preview.meaningMergeInto').replace('{meaning}', plan.target.translation || plan.target.word)}</p>
                    {plan.novel.map((meaning, index) => (
                      <Button key={index} type="button" size="small" disabled={busy}
                        onClick={() => void appendMeaning(card, plan.target, meaning)}>
                        {t('preview.meaningAdd').replace('{meaning}', meaning.translation || meaning.definition)}
                      </Button>
                    ))}
                  </div>
                )}

                {expandedCard === card.id && <CardPreview card={card} />}
              </div>
            ))}
          </div>
        </>
      )}

      {creatingDeck && (
        <CreateDeckModal
          onCreate={createDeck}
          onClose={() => setCreatingDeck(false)}
        />
      )}
    </div>
  );
};

export default Preview;
