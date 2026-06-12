import { useState } from 'react'
import { AnkiNote, DataSource, GeneratedCard } from '../../shared/types'
import { useStore } from '../store'

export type AddStatus = 'idle' | 'adding' | 'success' | 'error';

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const useAddToAnki = () => {
  const {
    selectedDeck,
    selectedModel,
    fieldMapping,
    availableDecks
  } = useStore();

  const [status, setStatus] = useState<AddStatus>('idle');
  const [addedCount, setAddedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const buildFieldValue = (card: GeneratedCard, source: DataSource): string => {
    switch (source) {
      case DataSource.Word:
        return card.word;

      case DataSource.WordType:
        return card.wordType;

      case DataSource.Definition:
        return card.definition;

      case DataSource.DefinitionExample:
        return card.definitionExample;

      case DataSource.Transcription:
        return card.transcription || '';

      case DataSource.Examples:
        return card.examples.join('<br>');

      case DataSource.WordAudio:
        return card.audioFilename ? `[sound:${card.audioFilename}]` : '';

      case DataSource.ExampleType:
        return card.exampleType || '';

      case DataSource.None:
      default:
        return '';
    }
  };

  const buildNote = (card: GeneratedCard): AnkiNote => {
    // Build note fields based on field mapping
    const fields: { [key: string]: string } = {};
    for (const [fieldName, dataSource] of Object.entries(fieldMapping)) {
      fields[fieldName] = buildFieldValue(card, dataSource);
    }

    // Prepare audio data if needed
    const audio: { filename: string; data: string }[] = [];
    if (card.audioData && card.audioFilename) {
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(card.audioData as unknown as ArrayBuffer);
      let binary = '';
      for (let j = 0; j < bytes.byteLength; j++) {
        binary += String.fromCharCode(bytes[j]);
      }
      const base64Audio = btoa(binary);

      audio.push({ filename: card.audioFilename, data: base64Audio });
    }

    return {
      deckName: selectedDeck,
      modelName: selectedModel,
      fields,
      audio: audio.length > 0 ? audio : undefined,
      tags: ['anki-generator']
    };
  };

  /**
   * Adds cards to Anki in a single batch request.
   * Skips error cards and (unless includeDuplicates) cards already in the deck.
   */
  const addAllToAnki = async (
    cards: GeneratedCard[],
    includeDuplicates = false
  ) => {
    const cardsToAdd = cards.filter(
      (card) => !card.error && (includeDuplicates || !card.isDuplicate)
    );

    setStatus('adding');
    setAddedCount(0);
    setTotalCount(cardsToAdd.length);
    setError(null);

    // Guard against a missing/stale deck so we fail with a clear message
    // instead of AnkiConnect's "deck was not found".
    if (!selectedDeck) {
      setError('No deck selected. Pick a deck in Settings before adding.');
      setStatus('error');
      return;
    }
    if (availableDecks.length > 0 && !availableDecks.includes(selectedDeck)) {
      setError(
        `Deck "${selectedDeck}" no longer exists in Anki. ` +
          'Select an existing deck in Settings.'
      );
      setStatus('error');
      return;
    }

    if (cardsToAdd.length === 0) {
      setError('No cards to add (all were duplicates or had errors).');
      setStatus('error');
      return;
    }

    const notes = shuffleArray(cardsToAdd).map(buildNote);

    try {
      const results = await window.electronAPI.anki.addNotes(notes);
      const successCount = results.filter(
        (id) => id !== null && id !== -1
      ).length;

      setAddedCount(successCount);

      if (successCount < notes.length) {
        setError(
          `Added ${successCount} of ${notes.length}. ` +
            `${notes.length - successCount} were rejected by Anki (likely duplicates).`
        );
      }

      setStatus('success');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (err: any) {
      console.error('Error adding cards to Anki:', err);
      setError(err.message || 'Unknown error occurred');
      setStatus('error');
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setError(null);
  };

  return {
    addAllToAnki,
    resetStatus,
    status,
    isAdding: status === 'adding',
    addedCount,
    totalCount,
    error
  };
};
