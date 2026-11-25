'use client';

import {useState} from 'react';
import type {Action, Session} from '../lib/engine';
import {QUEUE_MODES} from '../lib/queue-modes';

export function MatchingSettings({session, disabled, onSave}: {
  session: Session;
  disabled: boolean;
  onSave: (action: Action) => void;
}) {
  const [mode, setMode] = useState(session.queueMode ?? 'social');
  const [clubA, setClubA] = useState(session.clubs?.A ?? '');
  const [clubB, setClubB] = useState(session.clubs?.B ?? '');
  return <section className="surface settings-panel">
    <h2>Matching mode</h2>
    <p className="muted">Restricted formats may leave courts open. Manage player ratings, divisions and club assignments in Players &amp; queue.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSave({
        type: 'queueSettings', queueMode: mode,
        fifo: data.has('fifo'), showStandings: data.has('standings'), selfCheckin: data.has('selfCheckin'), capacityLimit: data.has('capacityLimit'),
        ...(mode === 'clubs' ? {clubA, clubB} : {}),
      });
    }}>
      <fieldset disabled={disabled} className="matching-options">
        <legend className="sr-only">Choose a matching mode</legend>
        {QUEUE_MODES.map(([key,label,description]) => <label className="matching-option" key={key}>
          <input type="radio" name="mode" value={key} checked={mode === key} onChange={() => setMode(key)} />
          <span><strong>{label}</strong><small>{description}</small></span>
        </label>)}
        {mode === 'clubs' && <div className="club-wars-settings">
          <label className="field">First club name<input value={clubA} onChange={event=>setClubA(event.target.value)} required maxLength={60}/></label>
          <label className="field">Second club name<input value={clubB} onChange={event=>setClubB(event.target.value)} required maxLength={60}/></label>
          <p className="muted">Players choose their club at check-in. Assign clubs to any players already checked in.</p>
        </div>}
        <label className="toggle-row"><span><strong>First in, first out</strong><small>{mode==='atr'?'New arrivals wait behind players already queued. On uses queue order to break ties between equally fresh matches. Off considers waiting time and missed rotations. Fresh partners and opponents stay the priority.':'For equally fresh matches, on follows queue order and off considers waiting time and missed rotations. Late arrivals join at the back. Matching mode priorities come first.'}</small></span><input type="checkbox" name="fifo" defaultChecked={session.fifo??false}/></label>
        <label className="toggle-row"><span><strong>Show live standings on the QR board</strong></span><input type="checkbox" name="standings" defaultChecked={session.showStandings}/></label>
        <label className="toggle-row"><span><strong>Limit players to 12 per court</strong><small>{session.courts.length * 12} active players with {session.courts.length} courts. Turn off to allow more check-ins, up to the 100-player session limit.</small></span><input type="checkbox" role="switch" name="capacityLimit" defaultChecked={session.capacityLimit!==false}/></label>
        <label className="toggle-row"><span><strong>Allow player self-check-in</strong><small>Players with the check-in QR can join until active capacity is full.</small></span><input type="checkbox" name="selfCheckin" defaultChecked={session.selfCheckin}/></label>
      </fieldset>
      <button className="btn primary full-width" type="submit" disabled={disabled}>Save queue settings</button>
    </form>
  </section>;
}
