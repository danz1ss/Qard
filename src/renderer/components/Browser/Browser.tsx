import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import {
  CardSearchResult,
  CardState,
  CardStatusFilter,
  StoredCard
} from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';
import CardEditModal from './CardEditModal';
import { stripTags } from '../Review/htmlText';
import { useT } from '../../prefs/PreferencesProvider';
import './Browser.css';

const PAGE_SIZE = 50;

const Browser: React.FC = () => {
  const t = useT();
  const { decks, refreshDecks } = useStore();

  const STATE_LABELS: Record<CardState, string> = {
    [CardState.New]: t('browse.stateNew'),
    [CardState.Learning]: t('browse.stateLearning'),
    [CardState.Review]: t('browse.stateReview'),
    [CardState.Relearning]: t('browse.stateRelearning')
  };
  const [text, setText] = useState('');
  const [deckId, setDeckId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<CardSearchResult>({ total: 0, cards: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<StoredCard | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  useEffect(() => {
    refreshDecks();
  }, []);

  // Поиск с дебаунсом 300 мс
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await window.electronAPI.collection.searchCards({
        text: text.trim() || undefined,
        deckId: deckId ? parseInt(deckId) : undefined,
        status: (status || undefined) as CardStatusFilter | undefined,
        tag: tag.trim() || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      });
      setResult(r);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(t);
  }, [text, deckId, status, tag, page, reloadKey]);

  // Сброс страницы при смене фильтров
  useEffect(() => {
    setPage(0);
  }, [text, deckId, status, tag]);

  const refresh = () => {
    setReloadKey((k) => k + 1);
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const bulkDelete = async () => {
    await window.electronAPI.collection.deleteCards([...selected]);
    setConfirmingBulk(false);
    refresh();
  };

  const bulkMove = async () => {
    if (selected.size === 0 || !moveTarget) return;
    await window.electronAPI.collection.moveCards([...selected], parseInt(moveTarget));
    refresh();
  };

  const deckName = (id: number) => decks.find((d) => d.id === id)?.name ?? '?';
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const deckOptions = [
    { value: '', label: t('browse.allDecks') },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];
  const statusOptions = [
    { value: '', label: t('browse.anyStatus') },
    { value: 'new', label: t('browse.stateNew') },
    { value: 'learning', label: t('browse.stateLearning') },
    { value: 'review', label: t('browse.stateReview') }
  ];

  return (
    <div className="browser">
      <h2>{t('browse.title')}</h2>

      <div className="browser-filters">
        <Input
          label={t('browse.search')}
          className="browser-search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('browse.searchPlaceholder')}
        />
        <Select
          label={t('browse.deck')}
          value={deckId}
          onChange={(v) => setDeckId(v)}
          options={deckOptions}
        />
        <Select
          label={t('browse.status')}
          value={status}
          onChange={(v) => setStatus(v)}
          options={statusOptions}
        />
        <Input
          label={t('browse.tag')}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="imported"
        />
      </div>

      <p>{t('browse.cardsFound').replace('{n}', String(result.total))}</p>

      {selected.size > 0 && (
        <div className="browser-bulk">
          <span>{t('browse.selected').replace('{n}', String(selected.size))}</span>
          <Button size="small" variant="danger" onClick={() => setConfirmingBulk(true)}>
            {t('modal.delete')}
          </Button>
          <Select
            value={moveTarget}
            onChange={(v) => setMoveTarget(v)}
            options={[{ value: '', label: t('browse.moveTo') }, ...decks.map((d) => ({ value: String(d.id), label: d.name }))]}
          />
          <Button size="small" onClick={bulkMove} disabled={!moveTarget}>
            {t('browse.move')}
          </Button>
        </div>
      )}

      <table className="browser-table">
        <thead>
          <tr>
            <th></th>
            <th>{t('browse.colWord')}</th>
            <th>{t('browse.colDefinition')}</th>
            <th>{t('browse.colDeck')}</th>
            <th>{t('browse.colStatus')}</th>
            <th>{t('browse.colDue')}</th>
          </tr>
        </thead>
        <tbody>
          {result.cards.map((card) => (
            <tr key={card.id} onClick={() => setEditing(card)}>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(card.id)}
                  onChange={() => toggle(card.id)}
                />
              </td>
              <td>{card.word}</td>
              <td className="browser-def">{stripTags(card.definition)}</td>
              <td>{deckName(card.deckId)}</td>
              <td>{STATE_LABELS[card.state]}</td>
              <td>
                {card.state === CardState.New
                  ? '—'
                  : new Date(card.due).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="browser-pagination">
        <Button size="small" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
          {t('browse.prev')}
        </Button>
        <span>
          {t('browse.page').replace('{cur}', String(page + 1)).replace('{total}', String(pages))}
        </span>
        <Button
          size="small"
          variant="secondary"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          {t('browse.next')}
        </Button>
      </div>

      {editing && (
        <CardEditModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {confirmingBulk && (
        <ConfirmModal
          title={t('browse.deleteCardsTitle')}
          message={t('browse.deleteCardsMsg').replace('{n}', String(selected.size))}
          confirmLabel={t('modal.delete')}
          onConfirm={bulkDelete}
          onClose={() => setConfirmingBulk(false)}
        />
      )}
    </div>
  );
};

export default Browser;
