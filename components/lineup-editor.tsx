'use client';

import { useState } from 'react';
import type { Player } from '../lib/engine';

const slots = ['Team A · Player 1', 'Team A · Player 2', 'Team B · Player 1', 'Team B · Player 2'];

export function LineupEditor({ initial, players, busy, onSave, onClear }: {
  initial: string[];
  players: Player[];
  busy: boolean;
  onSave: (ids: string[]) => void;
  onClear?: () => void;
}) {
  const [ids, setIds] = useState(() => slots.map((_, index) => initial[index] ?? ''));
  const eligible = new Set(players.map(player => player.id));
  const complete = ids.every(id => eligible.has(id)) && new Set(ids).size === 4;

  function choose(index: number, id: string) {
    setIds(previous => {
      const next = [...previous];
      const otherSlot = id ? previous.indexOf(id) : -1;
      if (otherSlot >= 0) next[otherSlot] = previous[index];
      next[index] = id;
      return next;
    });
  }

  return <form onSubmit={event => { event.preventDefault(); if (complete) onSave(ids); }}>
    <div className="lineup-slots">{slots.map((label, index) =>
      <label className="field" key={label}>{label}
        <select value={ids[index]} onChange={event => choose(index, event.target.value)} disabled={busy}>
          <option value="">Choose player</option>
          {ids[index] && !eligible.has(ids[index]) && <option value={ids[index]} disabled>Player unavailable</option>}
          {players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
      </label>
    )}</div>
    <button type="submit" className="btn primary full-width" disabled={busy || !complete}>Save lineup</button>
    {onClear && <button type="button" className="btn outline full-width" disabled={busy} onClick={onClear}>Use automatic pairing</button>}
  </form>;
}
