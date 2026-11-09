import React, { useState } from 'react';
import { StoredCard } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmModal from '../common/ConfirmModal';
import { useT } from '../../prefs/PreferencesProvider';

interface CardEditModalProps {
  card: StoredCard;
  onClose: () => void;
  onSaved: () => void;
}

const CardEditModal: React.FC<CardEditModalProps> = ({ card, onClose, onSaved }) => {
  const t = useT();
  const [word, setWord] = useState(card.word);
  const [wordType, setWordType] = useState(card.wordType);
  const [definition, setDefinition] = useState(card.definition);
  const [definitionExample, setDefinitionExample] = useState(card.definitionExample);
  const [translation, setTranslation] = useState(card.translation);
  const [definitionExampleTranslation, setDefinitionExampleTranslation] = useState(card.definitionExampleTranslation);
  const [transcription, setTranscription] = useState(card.transcription);
  const [examples, setExamples] = useState(card.examples.join('\n'));
  const [secondaryMeaning, setSecondaryMeaning] = useState(card.secondaryMeaning);
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
        translation,
        definitionExampleTranslation,
        transcription,
        examples: examples.split('\n').map((s) => s.trim()).filter(Boolean),
        ...(card.secondaryMeaning && { secondaryMeaning: secondaryMeaning ?? null }),
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
        <h3>{t('browse.editCard')}</h3>
        <Input label={t('browse.fieldWord')} value={word} onChange={(e) => setWord(e.target.value)} />
        <Input label={t('browse.fieldPartOfSpeech')} value={wordType} onChange={(e) => setWordType(e.target.value)} />
        <Input label={t('browse.fieldDefinition')} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <Input label={t('browse.fieldTranslation')} value={translation} onChange={(e) => setTranslation(e.target.value)} />
        <Input
          label={t('browse.fieldDefExample')}
          value={definitionExample}
          onChange={(e) => setDefinitionExample(e.target.value)}
        />
        <Input
          label={t('browse.fieldDefExampleTranslation')}
          value={definitionExampleTranslation}
          onChange={(e) => setDefinitionExampleTranslation(e.target.value)}
        />
        <Input
          label={t('browse.fieldTranscription')}
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
        />
        <label className="input-label">{t('browse.fieldExamples')}</label>
        {/* resize только по вертикали + max-height со скроллом (п.6) */}
        <textarea
          rows={4}
          className="examples-textarea"
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
        />
        <Input label={t('browse.fieldTags')} value={tags} onChange={(e) => setTags(e.target.value)} />
        {secondaryMeaning && (
          <fieldset className="card-edit-meaning">
            <legend>{t('preview.meaningNumber').replace('{n}', '2')}</legend>
            <Input label={t('browse.fieldPartOfSpeech')} value={secondaryMeaning.wordType}
              onChange={(e) => setSecondaryMeaning({ ...secondaryMeaning, wordType: e.target.value })} />
            <Input label={t('browse.fieldDefinition')} value={secondaryMeaning.definition}
              onChange={(e) => setSecondaryMeaning({ ...secondaryMeaning, definition: e.target.value })} />
            <Input label={t('browse.fieldTranslation')} value={secondaryMeaning.translation ?? ''}
              onChange={(e) => setSecondaryMeaning({ ...secondaryMeaning, translation: e.target.value })} />
            <Input label={t('browse.fieldDefExample')} value={secondaryMeaning.definitionExample}
              onChange={(e) => setSecondaryMeaning({ ...secondaryMeaning, definitionExample: e.target.value })} />
            <Input label={t('browse.fieldDefExampleTranslation')} value={secondaryMeaning.definitionExampleTranslation ?? ''}
              onChange={(e) => setSecondaryMeaning({ ...secondaryMeaning, definitionExampleTranslation: e.target.value })} />
            <Button type="button" size="small" variant="secondary" onClick={() => setSecondaryMeaning(undefined)}>
              {t('preview.meaningRemove').replace('{n}', '2')}
            </Button>
          </fieldset>
        )}
        <div className="modal-actions">
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>{t('modal.delete')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
          <Button onClick={save} disabled={saving || !!(secondaryMeaning && !secondaryMeaning.definition.trim())}>
            {saving ? t('modal.saving') : t('modal.save')}
          </Button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmModal
          title={t('browse.deleteCardTitle')}
          message={
            <>
              {t('browse.deleteCardMsgPre')}<strong>"{card.word}"</strong>{t('browse.deleteCardMsgPost')}
            </>
          }
          confirmLabel={t('modal.delete')}
          onConfirm={remove}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
};

export default CardEditModal;
