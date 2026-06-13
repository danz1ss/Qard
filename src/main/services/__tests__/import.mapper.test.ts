import { describe, it, expect } from 'vitest';
import { mapNoteFields } from '../import.mapper';
import { DataSource, FieldMapping } from '../../../shared/types';

const mapping: FieldMapping = {
  Word: DataSource.Word,
  'Word Type': DataSource.WordType,
  Definition: DataSource.Definition,
  'Definition Example': DataSource.DefinitionExample,
  Transcription: DataSource.Transcription,
  'Example(s)': DataSource.Examples,
  'Word Audio': DataSource.WordAudio,
  Extra: DataSource.None
};

describe('mapNoteFields', () => {
  it('maps fields through fieldMapping', () => {
    const res = mapNoteFields(
      {
        Word: 'hello',
        'Word Type': 'noun',
        Definition: 'a greeting',
        'Definition Example': 'Hello there!',
        Transcription: '/həˈloʊ/',
        'Example(s)': 'Hello world<br>Hello again',
        'Word Audio': '[sound:hello_123.mp3]',
        Extra: 'ignored'
      },
      mapping
    );
    expect(res).not.toBeNull();
    expect(res!.card.word).toBe('hello');
    expect(res!.card.wordType).toBe('noun');
    expect(res!.card.definition).toBe('a greeting');
    expect(res!.card.examples).toEqual(['Hello world', 'Hello again']);
    expect(res!.card.audioFilename).toBe('hello_123.mp3');
    expect(res!.audioRef).toBe('hello_123.mp3');
    expect(res!.card.tags).toBe('imported');
  });

  it('strips html from text fields', () => {
    const res = mapNoteFields(
      { Word: '<b>bold</b>', Definition: 'line1<br>line2' },
      mapping
    );
    expect(res!.card.word).toBe('bold');
    expect(res!.card.definition).toBe('line1\nline2');
  });

  it('falls back to first field as word when nothing maps', () => {
    const res = mapNoteFields(
      { Front: 'fallback word', Back: 'meaning', Note: 'extra' },
      {} // пустой fieldMapping
    );
    expect(res!.card.word).toBe('fallback word');
    expect(res!.card.definition).toContain('meaning');
    expect(res!.card.definition).toContain('extra');
  });

  it('returns null when note has no usable word', () => {
    expect(mapNoteFields({}, mapping)).toBeNull();
    expect(mapNoteFields({ Word: '   ' }, mapping)).toBeNull();
  });

  it('strips [sound:...] from fallback text', () => {
    const res = mapNoteFields({ Front: 'word [sound:a.mp3]' }, {});
    expect(res!.card.word).toBe('word');
  });
});
