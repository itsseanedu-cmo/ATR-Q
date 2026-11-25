import assert from 'node:assert/strict';
import {activePlayers,applyAction,demoSession,emptySession,effectiveFast,fastRules,planMatches,remaining,rotationGames,waiting,CAP,pairKey} from '../lib/engine.ts';
const t=1800000000000;
let s=demoSession(t);
assert.equal(s.players.length,24);assert.equal(s.courts.filter(c=>c.match).length,2);assert.equal(waiting(s).length,16);assert(fastRules(s));
assert.equal(remaining(s.courts[0].match,t),7*60000);
assert.equal(remaining(s.courts[0].match,t+4*60000),3*60000);
assert.equal(remaining(s.courts[0].match,t+7*60000),0);
assert.throws(()=>applyAction(s,{type:'timer',courtId:'c1'},t),/cannot pause/);
const original=JSON.stringify(s),plans=planMatches(s,2,t),selected=plans.flatMap(p=>p.teams.flat());
assert.equal(plans.length,2);assert.equal(new Set(selected).size,8);assert.equal(JSON.stringify(s),original);
const oldest=waiting(s).sort((a,b)=>a.waitSince-b.waitSince).slice(0,4).map(p=>p.id);assert(selected.some(id=>oldest.includes(id)));
for(const plan of plans){let score=0;for(const team of plan.teams)score+=100*(s.partners[pairKey(...team)]||0);for(const a of plan.teams[0])for(const b of plan.teams[1])score+=35*(s.opponents[pairKey(a,b)]||0);assert.equal(plan.penalty,score);}
let maxMissed=0,maxSpread=0;
for(let r=1;r<=90;r++){
 const prior=structuredClone(s);s=applyAction(s,{type:'simulate'},t+r*CAP);
 const on=s.courts.flatMap(c=>c.match.teams.flat());assert.equal(new Set(on).size,8);assert(s.players.filter(p=>p.status==='playing').every(p=>on.includes(p.id)));
 const must=prior.players.filter(p=>p.status==='waiting'&&p.missed>=3);assert(must.every(p=>on.includes(p.id)),'Players at the overdue guard must play in the next paired round');
 maxMissed=Math.max(maxMissed,...waiting(s).map(p=>p.missed));assert(maxMissed<=3,'The overdue safeguard must prevent prolonged waits');
 const games=activePlayers(s).map(p=>p.games);maxSpread=Math.max(maxSpread,Math.max(...games)-Math.min(...games));assert(maxSpread<=1,'Social mixing must keep game opportunities balanced');
}
assert.equal(s.history.length,180);
const ended=applyAction(s,{type:'endAll'},t+91*CAP);assert(ended.courts.every(c=>!c.match));const filled=applyAction(ended,{type:'fill'},t+91*CAP);assert(filled.courts.every(c=>c.match));
const noGames=applyAction(demoSession(t),{type:'clear'},t);let fresh=applyAction(noGames,{type:'addPlayers',names:Array.from({length:24},(_,i)=>'Player '+i)},t);assert(fresh.players.every(p=>p.games===0));
assert.throws(()=>applyAction(fresh,{type:'addPlayers',names:['Overflow']},t),/capacity/);
const paused=applyAction(fresh,{type:'pausePlayer',playerId:fresh.players[23].id},t);assert.equal(activePlayers(paused).length,23);const added=applyAction(paused,{type:'addPlayers',names:['New arrival']},t);assert.equal(added.players.at(-1).games,0);assert.throws(()=>applyAction(added,{type:'pausePlayer',playerId:added.players[23].id},t),/capacity/);
let low=emptySession(t);low=applyAction(low,{type:'addPlayers',names:Array.from({length:8},(_,i)=>'Low '+i)},t);low=applyAction(low,{type:'fill'},t);assert(!fastRules(low));assert(!effectiveFast(low));
let frozen=applyAction(low,{type:'timer',courtId:'c1'},t+60000);assert.equal(remaining(frozen.courts[0].match,t+600000),CAP-60000);frozen=applyAction(frozen,{type:'timer',courtId:'c1'},t+600000);assert.equal(remaining(frozen.courts[0].match,t+660000),CAP-120000);
assert.throws(()=>applyAction(low,{type:'end',courtId:'c1',scoreA:'11',scoreB:'10'},t),/two-point/);
assert.throws(()=>applyAction(demoSession(t),{type:'end',courtId:'c1',scoreA:'12',scoreB:'10'},t),/ends at 11/);
assert.doesNotThrow(()=>applyAction(demoSession(t),{type:'end',courtId:'c1',scoreA:'11',scoreB:'10'},t));
assert.doesNotThrow(()=>applyAction(demoSession(t),{type:'end',courtId:'c1',scoreA:'5',scoreB:'5'},t+CAP));
const swapBase=demoSession(t),beforeStart=swapBase.courts[0].match.startedAt,out=swapBase.courts[0].match.teams[0][0],incoming=waiting(swapBase)[0].id;const swapped=applyAction(swapBase,{type:'swap',courtId:'c1',outgoingId:out,incomingId:incoming},t+5000);assert.equal(swapped.courts[0].match.startedAt,beforeStart);assert.equal(swapped.players.find(p=>p.id===out).status,'waiting');assert.equal(swapped.players.find(p=>p.id===incoming).status,'playing');
assert.throws(()=>applyAction(swapped,{type:'pausePlayer',playerId:incoming},t),/Swap/);
assert.throws(()=>applyAction(s,{type:'settings',primary:'red',accent:'#FFFFFF'},t),/hex/);
assert.throws(()=>applyAction(s,{type:'settings',primary:'#0B2E63',accent:'#E8FF4D',logo:'javascript:alert(1)'},t),/Upload/);
console.log(JSON.stringify({passed:true,pairedRounds:90,maxMissed,maxGameSpread:maxSpread,historyEntries:s.history.length,checks:'batch uniqueness, overdue safeguard, game opportunities, capacity, timers, scoring, swaps, input validation'}));
