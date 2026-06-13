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
import CardEditModal from './CardEditModal';
import './Browser.css';

const PAGE_SIZE = 50;

const STATE_LABELS: Record<CardState, string> = {
  [CardState.New]: 'Новая',
  [CardState.Learning]: 'Учится',
  [CardState.Review]: 'Повтор',
  [CardState.Relearning]: 'Переучивается'
};

const Browser: React.FC = () => {
  const { decks, refreshDecks } = useStore();
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
    if (selected.size === 0) return;
    if (!window.confirm(`Удалить выбранные карточки (${selected.size})?`)) return;
    await window.electronAPI.collection.deleteCards([...selected]);
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
    { value: '', label: 'Все колоды' },
    ...decks.map((d) => ({ value: String(d.id), label: d.name }))
  ];
  const statusOptions = [
    { value: '', label: 'Любой статус' },
    { value: 'new', label: 'Новые' },
    { value: 'learning', label: 'Учатся' },
    { value: 'review', label: 'Повтор' }
  ];

  return (
    <div className="browser">
      <h2>Карточки</h2>

      <div className="browser-filters">
        <Input
          label="Поиск"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Слово, определение, пример..."
        />
        <Select
          label="Колода"
          value={deckId}
          onChange={(e) => setDeckId(e.target.value)}
          options={deckOptions}
        />
        <Select
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
        />
        <Input
          label="Тег"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="imported"
        />
      </div>

      <p>{result.total} карточек найдено</p>

      {selected.size > 0 && (
        <div className="browser-bulk">
          <span>Выбрано: {selected.size}</span>
          <Button size="small" variant="danger" onClick={bulkDelete}>
            Удалить
          </Button>
          <Select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            options={[{ value: '', label: 'Переместить в...' }, ...decks.map((d) => ({ value: String(d.id), label: d.name }))]}
          />
          <Button size="small" onClick={bulkMove} disabled={!moveTarget}>
            Переместить
          </Button>
        </div>
      )}

      <table className="browser-table">
        <thead>
          <tr>
            <th></th>
            <th>Слово</th>
            <th>Определение</th>
            <th>Колода</th>
            <th>Статус</th>
            <th>Повтор</th>
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
              <td className="browser-def">{card.definition}</td>
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
          ← Назад
        </Button>
        <span>
          Стр. {page + 1} из {pages}
        </span>
        <Button
          size="small"
          variant="secondary"
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          Вперёд →
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
    </div>
  );
};

export default Browser;
