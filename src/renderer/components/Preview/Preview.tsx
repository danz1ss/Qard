import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { useSaveToCollection } from '../../hooks/useSaveToCollection';
import Button from '../common/Button';
import Select from '../common/Select';
import Input from '../common/Input';
import CardPreview from './CardPreview';
import './Preview.css';

const Preview: React.FC = () => {
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
  const [newDeckName, setNewDeckName] = useState('');
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

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    const deck = await window.electronAPI.collection.createDeck(
      newDeckName.trim()
    );
    await refreshDecks();
    setNewDeckName('');
    setCreatingDeck(false);
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
        return 'Сохранение...';
      case 'success':
        return `Сохранено ${savedCount} карточек!`;
      case 'error':
        return 'Ошибка — повторить';
      default:
        return 'Сохранить в колоду';
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
    { value: '', label: 'Выбери колоду...' },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];

  return (
    <div className="preview">
      <h2>Просмотр и сохранение</h2>
      <p className="description">
        Проверь сгенерированные карточки и сохрани их в колоду.
      </p>

      {generatedCards.length === 0 ? (
        <div className="empty-state">
          <p>Карточек пока нет. Сгенерируй их на вкладке Generate.</p>
        </div>
      ) : (
        <>
          <div className="preview-summary">
            <span className="card-count">
              {generatedCards.length} карточек
              {duplicateCount > 0 && (
                <span className="duplicate-count">
                  {' '}· {duplicateCount} уже в колоде
                </span>
              )}
            </span>
            <Select
              value={targetDeckId !== null ? String(targetDeckId) : ''}
              onChange={(e) => handleDeckChange(e.target.value)}
              options={deckOptions}
            />
            <Button
              onClick={() => setCreatingDeck(!creatingDeck)}
              variant="secondary"
              size="small"
            >
              + Новая колода
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

          {creatingDeck && (
            <div className="preview-summary">
              <Input
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="Название новой колоды"
              />
              <Button onClick={handleCreateDeck} size="small">
                Создать
              </Button>
            </div>
          )}

          {duplicateCount > 0 && (
            <label className="duplicate-toggle">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
              />
              {' '}Сохранить дубликаты тоже ({duplicateCount})
            </label>
          )}

          {error && <div className="adding-error">Ошибка: {error}</div>}

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
                      <span className="card-badge duplicate">Уже в колоде</span>
                    )}
                    {card.error && (
                      <span className="card-badge error">Ошибка</span>
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
                      Убрать
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
    </div>
  );
};

export default Preview;
