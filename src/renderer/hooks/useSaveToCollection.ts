import { useState } from 'react';
import {
  AudioUpload,
  GeneratedCard,
  NewCardInput
} from '../../shared/types';

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toInput(card: GeneratedCard): NewCardInput {
  return {
    word: card.word,
    wordType: card.wordType,
    definition: card.definition,
    definitionExample: card.definitionExample,
    translation: card.translation ?? '',
    definitionExampleTranslation: card.definitionExampleTranslation ?? '',
    transcription: card.transcription ?? '',
    examples: card.examples,
    secondaryMeaning: card.secondaryMeaning,
    audioFilename: card.audioData ? card.audioFilename ?? null : null,
    tags: 'anki-generator'
  };
}

export const useSaveToCollection = () => {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const saveAll = async (deckId: number, cards: GeneratedCard[]) => {
    setStatus('saving');
    setError(null);
    try {
      const audio: AudioUpload[] = [];
      const seen = new Set<string>();
      for (const c of cards) {
        if (c.audioData && c.audioFilename && !seen.has(c.audioFilename)) {
          seen.add(c.audioFilename);
          audio.push({
            filename: c.audioFilename,
            data: toBase64(c.audioData as unknown as ArrayBuffer)
          });
        }
      }
      const ids = await window.electronAPI.collection.addCards(
        deckId,
        cards.map(toInput),
        audio
      );
      setSavedCount(ids.length);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
      return true;
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setStatus('error');
      return false;
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setError(null);
  };

  return { saveAll, resetStatus, status, savedCount, error };
};
