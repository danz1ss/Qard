import React, { useState } from 'react';
import { StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';

interface CardEditModalProps {
  card: StoredCard;
  onClose: () => void;
  onSaved: () => void;
}

const CardEditModal: React.FC<CardEditModalProps> = ({ card, onClose, onSaved }) => {
  const [word, setWord] = useState(card.word);
  const [wordType, setWordType] = useState(card.wordType);
  const [definition, setDefinition] = useState(card.definition);
  const [definitionExample, setDefinitionExample] = useState(card.definitionExample);
  const [transcription, setTranscription] = useState(card.transcription);
  const [examples, setExamples] = useState(card.examples.join('\n'));
  const [tags, setTags] = useState(card.tags);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await window.electronAPI.collection.updateCard({
        id: card.id,
        word,
        wordType,
        definition,
        definitionExample,
        transcription,
        examples: examples.split('\n').map((s) => s.trim()).filter(Boolean),
        tags: tags.trim()
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete card "${card.word}"?`)) return;
    await window.electronAPI.collection.deleteCards([card.id]);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit card</h3>
        <Input label="Word" value={word} onChange={(e) => setWord(e.target.value)} />
        <Input label="Part of speech" value={wordType} onChange={(e) => setWordType(e.target.value)} />
        <Input label="Definition" value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <Input
          label="Definition example"
          value={definitionExample}
          onChange={(e) => setDefinitionExample(e.target.value)}
        />
        <Input
          label="Transcription"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
        />
        <label className="input-label">Examples (one per line)</label>
        <textarea
          rows={4}
          style={{ width: '100%' }}
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
        />
        <Input label="Tags (space-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="modal-actions">
          <Button variant="danger" onClick={remove}>Delete</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardEditModal;
