import React from 'react';
import { useStore } from '../../store';
import { useCardGeneration } from '../../hooks/useCardGeneration';
import Button from '../common/Button';
import { GenerationStage } from '../../../shared/types';
import './Generation.css';

const Generation: React.FC = () => {
  const {
    words,
    selectedDeck,
    selectedModel,
    fieldMapping,
    exampleCount,
    geminiApiKey,
    generationProgress,
    isGenerating
  } = useStore();

  const { startGeneration } = useCardGeneration();

  const canGenerate =
    words.length > 0 &&
    selectedDeck &&
    selectedModel &&
    Object.keys(fieldMapping).length > 0 &&
    geminiApiKey;

  const handleStartGeneration = () => {
    startGeneration();
  };

  const getStageText = (stage: GenerationStage): string => {
    switch (stage) {
      case GenerationStage.Definition:
        return 'Generating definition and word type...';
      case GenerationStage.Examples:
        return 'Generating example sentences...';
      case GenerationStage.Audio:
        return 'Generating audio pronunciation...';
      case GenerationStage.Complete:
        return 'Completed!';
      case GenerationStage.Error:
        return 'Error occurred';
      default:
        return 'Ready to start';
    }
  };

  const progressPercentage =
    generationProgress.totalCards > 0
      ? (generationProgress.completedCards / generationProgress.totalCards) * 100
      : 0;

  return (
    <div className="generation">
      <h2>Generate Flashcards</h2>
      <p className="description">
        Start the card generation process. This will create translations, examples, and audio for each word.
      </p>

      {/* Settings Summary */}
      <div className="settings-summary">
        <h3>Current Settings</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Words:</span>
            <span className="summary-value">{words.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Deck:</span>
            <span className="summary-value">{selectedDeck || 'Not selected'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Model:</span>
            <span className="summary-value">{selectedModel || 'Not selected'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Examples per word:</span>
            <span className="summary-value">{exampleCount}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">ProxyAPI:</span>
            <span className="summary-value">{geminiApiKey ? '✓ Configured' : '✗ Not configured'}</span>
          </div>
        </div>
      </div>

      {/* Validation Messages */}
      {!canGenerate && (
        <div className="validation-errors">
          <h4>Please complete the following before generating:</h4>
          <ul>
            {words.length === 0 && <li>Add words in the Input tab</li>}
            {!selectedDeck && <li>Select a deck in the Setup tab</li>}
            {!selectedModel && <li>Select a note type in the Setup tab</li>}
            {Object.keys(fieldMapping).length === 0 && <li>Configure field mapping in the Setup tab</li>}
            {!geminiApiKey && <li>Enter ProxyAPI key in the Setup tab</li>}
          </ul>
        </div>
      )}

      {/* Generation Controls */}
      <div className="generation-controls">
        <Button
          onClick={handleStartGeneration}
          disabled={!canGenerate || isGenerating}
          size="large"
        >
          {isGenerating ? 'Generating...' : 'Start Generation'}
        </Button>
      </div>

      {/* Progress Display */}
      {isGenerating && (
        <div className="generation-progress">
          <h3>Generation Progress</h3>

          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="progress-info">
            <div className="progress-text">
              <strong>Current word:</strong> {generationProgress.currentWord}
            </div>
            <div className="progress-text">
              <strong>Stage:</strong> {getStageText(generationProgress.currentStage)}
            </div>
            <div className="progress-text">
              <strong>Completed:</strong> {generationProgress.completedCards} / {generationProgress.totalCards}
            </div>
          </div>

          {generationProgress.error && (
            <div className="progress-error">
              <strong>Error:</strong> {generationProgress.error}
            </div>
          )}
        </div>
      )}

      {/* Completion Message */}
      {!isGenerating && generationProgress.completedCards > 0 && (
        <div className="generation-complete">
          <h3>Generation Complete!</h3>
          <p>
            Successfully generated {generationProgress.completedCards} flashcards.
            Go to the Preview tab to review and add them to Anki.
          </p>
        </div>
      )}
    </div>
  );
};

export default Generation;
