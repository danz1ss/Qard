import { CollectionService } from './collection.service';
import { mapNoteFields } from './import.mapper';
import { ParsedAnkiPackage } from '../../shared/anki-package';
import { FieldMapping, ImportProgress, ImportResult, NewCardInput } from '../../shared/types';

const NOTES_BATCH = 100;

export type ImportedMediaSaver = (filename: string, data: Uint8Array) => Promise<void>;

export async function importParsedAnkiPackage(
  col: CollectionService,
  parsed: ParsedAnkiPackage,
  deckNames: string[],
  fieldMapping: FieldMapping,
  saveMedia: ImportedMediaSaver,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const selected = new Set(deckNames);
  const savedMedia = new Set<string>();

  for (const deckName of deckNames) {
    const sourceNotes = parsed.notes.filter((note) => note.deckName === deckName && selected.has(note.deckName));
    const deck = col.getDeckByName(deckName) ?? col.createDeck(deckName);
    const seen = new Set(col.listCardKeys(deck.id));
    let done = 0;

    for (let start = 0; start < sourceNotes.length; start += NOTES_BATCH) {
      const batch = sourceNotes.slice(start, start + NOTES_BATCH);
      const toAdd: NewCardInput[] = [];
      for (const note of batch) {
        try {
          const mapped = mapNoteFields(note.fields, fieldMapping);
          if (!mapped) {
            skipped++;
            continue;
          }
          const key = `${mapped.card.word.toLowerCase()} ${mapped.card.definition.toLowerCase()}`;
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          seen.add(key);
          const tags = new Set(['imported', ...note.tags.split(/\s+/).filter(Boolean)]);
          mapped.card.tags = [...tags].join(' ');

          if (mapped.audioRef) {
            const bytes = parsed.media.get(mapped.audioRef);
            if (bytes) {
              try {
                if (!savedMedia.has(mapped.audioRef)) {
                  await saveMedia(mapped.audioRef, bytes);
                  savedMedia.add(mapped.audioRef);
                }
              } catch {
                errors++;
                mapped.card.audioFilename = null;
              }
            } else {
              mapped.card.audioFilename = null;
            }
          }
          toAdd.push(mapped.card);
        } catch {
          errors++;
        }
      }
      col.addCards(deck.id, toAdd, Date.now());
      imported += toAdd.length;
      done += batch.length;
      onProgress({
        deck: deckName,
        done,
        total: sourceNotes.length,
        imported,
        skipped,
        errors,
        finished: false
      });
    }
  }

  const result = { imported, skipped, errors };
  onProgress({ deck: '', done: 0, total: 0, ...result, finished: true });
  return result;
}
