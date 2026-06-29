import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useSaveToCollection } from '../../hooks/useSaveToCollection';
import Button from '../common/Button';
import Select from '../common/Select';
import CreateDeckModal from '../common/CreateDeckModal';
import CardPreview from './CardPreview';
import { useT } from '../../prefs/PreferencesProvider';
import './Preview.css';

const Preview: React.FC = () => {
  const t = useT();
  const {
    generatedCards,
    removeGeneratedCard,
    decks,
    refreshDecks,
    defaultDeckId,
    setDefaultDeckId
  } = useStore();
  const { saveAll, markDuplicates, resetStatus, status, savedCount, error } =
    useSaveToCollection();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState<number | null>(defaultDeckId);
  const [creatingDeck, setCreatingDeck] = useState(false);

  const duplicateCount = generatedCards.filter((c) => c.isDuplicate).length;
  const isSaving = status === 'saving';

  useEffect(() => {
    refreshDecks();
  }, []);

  // Дубликаты пересчитываются при смене целевой колоды
  useEffect(() => {
    if (targetDeckId !== null && generatedCards.length > 0) {
      markDuplicates(targetDeckId);
    }
  }, [targetDeckId, generatedCards.length]);

  const handleDeckChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    setTargetDeckId(id);
    setDefaultDeckId(id);
  };

  // Создаёт колоду и сразу выбирает её целевой (бросает ошибку — модалка покажет её).
  const createDeck = async (name: string) => {
    const deck = await window.electronAPI.collection.createDeck(name);
    await refreshDecks();
    setTargetDeckId(deck.id);
    setDefaultDeckId(deck.id);
  };

  const handleSave = async () => {
    if (targetDeckId === null) return;
    await saveAll(targetDeckId, includeDuplicates);
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
            />
            <Button
              onClick={() => setCreatingDeck(true)}
              variant="secondary"
              size="small"
            >
              {t('preview.newDeck')}
            </Button>
            <Button
              onClick={status === 'error' ? resetStatus : handleSave}
              disabled={isSaving || targetDeckId === null}
              variant={getButtonVariant()}
              size="large"
            >
              {getButtonText()}
            </Button>
          </div>

          {duplicateCount > 0 && (
            <label className="duplicate-toggle">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
              />
              {' '}{t('preview.saveDuplicates').replace('{n}', String(duplicateCount))}
            </label>
          )}

          {error && <div className="adding-error">{t('preview.error').replace('{msg}', error)}</div>}

          <div className="card-list">
            {generatedCards.map((card) => (
              <div key={card.id} className="card-item">
                <div className="card-header" onClick={() => handleToggleCard(card.id)}>
                  <div className="card-title">
                    <span className="card-word">{card.word}</span>
                    {card.transcription && (
                      <span className="card-transcription">{card.transcription}</span>
                    )}
                    {card.isDuplicate && (
                      <span className="card-badge duplicate">{t('preview.alreadyInDeck')}</span>
                    )}
                    {card.error && (
                      <span className="card-badge error">{t('preview.errorBadge')}</span>
                    )}
                  </div>
                  <div className="card-actions">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCard(card.id);
                      }}
                      variant="danger"
                      size="small"
                    >
                      {t('preview.remove')}
                    </Button>
                    <span className="expand-icon">
                      {expandedCard === card.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

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
