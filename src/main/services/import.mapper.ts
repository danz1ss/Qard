import { DataSource, FieldMapping, NewCardInput } from '../../shared/types';

export interface MappedNote {
  card: NewCardInput;
  audioRef: string | null;
}

const SOUND = /\[sound:([^\]]+)\]/;
const SOUND_ALL = /\[sound:[^\]]+\]/g;

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function mapNoteFields(
  fields: { [name: string]: string },
  fieldMapping: FieldMapping
): MappedNote | null {
  const bySource = new Map<DataSource, string>();
  for (const [fieldName, source] of Object.entries(fieldMapping)) {
    if (source === DataSource.None) {
      continue;
    }
    const value = fields[fieldName];
    if (value !== undefined && value !== '' && !bySource.has(source)) {
      bySource.set(source, value);
    }
  }

  const audioRaw = bySource.get(DataSource.WordAudio) ?? '';
  const soundMatch = audioRaw.match(SOUND);
  const audioRef = soundMatch ? soundMatch[1] : null;

  let word = stripHtml(bySource.get(DataSource.Word) ?? '');
  let definition = stripHtml(bySource.get(DataSource.Definition) ?? '');

  if (!word) {
    // Фолбэк: первое поле ноты → word, конкатенация остальных → definition
    const names = Object.keys(fields);
    if (names.length === 0) {
      return null;
    }
    word = stripHtml(fields[names[0]].replace(SOUND_ALL, ''));
    definition = stripHtml(
      names
        .slice(1)
        .map((n) => fields[n])
        .join('\n')
        .replace(SOUND_ALL, '')
    );
  }
  if (!word) {
    return null;
  }

  const examplesRaw = bySource.get(DataSource.Examples) ?? '';
  const examples = examplesRaw
    ? examplesRaw
        .split(/<br\s*\/?>/i)
        .map(stripHtml)
        .filter(Boolean)
    : [];

  return {
    card: {
      word,
      wordType: stripHtml(bySource.get(DataSource.WordType) ?? ''),
      definition,
      definitionExample: stripHtml(
        bySource.get(DataSource.DefinitionExample) ?? ''
      ),
      transcription: stripHtml(bySource.get(DataSource.Transcription) ?? ''),
      examples,
      audioFilename: audioRef,
      tags: 'imported'
    },
    audioRef
  };
}
