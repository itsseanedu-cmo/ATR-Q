import assert from 'node:assert/strict';
import {applyAction,emptySession,planMatches,pairKey,CAP,waiting,uniqueMet,upcomingPlans} from '../lib/engine.ts';
import {sessionResults} from '../lib/queue-modes.ts';
const now=1800000000000;
let base=emptySession(now);
for(let i=0;i<8;i++)base=applyAction(base,{type:'addPlayers',names:['Mix '+i],skill:'3.5'},now+i);
const ids=base.players.map(player=>player.id);
const old=ids.slice(0,4),others=ids.slice(4);
for(const group of [old,others]){
 base.partners[pairKey(group[0],group[1])]=1;
 base.partners[pairKey(group[2],group[3])]=1;
 for(const a of group.slice(0,2))for(const b of group.slice(2))base.opponents[pairKey(a,b)]=1;
}
base.players.forEach((player,i)=>{
 player.waitSince=i<4?now-24*60*60000:now;
 player.missed=0;
 player.games=1;
 player.queueAhead=[];
});
for(const mode of ['atr','social','balanced','skill','skillCourts','mixed','clubs','ladder']){
 const s=structuredClone(base);s.queueMode=mode;s.fifo=false;
 s.players.forEach((player,i)=>{player.division=i%2?'men':'women';player.side=i%2?'A':'B';});
 const plan=planMatches(s,1,now+1)[0];
 assert(plan,mode+' should have an eligible match');
 const assigned=plan.teams.flat();
 assert(assigned.some(id=>old.includes(id))&&assigned.some(id=>others.includes(id)),mode+' must mix the groups despite queue timing');
 if(mode==='clubs')assert(plan.teams.every(team=>s.players.find(p=>p.id===team[0]).side===s.players.find(p=>p.id===team[1]).side));
}
for(const fifo of [false,true]){
 const s=structuredClone(base);s.queueMode='atr';s.fifo=fifo;
 const chosen=planMatches(s,1,now)[0].teams.flat();
 assert(chosen.some(id=>old.includes(id))&&chosen.some(id=>others.includes(id)),'ATR keeps fresh groups with FIFO on or off');
}
for(const mode of ['atrResults','results']){
 let s=structuredClone(base);s.queueMode=mode;s.fifo=false;
 s.history=[old,others].map((group,index)=>({
  id:'past'+index,court:'Court '+(index+1),teams:[group.slice(0,2),group.slice(2)],names:[['One','Two'],['Three','Four']],
  endedAt:now-1000,duration:1000,score:'11 – 9',reason:'Game completed',
 }));
 const outcomes=sessionResults(s).latest;
 const plans=planMatches(s,2,now+1);
 assert.equal(plans.length,2);
 for(const plan of plans){
  assert.equal(new Set(plan.teams.flat().map(id=>outcomes.get(id))).size,1,mode+' preserves result groups');
  assert(plan.teams.every(([a,b])=>!s.partners[pairKey(a,b)]),mode+' chooses new teammates with the same result');
 }
 s.players=s.players.slice(0,4);
 assert.equal(planMatches(s,1,now+1)[0].resultFallback,true,mode+' allows a small-queue fallback');
}
const tied=structuredClone(base);tied.queueMode='atr';tied.partners={};tied.opponents={};
assert.deepEqual(new Set(planMatches(tied,1,now)[0].teams.flat()),new Set(old));
for(const mode of ['atr','social','balanced']){
 const s=structuredClone(base);s.queueMode=mode;
 s.players.forEach(player=>{player.waitSince=now;player.missed=0;});
 s.history=[old,others].map((group,index)=>({
  id:'finished'+index,court:'Court '+(index+1),teams:[group.slice(0,2),group.slice(2)],names:[['One','Two'],['Three','Four']],
  endedAt:now,duration:900000,score:'Not recorded',reason:'Batch rotation',
 }));
 const plans=planMatches(s,2,now+1);
 assert.equal(plans.length,2);
 assert.equal(new Set(plans.flatMap(plan=>plan.teams.flat())).size,8);
 assert(plans.every(plan=>plan.teams.flat().some(id=>old.includes(id))&&plan.teams.flat().some(id=>others.includes(id))),mode+' repeats a just-finished quartet');
}
for(const mode of ['atrResults','results']){
 const s=structuredClone(base);s.queueMode=mode;
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)s.partners[pairKey(ids[i],ids[j])]=1;
 delete s.partners[pairKey(ids[0],ids[2])];delete s.partners[pairKey(ids[1],ids[3])];
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)s.opponents[pairKey(ids[i],ids[j])]=50;
 s.history=Array.from({length:4},(_,index)=>({
  id:'winners'+index,court:'Court 1',teams:[[ids[index*2],ids[index*2+1]],['other1','other2']],
  names:[['One','Two'],['Other One','Other Two']],endedAt:now,duration:1000,score:'11 – 9',reason:'Game completed',
 }));
 const plan=planMatches(s,1,now+1)[0];
 assert(plan.teams.every(([a,b])=>!s.partners[pairKey(a,b)]),mode+' prefers new teammates even when their opponents repeat');
}
console.log('Fresh groups before waits, mode restrictions, FIFO ties, immediate rematches, result groups and new teammates passed.');

// Keep both courts moving with linked pairs and accept a replay when only four are available.
const limited=structuredClone(base);limited.queueMode='atr';
for(const [a,b] of [[0,1],[2,3],[4,5]]){
 limited.players[a].partnerId=ids[b];limited.players[b].partnerId=ids[a];
}
limited.history=[{id:'last',court:'Court 1',teams:[old.slice(0,2),old.slice(2)],names:[['One','Two'],['Three','Four']],
 endedAt:now,duration:900000,score:'Not recorded',reason:'Batch rotation'}];
assert.equal(planMatches(limited,2,now+1).length,2);
assert.equal(planMatches({...limited,players:limited.players.slice(0,4)},1,now+1).length,1);

// All 24 players check in together. Mixing should break up recurring batches.
let rotation=applyAction(emptySession(now),{type:'queueSettings',queueMode:'atr'},now);
rotation=applyAction(rotation,{type:'addPlayers',names:Array.from({length:24},(_,i)=>'Player '+(i+1))},now);
rotation.players.forEach((player,index)=>player.id='p'+(index+1));
for(let wave=1;wave<=16;wave++){
 rotation=applyAction(rotation,{type:'fill'},now+wave*CAP);
 assert(rotation.courts.every(court=>court.match));
 assert(waiting(rotation).every(player=>player.missed<=3));
 rotation=applyAction(rotation,{type:'endAll'},now+wave*CAP+CAP-1);
}
assert.equal(rotation.history.length,32);
assert(rotation.players.every(player=>uniqueMet(rotation,player.id)>=12));

const cachedQuartets = structuredClone(base);
cachedQuartets.queueMode = 'atr';
cachedQuartets.fifo = true;
cachedQuartets.sharedNext = [
  {teams: [old.slice(0, 2), old.slice(2)], penalty: 0},
  {teams: [others.slice(0, 2), others.slice(2)], penalty: 0},
];
assert(upcomingPlans(cachedQuartets).every(plan => {
  const assigned = plan.teams.flat();
  return assigned.some(id => old.includes(id)) && assigned.some(id => others.includes(id));
}), 'Cached lineups from strict FIFO must be replaced with fresh social groups');
console.log('Cached strict-FIFO quartets are refreshed for social mixing.');
