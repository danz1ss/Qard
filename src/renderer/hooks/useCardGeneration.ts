import { useStore } from '../store';
import { GeneratedCard, GenerationStage, BatchWordResult, WordMeaningResponse, ParsedWord } from '../../shared/types';
import { parseWords } from '../../shared/utils/wordParser';

// Configuration
const AI_BATCH_SIZE = 3;    // Words per AI request
const AI_POOL_LIMIT = 3;    // Max concurrent AI batch requests
const TTS_POOL_LIMIT = 5;   // Max concurrent TTS requests

/**
 * Simple semaphore for limiting concurrent operations
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>(resolve => this.waiting.push(resolve));
    this.permits--;
  }

  release(): void {
    this.permits++;
    const next = this.waiting.shift();
    if (next) next();
  }
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export const useCardGeneration = () => {
  const {
    words,
    exampleCount,
    addGeneratedCard,
    setGenerationProgress,
    setIsGenerating,
    resetGeneration
  } = useStore();

  const startGeneration = async () => {
    resetGeneration();
    setIsGenerating(true);

    const totalWords = words.length;
    let completedWords = 0;
    let cardCounter = 0;
    const nextCardId = () => `card-${Date.now()}-${cardCounter++}`;

    // Parse all words to detect part of speech
    const parsedWords = parseWords(words);

    // Create a map from clean word (lowercase) to parsed word info
    const parsedWordMap = new Map<string, ParsedWord>();
    parsedWords.forEach(pw => {
      parsedWordMap.set(pw.word.toLowerCase(), pw);
    });

    // Create semaphores for rate limiting
    const aiSemaphore = new Semaphore(AI_POOL_LIMIT);
    const ttsSemaphore = new Semaphore(TTS_POOL_LIMIT);

    // Update progress
    const updateProgress = (currentWord: string, stage: GenerationStage, error?: string) => {
      setGenerationProgress({
        currentWord,
        currentStage: stage,
        completedCards: completedWords,
        totalCards: totalWords,
        error
      });
    };

    // Split parsed words into batches for AI requests
    // На web вся генерация — один запрос (дневной лимит = 1 запрос/день).
    const batchSize = __IS_WEB__ ? Math.max(parsedWords.length, 1) : AI_BATCH_SIZE;
    const batches = chunkArray(parsedWords, batchSize);

    // Store for AI results: clean word (lowercase) -> meanings
    const aiResults = new Map<string, WordMeaningResponse[]>();

    // Process AI batches in parallel (with semaphore limit)
    let dailyLimitHit = false;
    const aiBatchPromises = batches.map(async (batch) => {
      await aiSemaphore.acquire();
      try {
        updateProgress(batch[0].original, GenerationStage.Definition);
        const results = await window.electronAPI.ai.generateBatch(batch, exampleCount);

        // Store results by clean word
        results.forEach((result: BatchWordResult) => {
          aiResults.set(result.word.toLowerCase(), result.meanings);
        });

        return results;
      } catch (error: any) {
        console.error(`Error generating batch [${batch.map(pw => pw.original).join(', ')}]:`, error);
        // Mark all words in batch as failed
        batch.forEach(pw => {
          aiResults.set(pw.word.toLowerCase(), []);
        });
        if (error?.message === 'DAILY_LIMIT') dailyLimitHit = true;
        throw error;
      } finally {
        aiSemaphore.release();
      }
    });

    // Process TTS for all words in parallel (with semaphore limit)
    // Use the clean word for TTS (without markers)
    const audioResults = new Map<string, ArrayBuffer>();

    const ttsPromises = parsedWords.map(async (pw) => {
      await ttsSemaphore.acquire();
      try {
        const audioBuffer = await window.electronAPI.tts.generateAudio(pw.word);
        audioResults.set(pw.word.toLowerCase(), audioBuffer);
        return audioBuffer;
      } catch (error: any) {
        console.error(`Error generating audio for "${pw.word}":`, error);
        return null;
      } finally {
        ttsSemaphore.release();
      }
    });

    // Wait for all AI and TTS requests to complete
    await Promise.allSettled([...aiBatchPromises, ...ttsPromises]);

    if (dailyLimitHit) {
      setIsGenerating(false);
      setGenerationProgress({
        currentWord: '',
        currentStage: GenerationStage.Error,
        completedCards: 0,
        totalCards: totalWords,
        error: 'DAILY_LIMIT',
      });
      return;
    }

    // Now create cards from results
    for (const pw of parsedWords) {
      const wordLower = pw.word.toLowerCase();
      const meanings = aiResults.get(wordLower);
      const audioBuffer = audioResults.get(wordLower);

      if (!meanings || meanings.length === 0) {
        // Error case - no meanings generated
        const errorCard: GeneratedCard = {
          id: nextCardId(),
          word: pw.word, // Use clean word for card
          wordType: '',
          definition: '',
          definitionExample: '',
          examples: [],
          error: 'Failed to generate meanings'
        };
        addGeneratedCard(errorCard);
        completedWords++;
        updateProgress(pw.original, GenerationStage.Error, 'Failed to generate meanings');
        continue;
      }

      // Create a card for each meaning
      const audioFilename = `${pw.word}_${Date.now()}.mp3`;

      meanings.forEach((meaning: WordMeaningResponse, index: number) => {
        const card: GeneratedCard = {
          id: nextCardId(),
          word: pw.word, // Use clean word for card
          wordType: meaning.wordType,
          definition: meaning.definition,
          definitionExample: meaning.definitionExample,
          transcription: meaning.transcription,
          examples: meaning.examples,
          exampleType: meaning.exampleType,
          audioFilename: index === 0 ? audioFilename : `${pw.word}_${Date.now()}_${index}.mp3`,
          audioData: audioBuffer as any
        };
        addGeneratedCard(card);
      });

      completedWords++;
      updateProgress(pw.original, GenerationStage.Complete);
    }

    setIsGenerating(false);

    // Final progress update
    setGenerationProgress({
      currentWord: '',
      currentStage: GenerationStage.Idle,
      completedCards: completedWords,
      totalCards: totalWords
    });
  };

  return {
    startGeneration
  };
};
