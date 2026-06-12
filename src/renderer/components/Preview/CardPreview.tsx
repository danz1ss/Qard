import React, { useState } from 'react';
import { GeneratedCard } from '../../../shared/types';
import Button from '../common/Button';

interface CardPreviewProps {
  card: GeneratedCard;
}

const CardPreview: React.FC<CardPreviewProps> = ({ card }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handlePlayAudio = async () => {
    if (!card.audioData) return;

    try {
      setIsPlayingAudio(true);
      // Convert audioData to ArrayBuffer for Blob
      const audioBuffer = card.audioData as unknown as ArrayBuffer;
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
        <h4>Word Type</h4>
        <p>{card.wordType}</p>
      </div>

      <div className="card-section">
        <h4>Definition</h4>
        <p>{card.definition}</p>
      </div>

      {card.definitionExample && (
        <div className="card-section">
          <h4>Definition Example</h4>
          <p>{card.definitionExample}</p>
        </div>
      )}

      {card.transcription && (
        <div className="card-section">
          <h4>Transcription</h4>
          <p>{card.transcription}</p>
        </div>
      )}

      {card.examples && card.examples.length > 0 && (
        <div className="card-section">
          <h4>Examples</h4>
          {card.examples.map((example, index) => (
            <div key={index} className="example-item">
              <p className="example-sentence">{example}</p>
            </div>
          ))}
        </div>
      )}

      {card.exampleType && (
        <div className="card-section">
          <h4>Example Type</h4>
          <p>{card.exampleType}</p>
        </div>
      )}

      {card.audioData && (
        <div className="card-section">
          <h4>Audio</h4>
          <Button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            variant="secondary"
            size="small"
          >
            {isPlayingAudio ? 'Playing...' : '▶ Play Audio'}
          </Button>
        </div>
      )}

      {card.error && (
        <div className="card-section error">
          <h4>Error</h4>
          <p>{card.error}</p>
        </div>
      )}
    </div>
  );
};

export default CardPreview;
