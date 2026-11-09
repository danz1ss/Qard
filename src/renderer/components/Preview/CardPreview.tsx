import React, { useState } from 'react';
import { GeneratedCard } from '../../../shared/types';
import Button from '../common/Button';
import { parseBold } from '../Review/htmlText';
import { useT } from '../../prefs/PreferencesProvider';
import { uniqueAdditionalExamples } from '../../../shared/utils/examples';
import { cardMeanings } from '../../../shared/utils/meanings';

interface CardPreviewProps {
  card: GeneratedCard;
  onRemoveMeaning?: (index: number) => void;
}

/** Рендер строки с сырыми <b>…</b> как текст + визуально жирное слово (п.5). */
const RichText: React.FC<{ html: string }> = ({ html }) => (
  <>
    {parseBold(html).map((seg, i) =>
      seg.bold ? (
        <strong key={i}>{seg.text}</strong>
      ) : (
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      )
    )}
  </>
);

const CardPreview: React.FC<CardPreviewProps> = ({ card, onRemoveMeaning }) => {
  const t = useT();
  const meanings = cardMeanings(card);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handlePlayAudio = async () => {
    if (!card.audioData) return;

    try {
      setIsPlayingAudio(true);
      // Convert audioData to ArrayBuffer for Blob
      const audioBuffer = card.audioData as unknown as ArrayBuffer;
      if (audioBuffer.byteLength === 0) {
        // web: audio was already played by Web Speech API during generation;
        // on manual replay, speak via Web Speech API if available
        if ('speechSynthesis' in window && card.word) {
          const u = new SpeechSynthesisUtterance(card.word);
          u.lang = /[а-яА-ЯёЁ]/.test(card.word) ? 'ru-RU' : 'en-US';
          u.onend = () => setIsPlayingAudio(false);
          window.speechSynthesis.speak(u);
        } else {
          setIsPlayingAudio(false);
        }
        return;
      }
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="card-preview">
      {meanings.map((meaning, index) => {
        const additionalExamples = uniqueAdditionalExamples(meaning.definitionExample, meaning.examples);
        return (
          <section className="preview-meaning" key={index}>
            {meanings.length > 1 && (
              <div className="preview-meaning-header">
                <h3>{t('preview.meaningNumber').replace('{n}', String(index + 1))}</h3>
                {onRemoveMeaning && (
                  <Button type="button" size="small" variant="secondary" onClick={() => onRemoveMeaning(index)}>
                    {t('preview.meaningRemove').replace('{n}', String(index + 1))}
                  </Button>
                )}
              </div>
            )}
            <div className="card-section">
              <h4>{t('preview.wordType')}</h4>
              <p>{meaning.wordType}</p>
            </div>

            <div className="card-section">
              <h4>{t('review.definition')}</h4>
              <p><RichText html={meaning.definition} /></p>
            </div>

            {meaning.translation && (
              <div className="card-section">
                <h4>{t('preview.translation')}</h4>
                <p>{meaning.translation}</p>
              </div>
            )}

            {meaning.definitionExample && (
              <div className="card-section">
                <h4>{t('preview.defExample')}</h4>
                <p><RichText html={meaning.definitionExample} /></p>
                {meaning.definitionExampleTranslation && (
                  <p className="example-translation">{meaning.definitionExampleTranslation}</p>
                )}
              </div>
            )}

            {meaning.transcription && (
              <div className="card-section">
                <h4>{t('preview.transcription')}</h4>
                <p>{meaning.transcription}</p>
              </div>
            )}

            {additionalExamples.length > 0 && (
              <div className="card-section">
                <h4>{t('preview.examples')}</h4>
                {additionalExamples.map((example, index) => (
                  <div key={index} className="example-item">
                    <p className="example-sentence"><RichText html={example} /></p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {card.exampleType && (
        <div className="card-section">
          <h4>{t('preview.exampleType')}</h4>
          <p>{card.exampleType}</p>
        </div>
      )}

      {card.audioData && (
        <div className="card-section">
          <h4>{t('preview.audio')}</h4>
          <Button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            variant="secondary"
            size="small"
          >
            {isPlayingAudio ? t('preview.playing') : t('preview.playAudio')}
          </Button>
        </div>
      )}

      {card.error && (
        <div className="card-section error">
          <h4>{t('preview.errorLabel')}</h4>
          <p>{card.error}</p>
        </div>
      )}
    </div>
  );
};

export default CardPreview;
