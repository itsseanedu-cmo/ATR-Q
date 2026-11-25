import assert from 'node:assert/strict';
import {emptySession,applyAction,demoSession,waiting,planMatches,upcomingPlans,pairKey,CAP} from '../lib/engine.ts';
import {globalStandings} from '../lib/global-standings.ts';
import {sessionResults} from '../lib/queue-modes.ts';
const now=1800000000000;
let s=applyAction(emptySession(now),{type:'queueSettings',queueMode:'atr',fifo:false,selfCheckin:true},now);
for(let i=0;i<16;i++)s=applyAction(s,{type:'selfCheckin',name:'ATR '+i,checkInKey:crypto.randomUUID()},now+i);
assert(s.players.every(p=>p.skill===''&&!p.side));
s.players.slice(0,12).forEach(p=>p.games=4);
assert.equal(waiting(s)[0].id,s.players[0].id);
assert.equal(waiting(s).at(-1).id,s.players.at(-1).id);
let fifo=applyAction(s,{type:'queueSettings',queueMode:'atr',fifo:true},now+20);
assert.deepEqual(new Set(planMatches(fifo,2,now+20).flatMap(p=>p.teams.flat())),new Set(s.players.slice(0,8).map(p=>p.id)));
const mixed=planMatches(s,2,now+20);
assert(s.players.slice(0,4).every(p=>mixed.flatMap(plan=>plan.teams.flat()).includes(p.id)));
const rerated=structuredClone(s);
rerated.players.forEach((p,i)=>{p.skill=i%2?'5.5':'1.0';p.side=i%2?'A':'B';});
assert.deepEqual(planMatches(rerated,2,now+20),mixed);
let maxMissed=0;
for(let round=0;round<24;round++){
  s=applyAction(s,{type:'simulate'},now+(round+1)*CAP);
  maxMissed=Math.max(maxMissed,...waiting(s).map(p=>p.missed));
}
assert(maxMissed<=3);
const met=s.players.map(a=>s.players.filter(b=>a.id!==b.id&&(s.partners[pairKey(a.id,b.id)]||s.opponents[pairKey(a.id,b.id)])).length);
assert(Math.min(...met)>=12,'Every player should meet most others over repeated rounds');
const result=sessionResults(s);
assert.deepEqual(result.standings,[]);
s=applyAction(s,{type:'end',courtId:'c1',winner:'A'},now+26*CAP);
const results=sessionResults(s).standings;
assert(results.length);
assert(results.every(row=>row.games===s.players.find(p=>p.id===row.id).games));
assert.equal(applyAction(s,{type:'clear'},now+27*CAP).fifo,false);
console.log('ATR optional rating, queue order, FIFO, variety, wait protection and standings games passed.',{maxMissed,minPlayersMet:Math.min(...met)});

for(const mode of ['atr','atrResults']){
 let resultSession=applyAction(emptySession(now),{type:'queueSettings',queueMode:mode,fifo:false,selfCheckin:true},now);
 for(let i=0;i<8;i++)resultSession=applyAction(resultSession,{type:'selfCheckin',name:mode+' '+i,checkInKey:crypto.randomUUID()},now+i);
 assert(resultSession.players.every(player=>!player.skill&&!player.side));
 resultSession=applyAction(resultSession,{type:'fill'},now+10);
 const game=resultSession.courts[0].match;
 assert.throws(()=>applyAction(resultSession,{type:'end',courtId:'c1',scoreA:'11',scoreB:'0'},now+20),/winning team/);
 assert.throws(()=>applyAction(resultSession,{type:'end',courtId:'c1',winner:'A',matchId:'old'},now+20),/changed/);
 const ended=applyAction(resultSession,{type:'end',courtId:'c1',matchId:game.id,winner:'B'},now+CAP);
 assert.equal(ended.history[0].winner,1);
 assert.equal(ended.history[0].score,'Team B won');
 const results=sessionResults(ended);
 for(const id of game.teams[1]){
  assert.equal(results.latest.get(id),'win');
  assert.equal(results.standings.find(row=>row.id===id).wins,1);
 }
 for(const id of game.teams[0])assert.equal(results.latest.get(id),'loss');
 assert(results.standings.every(row=>row.diff===0));
 assert(!results.highlights.some(item=>item.title==='Pickled!'||item.title==='Close fight'));
 assert.equal(globalStandings([ended]).reduce((sum,row)=>sum+row.wins,0),2);
 assert.equal(globalStandings([ended]).reduce((sum,row)=>sum+row.losses,0),2);
 assert(globalStandings([ended]).every(row=>row.diff===0));
 const noWinner=applyAction(resultSession,{type:'end',courtId:'c1',result:'unrecorded'},now+20);
 assert.equal(noWinner.history[0].winner,undefined);
 assert.equal(sessionResults(noWinner).standings.length,0);
 assert(noWinner.players.filter(player=>game.teams.flat().includes(player.id)).every(player=>player.games===1));
}
let split=applyAction(emptySession(now),{type:'queueSettings',queueMode:'atrResults',fifo:false},now);
for(let i=0;i<16;i++)split=applyAction(split,{type:'addPlayers',names:['Result '+i]},now+i);
split.history=Array.from({length:4},(_,i)=>{
 const ids=split.players.slice(i*4,i*4+4).map(player=>player.id);
 return {id:'past'+i,court:'Court 1',teams:[ids.slice(0,2),ids.slice(2)],names:[['A','B'],['C','D']],endedAt:now-10,duration:1000,score:'Team A won',reason:'Game completed',winner:0};
});
const latest=sessionResults(split).latest;
const grouped=planMatches(split,2,now+20);
assert.equal(grouped.length,2);
assert(grouped.every(plan=>new Set(plan.teams.flat().map(id=>latest.get(id))).size===1),'Winners and losers should form separate games when possible');
const small=structuredClone(split);
small.players=split.players.slice(0,3).concat(split.players.slice(6,9));
const fallback=planMatches(small,2,now+20);
assert.equal(fallback.length,1);
assert.equal(fallback[0].resultFallback,true);
split.players[15].missed=2;
assert(planMatches(split,2,now+20).flatMap(plan=>plan.teams.flat()).includes(split.players[15].id),'Due players must remain protected');
console.log('Both ATR modes, winner buttons, standings, global totals, result groups and small queue fallback passed.');
let rotation=applyAction(emptySession(now),{type:'queueSettings',queueMode:'atrResults',fifo:false},now);
for(let i=0;i<24;i++)rotation=applyAction(rotation,{type:'addPlayers',names:['Rotation '+i]},now+i);
rotation.players.forEach((player,index)=>player.id='rotation-'+index);
rotation=applyAction(rotation,{type:'fill'},now+30);
let worstWait=0;
for(let round=1;round<=30;round++){
 for(const court of rotation.courts){
  rotation=applyAction(rotation,{type:'end',courtId:court.id,winner:round%2?'A':'B'},now+round*CAP);
 }
 rotation=applyAction(rotation,{type:'fill'},now+round*CAP+1);
 worstWait=Math.max(worstWait,...waiting(rotation).map(player=>player.missed));
 assert(worstWait<=3,'Win Lose must keep overdue players moving');
}
assert.equal(rotation.history.length,60);
console.log('Thirty Win Lose rotations passed.',{worstWait});

for (const count of [20, 24]) for (const simultaneous of [false, true]) {
  let session = { ...demoSession(now), queueMode: 'atr' };
  session.players = session.players.slice(0, count);
  for (let turn = 0; turn < 12; turn++) {
    const at = now + (turn + 1) * CAP / (simultaneous ? 1 : 2);
    const courtId = simultaneous ? undefined : turn % 2 ? 'c2' : 'c1';
    session = applyAction(session, courtId
      ? { type: 'end', courtId, winner: 'A' }
      : { type: 'endAll' }, at);
    let queue = waiting(session);
    const starts = session.gameStarts ?? 0;
    const announced = upcomingPlans(session)[0].teams;
    session = applyAction(session, { type: 'fill', courtId }, at);
    const courts = session.courts.filter(court => !courtId || court.id === courtId);
    assert.deepEqual(courts[0].match.teams, announced);
    for (const [offset, court] of courts.entries()) {
      const ids = court.match.teams.flat();
      const eligible = queue.filter(player => (player.eligibleAfterStart ?? 0) <= starts + offset);
      assert.equal(ids.filter(id => eligible.some(player => player.id === id)).length, Math.min(4, eligible.length));
      queue = queue.filter(player => !ids.includes(player.id));
    }
    assert(waiting(session).every(player => player.missed <= 3));
  }
}

// A linked player with an ineligible partner can't fill the fourth slot alone.
let linkedSitOut = { ...demoSession(now), queueMode: 'atr' };
linkedSitOut.players = linkedSitOut.players.slice(0, 20);
linkedSitOut = applyAction(linkedSitOut, { type: 'end', courtId: 'c1', winner: 'A' }, now);
for (const player of waiting(linkedSitOut).slice(4)) player.eligibleAfterStart = 3;
linkedSitOut = applyAction(linkedSitOut, { type: 'linkPartners', playerId: 'p12', partnerId: 'p13' }, now);
const earlyIds = new Set(waiting(linkedSitOut)
  .filter(player => player.eligibleAfterStart > (linkedSitOut.gameStarts ?? 0))
  .map(player => player.id));
const nextFour = upcomingPlans(linkedSitOut)[0].teams.flat();
assert.equal(nextFour.length, 4);
assert.equal(nextFour.filter(id => earlyIds.has(id)).length, 1);
linkedSitOut = applyAction(linkedSitOut, { type: 'fill', courtId: 'c1' }, now);
assert(linkedSitOut.courts[0].match.teams.every(team => team.includes('p12') === team.includes('p13')));
console.log('ATR Social sit-out, staggered and simultaneous court starts, and linked-player fallback passed.');

// New arrivals cannot use fresh history to pass the FIFO queue.
for (const entry of ['addPlayers', 'selfCheckin']) {
  let session = applyAction(emptySession(now), {
    type: 'queueSettings', queueMode: 'atr', fifo: true, selfCheckin: true,
  }, now);
  session = applyAction(session, {
    type: 'addPlayers', names: Array.from({length: 20}, (_, index) => 'Early ' + index),
  }, now);
  session.players.forEach((player, index) => { player.id = 'early-' + index; });
  session = applyAction(session, {type: 'fill'}, now);
  for (let turn = 0; turn < 6; turn++) {
    const courtId = session.courts[turn % 2].id;
    const at = now + (turn + 1) * CAP / 2;
    session = applyAction(session, {type: 'end', courtId, winner: 'A'}, at);
    session = applyAction(session, {type: 'fill', courtId}, at + 1);
  }
  for (let index = 0; index < 4; index++) {
    session = applyAction(session, entry === 'selfCheckin'
      ? {type: entry, name: 'Late ' + index, checkInKey: crypto.randomUUID()}
      : {type: entry, names: ['Late ' + index]}, now + 3 * CAP + 10 + index);
  }
  const newcomers = session.players.slice(-4).map(player => player.id);
  const previews = upcomingPlans(session);
  assert(previews.every(plan => plan.teams.flat().every(id => !newcomers.includes(id))));


  // Persisted previews from the previous algorithm also need to honor FIFO.
  session.sharedNext = [{teams: [newcomers.slice(0, 2), newcomers.slice(2)], penalty: 0}];
  assert(upcomingPlans(session).every(plan => plan.teams.flat().every(id => !newcomers.includes(id))));

  for (let turn = 0; turn < 20; turn++) {
    const at = now + (turn + 8) * CAP / 2;
    const courtId = session.courts[turn % 2].id;
    session = applyAction(session, {type: 'end', courtId, winner: 'A'}, at);
    const preview = upcomingPlans(session)[0];
    const selected = new Set(preview.teams.flat());
    const waitingIds = new Set(waiting(session).map(player => player.id));
    for (const player of session.players.filter(player => selected.has(player.id))) {
      assert((player.queueAhead ?? []).every(id => !waitingIds.has(id) || selected.has(id)),
        'A first-time player must wait for the people ahead, or play with the final people ahead');
    }
    session = applyAction(session, {type: 'fill', courtId}, at + 1);
    assert.deepEqual(session.courts.find(court => court.id === courtId).match.teams, preview.teams);
  }
}
console.log('ATR FIFO late arrivals, self-check-in, stale previews and actual court starts passed.');

let fifoLinks = applyAction(emptySession(now), {type: 'queueSettings', queueMode: 'atr', fifo: true}, now);
fifoLinks = applyAction(fifoLinks, {
  type: 'addPlayers', names: Array.from({length: 20}, (_, index) => 'Linked FIFO ' + index),
}, now);
fifoLinks.players.forEach((player, index) => { player.waitSince = now + index; });
const linkedIds = fifoLinks.players.map(player => player.id);
fifoLinks = applyAction(fifoLinks, {
  type: 'linkPartners', playerId: linkedIds[0], partnerId: linkedIds[19],
}, now);
const linkedPreview = upcomingPlans(fifoLinks);
assert(waiting(fifoLinks).findIndex(player => player.id === linkedIds[0]) >= 18);
assert.equal(new Set(linkedPreview.flatMap(plan => plan.teams.flat())).size, 8);
fifoLinks = applyAction(fifoLinks, {
  type: 'linkPartners', playerId: linkedIds[3], partnerId: linkedIds[4],
}, now);
fifoLinks = applyAction(fifoLinks, {type: 'fill'}, now);
assert(fifoLinks.courts.every(court => court.match));
for (const court of fifoLinks.courts) {
  assert(court.match.teams.every(team => team.includes(linkedIds[3]) === team.includes(linkedIds[4])));
}
console.log('ATR FIFO preserves linked pairs and their lower queue position.');

// A second court can take newcomers once the first court serves everyone ahead.
let entryBatch = applyAction(emptySession(now), {type: 'queueSettings', queueMode: 'atr', fifo: true}, now);
entryBatch = applyAction(entryBatch, {type: 'addPlayers', names: ['Ahead 1', 'Ahead 2', 'Ahead 3', 'Ahead 4']}, now);
const ahead = entryBatch.players.map(player => player.id);
entryBatch = applyAction(entryBatch, {type: 'addPlayers', names: ['New 1', 'New 2', 'New 3', 'New 4']}, now + 1);
const after = entryBatch.players.slice(-4).map(player => player.id);
const firstBatch = upcomingPlans(entryBatch);
assert.equal(firstBatch.length, 2);
assert.deepEqual(new Set(firstBatch[0].teams.flat()), new Set(ahead));
assert.deepEqual(new Set(firstBatch[1].teams.flat()), new Set(after));
entryBatch = applyAction(entryBatch, {type: 'fill'}, now + 2);
assert(entryBatch.courts.every(court => court.match));
assert(entryBatch.players.every(player => player.queueAhead.length === 0));

// A full game with three waiting players plus one check-in remains possible.
let four = applyAction(emptySession(now), {type: 'queueSettings', queueMode: 'atr', fifo: true}, now);
four = applyAction(four, {type: 'addPlayers', names: ['One', 'Two', 'Three']}, now);
four = applyAction(four, {type: 'addPlayers', names: ['Four']}, now + 1);
assert.equal(upcomingPlans(four).length, 1);
four = applyAction(four, {type: 'fill'}, now + 2);
assert(four.courts[0].match);

// A pause, checkout or deletion releases a newcomer's wait for that person.
for (const action of ['pausePlayer', 'checkoutPlayer', 'deletePlayer']) {
  let ready = applyAction(emptySession(now), {type: 'queueSettings', queueMode: 'atr', fifo: true}, now);
  ready = applyAction(ready, {type: 'addPlayers', names: ['Older', 'B', 'C', 'D']}, now);
  ready = applyAction(ready, {type: 'addPlayers', names: ['New']}, now + 1);
  const olderId = ready.players[0].id;
  ready = applyAction(ready, {type: action, playerId: olderId}, now + 2);
  assert(!ready.players.find(player => player.name === 'New').queueAhead.includes(olderId));
  assert.equal(upcomingPlans(ready).length, 1);
}
console.log('Check-in queue gates work with dual courts, small queues and players leaving.');
