'use client';

import {useState} from 'react';
import type {Action, Player} from '../lib/engine';

export function LinkedTeammates({players, busy, onAction}: {
  players: Player[];
  busy: boolean;
  onAction: (action: Action) => void;
}) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const eligible = players.filter(player => !player.partnerId && player.status !== 'checkedOut')
    .sort((a, b) => a.name.localeCompare(b.name));
  const pairs = players.flatMap(player => {
    if (!player.partnerId || player.id >= player.partnerId) return [];
    const partner = players.find(other => other.id === player.partnerId);
    return partner ? [{player, partner}] : [];
  });

  return <>
    <h2 id="modal-title">Linked teammates</h2>
    <p>Both players take the later queue spot and play future games as teammates. If one takes a break, both wait. Checkout removes the link.</p>
    {pairs.length > 0 && <ul className="linked-pair-list" aria-label="Current teammate links">
      {pairs.map(({player, partner}) => <li key={player.id}>
        <span>{player.name} &amp; {partner.name}</span>
        <button type="button" className="btn outline" disabled={busy}
          aria-label={`Unlink ${player.name} and ${partner.name}`}
          onClick={() => onAction({type: 'unlinkPartners', playerId: player.id})}>Unlink</button>
      </li>)}
    </ul>}
    {eligible.length >= 2 ? <form onSubmit={event => {
      event.preventDefault();
      onAction({type: 'linkPartners', playerId: first, partnerId: second});
    }}>
      <label className="field">First player<select value={first} required onChange={event => setFirst(event.target.value)}>
        <option value="">Choose a player</option>
        {eligible.filter(player => player.id !== second).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select></label>
      <label className="field">Second player<select value={second} required onChange={event => setSecond(event.target.value)}>
        <option value="">Choose a teammate</option>
        {eligible.filter(player => player.id !== first).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select></label>
      <button type="submit" className="btn primary full-width" disabled={busy || !eligible.some(player => player.id === first) || !eligible.some(player => player.id === second)}>
        Link teammates
      </button>
    </form> : <p className="form-hint">Two checked-in players without a linked teammate are needed to make a pair.</p>}
  </>;
}
