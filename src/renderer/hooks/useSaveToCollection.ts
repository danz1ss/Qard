import { useState } from 'react';
import {
  AudioUpload,
  GeneratedCard,
  NewCardInput
} from '../../shared/types';
import { useStore } from '../store';

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
    transcription: card.transcription ?? '',
    examples: card.examples,
    audioFilename: card.audioData ? card.audioFilename ?? null : null,
    tags: 'anki-generator'
  };
}

export const useSaveToCollection = () => {
  const { generatedCards, setGeneratedCards } = useStore();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Помечает isDuplicate по словам, уже существующим в колоде deckId. */
  const markDuplicates = async (deckId: number) => {
    const words = await window.electronAPI.collection.listWords(deckId);
    const existing = new Set(words);
    const { generatedCards: cards } = useStore.getState();
    setGeneratedCards(
      cards.map((c) => ({
        ...c,
        isDuplicate: existing.has(c.word.toLowerCase())
      }))
    );
  };

  const saveAll = async (deckId: number, includeDuplicates: boolean) => {
    const cards = generatedCards.filter(
      (c) => !c.error && (includeDuplicates || !c.isDuplicate)
    );
    if (cards.length === 0) {
      setError('Нечего сохранять (все карточки — дубликаты или с ошибками).');
      setStatus('error');
      return;
    }

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
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setStatus('error');
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setError(null);
  };

  return { saveAll, markDuplicates, resetStatus, status, savedCount, error };
};
