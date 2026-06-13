import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DeckWithCounts } from '../../../shared/types';
import Button from '../common/Button';
import Input from '../common/Input';
import './Decks.css';

const Decks: React.FC = () => {
  const { decks, refreshDecks } = useStore();
  const [newDeckName, setNewDeckName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<DeckWithCounts | null>(null);
  const [limitNew, setLimitNew] = useState('20');
  const [limitRev, setLimitRev] = useState('200');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    refreshDecks();
  }, []);

  const handleCreate = async () => {
    if (!newDeckName.trim()) return;
    setError(null);
    try {
      await window.electronAPI.collection.createDeck(newDeckName.trim());
      setNewDeckName('');
      await refreshDecks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startRename = (deck: DeckWithCounts) => {
    setRenamingId(deck.id);
    setRenameValue(deck.name);
  };

  const confirmRename = async (deck: DeckWithCounts) => {
    if (!renameValue.trim()) return;
    await window.electronAPI.collection.renameDeck(deck.id, renameValue.trim());
    setRenamingId(null);
    await refreshDecks();
  };

  const cancelRename = () => {
    setRenamingId(null);
  };

  const handleDelete = async (deck: DeckWithCounts) => {
    const ok = window.confirm(
      `Удалить колоду «${deck.name}» и все её карточки (${deck.totalCards} шт.)?`
    );
    if (!ok) return;
    await window.electronAPI.collection.deleteDeck(deck.id);
    await refreshDecks();
  };

  const openLimits = (deck: DeckWithCounts) => {
    setEditingLimits(deck);
    setLimitNew(String(deck.newPerDay));
    setLimitRev(String(deck.reviewsPerDay));
  };

  const saveLimits = async () => {
    if (!editingLimits) return;
    await window.electronAPI.collection.updateDeckLimits(
      editingLimits.id,
      Math.max(0, parseInt(limitNew) || 0),
      Math.max(0, parseInt(limitRev) || 0)
    );
    setEditingLimits(null);
    await refreshDecks();
  };

  return (
    <div className="decks">
      <h2>Колоды</h2>
      <p className="description">
        Новые / Учатся / К повторению. Кликни «Учить», чтобы начать.
      </p>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p>Пока нет колод. Создай первую ниже или импортируй из Anki.</p>
        </div>
      ) : (
        <table className="decks-table">
          <thead>
            <tr>
              <th>Колода</th>
              <th>Новые</th>
              <th>Учатся</th>
              <th>Повтор</th>
              <th>Всего</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck) => (
              <tr key={deck.id}>
                <td className="deck-name">
                  {renamingId === deck.id ? (
                    <>
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                      />
                      <Button size="small" onClick={() => confirmRename(deck)}>✓</Button>
                      <Button size="small" variant="secondary" onClick={cancelRename}>✕</Button>
                    </>
                  ) : (
                    deck.name
                  )}
                </td>
                <td className="count-new">{deck.newCount}</td>
                <td className="count-learn">{deck.learnCount}</td>
                <td className="count-due">{deck.dueCount}</td>
                <td>{deck.totalCards}</td>
                <td>
                  <div className="deck-actions">
                    <Button size="small" variant="secondary" onClick={() => startRename(deck)}>
                      Переименовать
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => openLimits(deck)}>
                      Лимиты
                    </Button>
                    <Button size="small" variant="danger" onClick={() => handleDelete(deck)}>
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingLimits && (
        <div className="settings-section">
          <h3>Лимиты «{editingLimits.name}»</h3>
          <div className="deck-limits-row">
            <label>Новых в день:</label>
            <input value={limitNew} onChange={(e) => setLimitNew(e.target.value)} />
            <label>Повторений в день:</label>
            <input value={limitRev} onChange={(e) => setLimitRev(e.target.value)} />
            <Button size="small" onClick={saveLimits}>Сохранить</Button>
            <Button size="small" variant="secondary" onClick={() => setEditingLimits(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      <div className="deck-create-row">
        <Input
          label="Новая колода"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          placeholder="Название колоды"
        />
        <Button onClick={handleCreate}>Создать</Button>
      </div>
      {error && <p className="help-text error">{error}</p>}
    </div>
  );
};

export default Decks;
