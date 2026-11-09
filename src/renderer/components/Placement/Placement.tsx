import React, { useEffect, useRef, useState } from 'react';
import { PLACEMENT_QUESTIONS, recommendLevel } from '../../lib/placement';
import { useT } from '../../prefs/PreferencesProvider';
import { useStore } from '../../store';
import { LearnerLevel } from '../../../shared/types';
import Button from '../common/Button';
import './Placement.css';

interface PlacementProps {
  onExit: () => void;
  onDecks: () => void;
}

export default function Placement({ onExit, onDecks }: PlacementProps) {
  const t = useT();
  const setLearnerLevel = useStore((state) => state.setLearnerLevel);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selection, setSelection] = useState<number | null | undefined>(undefined);
  const [result, setResult] = useState<LearnerLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const total = PLACEMENT_QUESTIONS.length;
  const question = PLACEMENT_QUESTIONS[answers.length];

  useEffect(() => { heading.current?.focus(); }, [started, answers.length, result]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selection === undefined || !question || result || saving) return;
    const next = [...answers, selection];
    if (next.length === total) {
      const level = recommendLevel(next);
      if (!level) return;
      setSaving(true);
      setSaveFailed(false);
      try {
        await window.electronAPI.settings.set('learnerLevel', level);
        setLearnerLevel(level);
        setResult(level);
      } catch {
        setSaveFailed(true);
        return;
      } finally {
        setSaving(false);
      }
    }
    setAnswers(next);
    setSelection(undefined);
  };

  return (
    <section className="placement-page">
      <div className="placement-panel">
        {result ? (
          <>
            <p className="placement-kicker">{t('placement.resultLabel')}</p>
            <h2 className="placement-result" tabIndex={-1} ref={heading}>{result}</h2>
            <p className="placement-copy">{t('placement.resultHint')}</p>
            <div className="placement-actions">
              <Button type="button" onClick={onDecks}>{t('placement.toDecks')}</Button>
            </div>
          </>
        ) : !started ? (
          <>
            <p className="placement-kicker">{t('placement.kicker').replace('{n}', String(total))}</p>
            <h2 tabIndex={-1} ref={heading}>{t('placement.title')}</h2>
            <p className="placement-copy">{t('placement.intro')}</p>
            <div className="placement-actions">
              <Button type="button" onClick={() => setStarted(true)}>{t('placement.start')}</Button>
              <Button type="button" variant="secondary" onClick={onExit}>{t('placement.skip')}</Button>
            </div>
          </>
        ) : (
          <form className="placement-form" onSubmit={submit}>
            <h2 className="placement-question-count" tabIndex={-1} ref={heading}>
              {t('placement.questionCount').replace('{current}', String(answers.length + 1)).replace('{total}', String(total))}
            </h2>
            <progress className="placement-progress" value={answers.length} max={total} aria-label={t('placement.progress')} />
            <fieldset disabled={saving} key={answers.length} className="placement-question">
              <legend lang="en">
                {question.text}
                {question.prompt && <span>{question.prompt}</span>}
              </legend>
              {question.options.map((option, i) => (
                <label className="placement-option" key={option} lang="en">
                  <input type="radio" name="placement-answer" checked={selection === i} onChange={() => setSelection(i)} />
                  <span>{option}</span>
                </label>
              ))}
              <label className="placement-option placement-unknown">
                <input type="radio" name="placement-answer" checked={selection === null} onChange={() => setSelection(null)} />
                <span>{t('placement.unknown')}</span>
              </label>
            </fieldset>
            {saveFailed && <p role="alert">{t('placement.saveFailed')}</p>}
            <div className="placement-actions">
              <Button type="submit" disabled={selection === undefined || saving}>
                {t(answers.length === total - 1 ? 'placement.finish' : 'placement.next')}
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={onExit}>{t('placement.exit')}</Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
