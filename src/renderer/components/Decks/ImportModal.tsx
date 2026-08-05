import React, { useEffect, useState } from 'react';
import {
  ImportDeckChoice,
  ImportFilePayload,
  ImportProgress
} from '../../../shared/types';
import Button from '../common/Button';
import { useT } from '../../prefs/PreferencesProvider';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

type Phase = 'source' | 'loading' | 'choose' | 'running' | 'done' | 'error';
type Source = 'file' | 'anki-connect';

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('source');
  const [source, setSource] = useState<Source>('file');
  const [error, setError] = useState('');
  const [file, setFile] = useState<ImportFilePayload | null>(null);
  const [ankiDecks, setAnkiDecks] = useState<ImportDeckChoice[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ImportProgress | null>(null);

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

  const setDeckChoices = (decks: ImportDeckChoice[]) => {
    if (decks.length === 0) throw new Error(t('import.noDecks'));
    setAnkiDecks(decks);
    setChosen(new Set(decks.map((deck) => deck.name)));
    setPhase('choose');
  };

  const chooseFile = async (selected: File) => {
    setSource('file');
    setPhase('loading');
    setError('');
    try {
      if (!/\.(apkg|colpkg)$/i.test(selected.name)) {
        throw new Error(t('import.unsupportedFile'));
      }
      const payload: ImportFilePayload = {
        name: selected.name,
        data: new Uint8Array(await selected.arrayBuffer())
      };
      setFile(payload);
      setDeckChoices(await window.electronAPI.importer.inspectFile(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const connectToAnki = async () => {
    setSource('anki-connect');
    setPhase('loading');
    setError('');
    try {
      setDeckChoices(await window.electronAPI.importer.getAnkiDecks());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const toggle = (name: string) => {
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const run = async () => {
    setPhase('running');
    setProgress(null);
    try {
      if (source === 'file' && file) {
        await window.electronAPI.importer.runFile(file, [...chosen]);
      } else {
        await window.electronAPI.importer.run([...chosen]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('source');
    setError('');
    setFile(null);
    setAnkiDecks([]);
    setChosen(new Set());
    setProgress(null);
  };

  const busy = phase === 'loading' || phase === 'running';

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal import-modal" onClick={(event) => event.stopPropagation()}>
        <h3>{t('import.title')}</h3>

        {phase === 'source' && (
          <>
            <p>{t('import.fileHint')}</p>
            <label className="anki-file-picker">
              <span className="anki-file-picker-icon">↓</span>
              <span>
                <strong>{t('import.chooseFile')}</strong>
                <small>.apkg · .colpkg</small>
              </span>
              <input
                type="file"
                accept=".apkg,.colpkg,application/zip"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void chooseFile(selected);
                }}
              />
            </label>
            {!__IS_WEB__ && (
              <div className="import-connect-option">
                <span>{t('import.or')}</span>
                <Button variant="secondary" onClick={connectToAnki}>
                  {t('import.fromRunningAnki')}
                </Button>
              </div>
            )}
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>{t('modal.cancel')}</Button>
            </div>
          </>
        )}

        {phase === 'loading' && (
          <p>{source === 'file' ? t('import.readingFile') : t('import.connecting')}</p>
        )}

        {phase === 'error' && (
          <>
            <p className="help-text error">{error}</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>{t('modal.close')}</Button>
              <Button onClick={reset}>{t('import.tryAgain')}</Button>
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            {file && source === 'file' && <p className="import-filename">{file.name}</p>}
            <p>{t('import.chooseDecks')}</p>
            <div className="import-deck-list">
              {ankiDecks.map((deck) => (
                <label key={deck.name}>
                  <input
                    type="checkbox"
                    checked={chosen.has(deck.name)}
                    onChange={() => toggle(deck.name)}
                  />
                  <span>{deck.name}</span>
                  <small>{deck.noteCount}</small>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={reset}>{t('modal.back')}</Button>
              <Button onClick={run} disabled={chosen.size === 0}>{t('modal.import')}</Button>
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
            <div className="import-progress-track">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
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
