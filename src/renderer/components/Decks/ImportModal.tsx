import React, { useEffect, useState } from 'react';
import { ImportDeckChoice, ImportProgress } from '../../../shared/types';
import Button from '../common/Button';
import { useT } from '../../prefs/PreferencesProvider';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Phase = 'loading' | 'choose' | 'running' | 'done' | 'error';

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const t = useT();
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
        <h3>{t('decks.importAnki')}</h3>

        {phase === 'loading' && <p>{t('import.connecting')}</p>}

        {phase === 'error' && (
          <>
            <p className="help-text error">{error}</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>{t('modal.close')}</Button>
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            <p>{t('import.chooseDecks')}</p>
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
              <Button variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
              <Button onClick={run} disabled={chosen.size === 0}>
                {t('modal.import')}
              </Button>
            </div>
          </>
        )}

        {phase === 'running' && progress && (
          <>
            <p>
              {t('import.progress')
                .replace('{name}', progress.deck)
                .replace('{done}', String(progress.done))
                .replace('{total}', String(progress.total))}
            </p>
            <p>
              {t('import.stats')
                .replace('{imported}', String(progress.imported))
                .replace('{skipped}', String(progress.skipped))
                .replace('{errors}', String(progress.errors))}
            </p>
          </>
        )}
        {phase === 'running' && !progress && <p>{t('import.started')}</p>}

        {phase === 'done' && progress && (
          <>
            <p>
              {t('import.done')
                .replace('{imported}', String(progress.imported))
                .replace('{skipped}', String(progress.skipped))
                .replace('{errors}', String(progress.errors))}
            </p>
            <div className="modal-actions">
              <Button onClick={onClose}>{t('modal.close')}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
