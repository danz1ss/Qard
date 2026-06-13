import { ankiConnectService } from './anki-connect.service';
import { CollectionService } from './collection.service';
import { MediaService } from './media.service';
import { mapNoteFields } from './import.mapper';
import {
  FieldMapping,
  ImportDeckChoice,
  ImportProgress,
  ImportResult,
  NewCardInput
} from '../../shared/types';

const NOTES_BATCH = 100;

function escapeAnkiQuery(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}

export class ImportService {
  constructor(
    private col: CollectionService,
    private media: MediaService
  ) {}

  async getAnkiDecks(): Promise<ImportDeckChoice[]> {
    const names = await ankiConnectService.getDeckNames();
    const result: ImportDeckChoice[] = [];
    for (const name of names) {
      const ids = await ankiConnectService.findNotes(
        `deck:"${escapeAnkiQuery(name)}"`
      );
      result.push({ name, noteCount: ids.length });
    }
    return result;
  }

  async run(
    deckNames: string[],
    fieldMapping: FieldMapping,
    onProgress: (p: ImportProgress) => void
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const deckName of deckNames) {
      const deck =
        this.col.getDeckByName(deckName) ?? this.col.createDeck(deckName);
      const noteIds = await ankiConnectService.findNotes(
        `deck:"${escapeAnkiQuery(deckName)}"`
      );
      const seen = new Set(this.col.listCardKeys(deck.id));
      let done = 0;

      for (let i = 0; i < noteIds.length; i += NOTES_BATCH) {
        const infos = await ankiConnectService.notesInfo(
          noteIds.slice(i, i + NOTES_BATCH)
        );
        const toAdd: NewCardInput[] = [];

        for (const info of infos) {
          try {
            const flat: { [name: string]: string } = {};
            for (const [n, v] of Object.entries(info.fields)) {
              flat[n] = v.value;
            }
            const mapped = mapNoteFields(flat, fieldMapping);
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

            if (mapped.audioRef) {
              const data = await ankiConnectService.retrieveMediaFile(
                mapped.audioRef
              );
              if (data) {
                await this.media.save(mapped.audioRef, data);
              } else {
                mapped.card.audioFilename = null;
              }
            }
            toAdd.push(mapped.card);
          } catch (e) {
            console.error('Import: failed to map note', info.noteId, e);
            errors++;
          }
        }

        this.col.addCards(deck.id, toAdd, Date.now());
        imported += toAdd.length;
        done += infos.length;
        onProgress({
          deck: deckName,
          done,
          total: noteIds.length,
          imported,
          skipped,
          errors,
          finished: false
        });
      }
    }

    const result = { imported, skipped, errors };
    onProgress({
      deck: '',
      done: 0,
      total: 0,
      ...result,
      finished: true
    });
    return result;
  }
}
