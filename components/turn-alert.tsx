'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { Court, Plan, Player } from '../lib/engine';

export function TurnAlert({ players, courts, plans, online }: {
  players: Player[];
  courts: Court[];
  plans: Plan[];
  online: boolean;
}) {
  const [selectedId, setSelectedId] = useState('');
  const lastAlert = useRef('');
  const audio = useRef<AudioContext | null>(null);
  const player = players.find(person => person.id === selectedId);
  const firstSharedGroup = plans.find(plan => !plan.courtId);
  const next = player && plans.find(plan =>
    (plan.courtId || plan === firstSharedGroup) && plan.teams.flat().includes(player.id)
  );
  const court = player && courts.find(item => item.match?.teams.flat().includes(player.id));
  const nextCourtName = courts.find(item => item.id === next?.courtId)?.name;
  const alertKey = online && player && (court ? player.id + ':' + court.match!.id : next ? player.id + ':next' : '');

  useEffect(() => {
    if (!alertKey) {
      lastAlert.current = '';
      return;
    }
    if (lastAlert.current === alertKey) return;
    lastAlert.current = alertKey;
    navigator.vibrate?.([180, 90, 180]);
    const context = audio.current;
    if (context?.state !== 'running') return;
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.frequency.value = 740;
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
    tone.connect(gain).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.45);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }, [alertKey]);

  useEffect(() => () => { void audio.current?.close(); audio.current = null; }, []);

  return <section className="surface turn-alert">
    <label className="field"><span><Bell size={16} /> Notify me when I’m up next</span>
      <select value={player?.id ?? ''} onChange={event => {
        const id = event.target.value;
        setSelectedId(id);
        if (!id) return;
        try {
          audio.current ??= new AudioContext();
          void audio.current.resume().catch(() => {});
        } catch { /* The visual alert still works when audio is unavailable. */ }
      }}>
        <option value="">Choose your name</option>
        {[...players].sort((a, b) => a.name.localeCompare(b.name)).map(person =>
          <option key={person.id} value={person.id}>{person.name}</option>
        )}
      </select>
    </label>
    <p className="turn-help">Keep this board open for an on-screen alert and a chime when supported.</p>
    <div aria-live="polite" aria-atomic="true">
      {online && player && (court || next) && <div className="turn-call" role="status">
        <Bell size={20} />
        <strong>{court ? player.name + ', you’re on ' + court.name + '!' : player.name + ', you’re up next' + (nextCourtName ? ' on ' + nextCourtName + '!' : '. Wait for your court assignment.')}</strong>
      </div>}
    </div>
  </section>;
}
