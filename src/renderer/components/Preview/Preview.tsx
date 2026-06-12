import React, { useState } from 'react';
import { useStore } from '../../store';
import { useAddToAnki } from '../../hooks/useAddToAnki';
import Button from '../common/Button';
import CardPreview from './CardPreview';
import './Preview.css';

const Preview: React.FC = () => {
  const { generatedCards, removeGeneratedCard } = useStore();
  const { addAllToAnki, resetStatus, status, isAdding, addedCount, totalCount, error } = useAddToAnki();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const duplicateCount = generatedCards.filter((c) => c.isDuplicate).length;

  const handleRemoveCard = (id: string) => {
    removeGeneratedCard(id);
    if (expandedCard === id) {
      setExpandedCard(null);
    }
  };

  const handleToggleCard = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const handleAddAllToAnki = async () => {
    await addAllToAnki(generatedCards, includeDuplicates);
  };

  const getButtonText = () => {
    switch (status) {
      case 'adding':
        return `Adding ${addedCount}/${totalCount}...`;
      case 'success':
        return `Added ${totalCount} cards!`;
      case 'error':
        return 'Failed - Try Again';
      default:
        return 'Add All to Anki';
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

  return (
    <div className="preview">
      <h2>Preview & Add to Anki</h2>
      <p className="description">
        Review generated flashcards and add them to Anki.
      </p>

      {generatedCards.length === 0 ? (
        <div className="empty-state">
          <p>No cards generated yet. Go to the Generate tab to create flashcards.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="preview-summary">
            <span className="card-count">
              {generatedCards.length} card{generatedCards.length !== 1 ? 's' : ''} generated
              {duplicateCount > 0 && (
                <span className="duplicate-count">
                  {' '}· {duplicateCount} already in deck
                </span>
              )}
            </span>
            <Button
              onClick={status === 'error' ? resetStatus : handleAddAllToAnki}
              disabled={isAdding || generatedCards.length === 0}
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
              {' '}Add duplicates anyway ({duplicateCount})
            </label>
          )}

          {/* Progress/Error Messages */}
          {isAdding && (
            <div className="adding-progress">
              Adding cards to Anki: {addedCount} / {totalCount}
            </div>
          )}

          {status === 'success' && (
            <div className="adding-success">
              Successfully added {totalCount} cards to Anki!
            </div>
          )}

          {error && (
            <div className="adding-error">
              Error: {error}
            </div>
          )}

          {/* Card List */}
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
                      <span className="card-badge duplicate">Already in deck</span>
                    )}
                    {card.error && (
                      <span className="card-badge error">Error</span>
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
                      Remove
                    </Button>
                    <span className="expand-icon">
                      {expandedCard === card.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {expandedCard === card.id && (
                  <CardPreview card={card} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Preview;
