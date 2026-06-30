import React from 'react';
import { useStore } from '../../store';
import { useCardGeneration } from '../../hooks/useCardGeneration';
import { useT } from '../../prefs/PreferencesProvider';
import Button from '../common/Button';
import { CheckIcon, XIcon } from '../common/icons';
import { GenerationStage } from '../../../shared/types';
import './Generation.css';

const Generation: React.FC = () => {
  const {
    words,
    exampleCount,
    geminiApiKey,
    generationProgress,
    isGenerating
  } = useStore();

  const { startGeneration } = useCardGeneration();
  const t = useT();

  const WORD_LIMIT = 30;
  const overLimit = __IS_WEB__ && words.length > WORD_LIMIT;
  const canGenerate =
    words.length > 0 &&
    !overLimit &&
    (__IS_WEB__ || !!geminiApiKey);

  const handleStartGeneration = () => {
    startGeneration();
  };

  const getStageText = (stage: GenerationStage): string => {
    switch (stage) {
      case GenerationStage.Definition:
        return t('gen.stageDefinition');
      case GenerationStage.Examples:
        return t('gen.stageExamples');
      case GenerationStage.Audio:
        return t('gen.stageAudio');
      case GenerationStage.Complete:
        return t('gen.stageComplete');
      case GenerationStage.Error:
        return t('gen.stageError');
      default:
        return t('gen.stageReady');
    }
  };

  const progressPercentage =
    generationProgress.totalCards > 0
      ? (generationProgress.completedCards / generationProgress.totalCards) * 100
      : 0;

  return (
    <div className="generation">
      <h2>{t('gen.title')}</h2>
      <p className="description">
        {t('gen.description')}
      </p>

      {/* Settings Summary */}
      <div className="settings-summary">
        <h3>{t('gen.currentSettings')}</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">{t('gen.words')}</span>
            <span className="summary-value">{words.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t('gen.examplesPerWord')}</span>
            <span className="summary-value">{exampleCount}</span>
          </div>
          {!__IS_WEB__ && (
            <div className="summary-item">
              <span className="summary-label">{t('gen.apiKey')}</span>
              <span className={`summary-value ${geminiApiKey ? 'is-ok' : 'is-missing'}`}>
                {geminiApiKey ? (
                  <><CheckIcon size={15} /> {t('gen.configured')}</>
                ) : (
                  <><XIcon size={15} /> {t('gen.notConfigured')}</>
                )}
              </span>
            </div>
          )}
          {__IS_WEB__ && (
            <div className="summary-item">
              <span className="summary-label">{t('gen.wordCount')}</span>
              <span className={`summary-value ${overLimit ? 'is-missing' : 'is-ok'}`}>
                {words.length} / {WORD_LIMIT}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Validation Messages */}
      {!canGenerate && (
        <div className="validation-errors">
          <h4>{t('gen.validationHeading')}</h4>
          <ul>
            {words.length === 0 && <li>{t('gen.addWords')}</li>}
            {!__IS_WEB__ && !geminiApiKey && <li>{t('gen.enterKey')}</li>}
            {overLimit && <li>{t('gen.tooManyWords').replace('{n}', String(WORD_LIMIT))}</li>}
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
          {isGenerating ? t('gen.generating') : t('gen.startGeneration')}
        </Button>
      </div>

      {/* Progress Display */}
      {isGenerating && (
        <div className="generation-progress">
          <h3>{t('gen.progress')}</h3>

          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="progress-info">
            <div className="progress-text">
              <strong>{t('gen.currentWord')}</strong> {generationProgress.currentWord}
            </div>
            <div className="progress-text">
              <strong>{t('gen.stage')}</strong> {getStageText(generationProgress.currentStage)}
            </div>
            <div className="progress-text">
              <strong>{t('gen.completed')}</strong> {generationProgress.completedCards} / {generationProgress.totalCards}
            </div>
          </div>

          {generationProgress.error && (
            <div className="progress-error">
              <strong>{t('gen.error')}</strong>{' '}
              {generationProgress.error === 'DAILY_LIMIT'
                ? t('gen.dailyLimitReached')
                : generationProgress.error}
            </div>
          )}
        </div>
      )}

      {/* Completion Message */}
      {!isGenerating && generationProgress.completedCards > 0 && (
        <div className="generation-complete">
          <h3>{t('gen.complete')}</h3>
          <p>
            {t('gen.completeText').replace('{n}', String(generationProgress.completedCards))}
          </p>
        </div>
      )}
    </div>
  );
};

export default Generation;
