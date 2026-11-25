import type {Session} from './engine';
import {scoredGames} from './queue-modes.ts';

export type StandingsSnapshot = {players:{name:string;games:number}[];history:Session['history']};
export type StandingsCutoffs = {resetAt?:number; players?:Record<string,number>};
export type GlobalRow = {
  id:string; name:string; games:number; wins:number; losses:number; diff:number; sessions:number;
};
export const playerRecordKey = (name:string) => 'p:' + name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();

export function globalStandings(sessions:StandingsSnapshot[], cutoffs:StandingsCutoffs = {}):GlobalRow[] {
  const rows = new Map<string,GlobalRow>();
  for (const session of sessions) {
    const local = new Map<string,GlobalRow>();
    const cutoffFor = (id:string) => Math.max(cutoffs.resetAt ?? 0, cutoffs.players?.[id] ?? 0);
    const rowFor = (name:string) => {
      const id = playerRecordKey(name);
      let row = local.get(id);
      if (!row) {
        row = {id,name:name.trim().replace(/\s+/g,' '),games:0,wins:0,losses:0,diff:0,sessions:0};
        local.set(id,row);
      }
      return row;
    };
    // Completed games count even when no score was recorded.
    for (const game of session.history) {
      const seen = new Set<string>();
      for (const name of game.names.flat()) {
        const row = rowFor(name);
        if (game.endedAt > cutoffFor(row.id) && !seen.has(row.id)) row.games++;
        seen.add(row.id);
      }
    }
    // Preserve game totals from sessions created before the complete history was retained.
    for (const player of session.players) {
      const row = rowFor(player.name);
      if (!cutoffFor(row.id)) row.games = Math.max(row.games, player.games);
    }
    for (const {game,points,winner} of scoredGames(session)) {
      game.names.forEach((team,index) => {
        for (const name of team) {
          const row = rowFor(name);
          if (game.endedAt <= cutoffFor(row.id)) continue;
          if (index === winner) row.wins++; else row.losses++;
          if (points) row.diff += points[index] - points[1-index];
        }
      });
    }
    for (const row of local.values()) {
      if (!row.games) continue;
      const total = rows.get(row.id) ?? {...row,games:0,wins:0,losses:0,diff:0,sessions:0};
      total.games += row.games;
      total.wins += row.wins;
      total.losses += row.losses;
      total.diff += row.diff;
      total.sessions++;
      rows.set(row.id,total);
    }
  }
  return [...rows.values()].sort((a,b) => b.wins-a.wins || a.losses-b.losses || b.diff-a.diff || a.name.localeCompare(b.name));
}
