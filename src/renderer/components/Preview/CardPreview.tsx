import React, { useState } from 'react';
import { GeneratedCard } from '../../../shared/types';
import Button from '../common/Button';
import { parseBold } from '../Review/htmlText';
import { useT } from '../../prefs/PreferencesProvider';

interface CardPreviewProps {
  card: GeneratedCard;
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

const CardPreview: React.FC<CardPreviewProps> = ({ card }) => {
  const t = useT();
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
      <div className="card-section">
        <h4>{t('preview.wordType')}</h4>
        <p>{card.wordType}</p>
      </div>

      <div className="card-section">
        <h4>{t('review.definition')}</h4>
        <p><RichText html={card.definition} /></p>
      </div>

      {card.definitionExample && (
        <div className="card-section">
          <h4>{t('preview.defExample')}</h4>
          <p><RichText html={card.definitionExample} /></p>
        </div>
      )}

      {card.transcription && (
        <div className="card-section">
          <h4>{t('preview.transcription')}</h4>
          <p>{card.transcription}</p>
        </div>
      )}

      {card.examples && card.examples.length > 0 && (
        <div className="card-section">
          <h4>{t('preview.examples')}</h4>
          {card.examples.map((example, index) => (
            <div key={index} className="example-item">
              <p className="example-sentence"><RichText html={example} /></p>
            </div>
          ))}
        </div>
      )}

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
