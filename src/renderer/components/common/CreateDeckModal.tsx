import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface CreateDeckModalProps {
  /** Создаёт колоду. Должен бросать ошибку при неудаче — модалка покажет её инлайн. */
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

/** Модалка создания колоды (вызывается из sticky-тулбара). */
const CreateDeckModal: React.FC<CreateDeckModalProps> = ({ onCreate, onClose }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} className="modal-create" width={420}>
      <h3>New deck</h3>
      <input
        className="deck-create-input"
        value={name}
        autoFocus
        placeholder="Deck name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      {error && <p className="modal-error">{error}</p>}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim() || busy}>
          {busy ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </Modal>
  );
};

export default CreateDeckModal;
