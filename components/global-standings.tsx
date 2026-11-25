'use client';
import {useEffect,useState,useCallback} from 'react';
import type {GlobalRow} from '../lib/global-standings';

export function GlobalStandings({sessionId,token,admin}: {sessionId:string;token:string;admin:boolean}) {
 const [rows,setRows]=useState<GlobalRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [confirmation,setConfirmation]=useState<GlobalRow|'all'|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch('/api/session?id='+encodeURIComponent(sessionId)+'&standings=global',{cache:'no-store'});
   const data=await response.json() as {rows:GlobalRow[];error?:string};
   if(!response.ok)throw Error(data.error||'Unable to load global standings.');
   setRows(data.rows);setError('');
  }catch(error){setError(error instanceof Error?error.message:'Unable to load global standings.');}
  finally{setLoading(false);}
 },[sessionId]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[refresh]);
 async function remove(){
  if(!confirmation)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({type:confirmation==='all'?'resetGlobalStandings':'deleteGlobalPlayer',id:sessionId,
     playerKey:confirmation==='all'?undefined:confirmation.id})});
   const data=await response.json() as {rows:GlobalRow[];error?:string};
   if(!response.ok)throw Error(data.error||'Unable to delete records.');
   setRows(data.rows);setConfirmation(null);
  }catch(error){setError(error instanceof Error?error.message:'Unable to delete records.');}
  finally{setBusy(false);}
 }
 return <>
  <h2 id="modal-title">Global standings</h2>
  <p>Games across linked open plays. Use the same player name each time. Rankings follow wins, losses and point difference. Point difference applies to games with scores.</p>
  {loading?<p role="status">Loading records…</p>:rows.length>0?<div className="global-table-scroll"><table className="global-table">
   <thead><tr><th scope="col">Player</th><th scope="col">W</th><th scope="col">L</th><th scope="col">+/−</th>{admin&&<th scope="col">Manage</th>}</tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}>
    <th scope="row">{row.name}<small>{row.games} games · {row.sessions} {row.sessions===1?'session':'sessions'}</small></th>
    <td>{row.wins}</td><td>{row.losses}</td><td>{row.diff>0?'+':''}{row.diff}</td>
    {admin&&<td><button className="text-btn" disabled={busy} onClick={()=>setConfirmation(row)} aria-label={'Delete record for '+row.name}>Delete</button></td>}
   </tr>)}</tbody>
  </table></div>:<p>Records appear after players complete games in a live session.</p>}
  {admin&&rows.length>0&&<button className="btn danger-text full-width" disabled={busy} onClick={()=>setConfirmation('all')}>Reset all global standings</button>}
  {confirmation&&<div className="global-confirm" role="group" aria-label="Confirm deleting records">
   <p>{confirmation==='all'?'Reset every player’s global record?':'Delete the past global record for '+confirmation.name+'?'} Future games will build new totals.</p>
   <div className="modal-actions"><button className="btn outline" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button><button className="btn danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Confirm deletion'}</button></div>
  </div>}
  {error&&<p role="alert" className="error-message">{error}</p>}
 </>;
}
