import React, { useEffect, useState } from 'react';
import { ImportDeckChoice, ImportProgress } from '../../../shared/types';
import Button from '../common/Button';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Phase = 'loading' | 'choose' | 'running' | 'done' | 'error';

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [ankiDecks, setAnkiDecks] = useState<ImportDeckChoice[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    window.electronAPI.importer
      .getAnkiDecks()
      .then((decks) => {
        setAnkiDecks(decks);
        setChosen(new Set(decks.map((d) => d.name)));
        setPhase('choose');
      })
      .catch((e) => {
        setError(e.message);
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.importer.onProgress((p) => {
      setProgress(p);
      if (p.finished) {
        setPhase('done');
        onImported();
      }
    });
    return unsubscribe;
  }, [onImported]);

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const run = async () => {
    setPhase('running');
    try {
      await window.electronAPI.importer.run([...chosen]);
    } catch (e: any) {
      setError(e.message);
      setPhase('error');
    }
  };

  return (
    <div className="modal-overlay" onClick={phase === 'running' ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Import from Anki</h3>

        {phase === 'loading' && <p>Connecting to Anki...</p>}

        {phase === 'error' && (
          <>
            <p className="help-text error">{error}</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            <p>Choose decks to import (study progress is not transferred):</p>
            {ankiDecks.map((d) => (
              <label key={d.name} style={{ display: 'block', margin: '6px 0' }}>
                <input
                  type="checkbox"
                  checked={chosen.has(d.name)}
                  onChange={() => toggle(d.name)}
                />
                {' '}{d.name} ({d.noteCount})
              </label>
            ))}
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={run} disabled={chosen.size === 0}>
                Import
              </Button>
            </div>
          </>
        )}

        {phase === 'running' && progress && (
          <>
            <p>
              Deck "{progress.deck}": {progress.done} / {progress.total}
            </p>
            <p>
              Imported: {progress.imported} · Skipped: {progress.skipped} ·
              Errors: {progress.errors}
            </p>
          </>
        )}
        {phase === 'running' && !progress && <p>Import started...</p>}

        {phase === 'done' && progress && (
          <>
            <p>
              Done! Imported: {progress.imported}, skipped: {progress.skipped},
              errors: {progress.errors}.
            </p>
            <div className="modal-actions">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
