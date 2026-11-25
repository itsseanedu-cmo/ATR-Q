import type {sessionResults} from '../lib/queue-modes';

type Rows = ReturnType<typeof sessionResults>['standings'];

export function Standings({rows, final = false}: {rows: Rows; final?: boolean}) {
  const content = <>
    <p>Ranked by wins, then fewest losses and point differential. Recorded wins and losses count. Point difference applies to games with scores.</p>
    {rows.length > 0 ? <table>
      <thead><tr><th scope="col">Player</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">+/−</th><th scope="col">Win streak</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <th scope="row">{row.name}<small className="standings-games">{row.games} {row.games===1?'game':'games'} played</small></th><td>{row.wins}</td><td>{row.losses}</td>
        <td>{row.diff > 0 ? '+' : ''}{row.diff}</td><td>{row.streak}</td>
      </tr>)}</tbody>
    </table> : <p>{final ? 'No wins or losses were recorded.' : 'Standings will appear once an organizer records a winner.'}</p>}
  </>;

  return final
    ? <section className="surface standings" id="standings"><h2>Final standings</h2>{content}</section>
    : <details className="surface standings" id="standings"><summary>Live standings</summary>{content}</details>;
}
