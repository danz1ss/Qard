import React, { useState } from 'react';
import { StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmModal from '../common/ConfirmModal';

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
        {/* resize только по вертикали + max-height со скроллом (п.6) */}
        <textarea
          rows={4}
          className="examples-textarea"
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
        />
        <Input label="Tags (space-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="modal-actions">
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>Delete</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmModal
          title="Delete card?"
          message={
            <>
              Delete card <strong>“{card.word}”</strong>? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
};

export default CardEditModal;
