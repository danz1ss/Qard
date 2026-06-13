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
        <h3>Импорт из Anki</h3>

        {phase === 'loading' && <p>Подключение к Anki...</p>}

        {phase === 'error' && (
          <>
            <p className="help-text error">{error}</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Закрыть</Button>
            </div>
          </>
        )}

        {phase === 'choose' && (
          <>
            <p>Выбери колоды для импорта (прогресс изучения не переносится):</p>
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
              <Button variant="secondary" onClick={onClose}>Отмена</Button>
              <Button onClick={run} disabled={chosen.size === 0}>
                Импортировать
              </Button>
            </div>
          </>
        )}

        {phase === 'running' && progress && (
          <>
            <p>
              Колода «{progress.deck}»: {progress.done} / {progress.total}
            </p>
            <p>
              Импортировано: {progress.imported} · Пропущено: {progress.skipped} ·
              Ошибок: {progress.errors}
            </p>
          </>
        )}
        {phase === 'running' && !progress && <p>Импорт начался...</p>}

        {phase === 'done' && progress && (
          <>
            <p>
              Готово! Импортировано: {progress.imported}, пропущено: {progress.skipped},
              ошибок: {progress.errors}.
            </p>
            <div className="modal-actions">
              <Button onClick={onClose}>Закрыть</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
