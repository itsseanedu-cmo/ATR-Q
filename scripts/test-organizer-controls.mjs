import assert from 'node:assert/strict';
import { activePlayers, applyAction, demoSession, emptySession, elapsed, CAP, hardCapEnabled, planMatches, remaining, upcomingPlans, waiting } from '../lib/engine.ts';
import { sessionResults } from '../lib/queue-modes.ts';

const now = 1800000000000;
let session = demoSession(now);
assert.equal(session.courts.length, 2);
session = applyAction(session, { type: 'addCourt' }, now);
const third = session.courts[2].id;
const manual = ['p9', 'p12', 'p11', 'p10'];
session = applyAction(session, { type: 'nextLineup', courtId: third, playerIds: manual }, now);
assert.throws(() => applyAction(session, { type: 'nextLineup', courtId: 'c1', playerIds: ['p9', 'p13', 'p14', 'p15'] }, now), /already assigned/);
assert.throws(() => applyAction(session, { type: 'nextLineup', courtId: 'c1', playerIds: ['p13', 'p13', 'p14', 'p15'] }, now), /four different/);
assert.throws(() => applyAction(session, { type: 'nextLineup', courtId: 'c1', playerIds: ['p2', 'p13', 'p14', 'p15'] }, now), /waiting/);
const next = upcomingPlans(session);
assert.equal(next.length, 3);
assert.equal(new Set(next.flatMap(plan => plan.teams.flat())).size, 12);
assert.deepEqual(next.find(plan => plan.courtId === third).teams.flat(), manual);

const game = session.courts[0].match;
const revised = applyAction(session, { type: 'courtLineup', courtId: 'c1', matchId: game.id, playerIds: ['p1', 'p3', 'p2', 'p15'] }, now);
assert.equal(revised.courts[0].match.startedAt, game.startedAt);
assert.equal(revised.players.find(player => player.id === 'p4').status, 'waiting');
assert.equal(revised.players.find(player => player.id === 'p15').status, 'playing');
assert.throws(() => applyAction(revised, { type: 'courtLineup', courtId: 'c1', matchId: 'old', playerIds: ['p1', 'p2', 'p3', 'p4'] }, now), /changed/);
assert.throws(() => applyAction(revised, { type: 'checkoutPlayer', playerId: 'p1' }, now), /on court/);
const activeCheckout = applyAction(revised, { type: 'checkoutPlayer', playerId: 'p1', matchId: game.id }, now);
assert.equal(activeCheckout.courts[0].match, null);
assert.equal(activeCheckout.history[0].reason, 'Player checked out');

const checkedOut = applyAction(session, { type: 'checkoutPlayer', playerId: 'p9' }, now);
assert.equal(activePlayers(checkedOut).length, 23);
assert.equal(checkedOut.nextOverrides[third], undefined);
assert.equal(applyAction(checkedOut, { type: 'returnPlayer', playerId: 'p9' }, now).players[8].games, session.players[8].games);
session = applyAction(session, { type: 'endAll' }, now);
session = applyAction(session, { type: 'fill' }, now);
assert.equal(session.courts.filter(court => court.match).length, 3);
assert.deepEqual(session.courts[2].match.teams.flat(), manual);
assert.equal(new Set(session.courts.flatMap(court => court.match.teams.flat())).size, 12);
assert.equal(session.nextOverrides[third], undefined);
assert.throws(() => applyAction(session, { type: 'removeCourt', courtId: third }, now), /End the game/);
session = applyAction(session, { type: 'endAll' }, now);
session = applyAction(session, { type: 'removeCourt', courtId: third }, now);
assert.equal(session.courts.length, 2);
assert.equal(planMatches(session).length, 2);
console.log('Three-court planning, overrides, substitutions, checkout, return and court removal passed.');

const started = demoSession(now);
let paced = applyAction(started, { type: 'hardCap', enabled: false }, now);
assert.equal(hardCapEnabled(started), true);
assert.equal(hardCapEnabled(paced), false);
assert.equal(elapsed(paced.courts[0].match, now + 15 * 60000), 21 * 60000);
assert.throws(() => applyAction(paced, { type: 'end', courtId: 'c1', scoreA: '5', scoreB: '5' }, now + 15 * 60000), /needs a winner/);
paced = applyAction(paced, { type: 'checkoutPlayer', playerId: 'p9' }, now);
assert.equal(hardCapEnabled(paced), false);
paced = applyAction(paced, { type: 'checkoutPlayer', playerId: 'p10' }, now);
paced = applyAction(paced, { type: 'checkoutPlayer', playerId: 'p11' }, now);
assert.equal(activePlayers(paced).length, 21);
assert.equal(hardCapEnabled({ ...paced, hardCap: undefined }), false);
paced = applyAction(paced, { type: 'timer', courtId: 'c1' }, now + 1000);
assert.equal(paced.courts[0].match.pausedAt, now + 1000);
paced = applyAction(paced, { type: 'returnPlayer', playerId: 'p9' }, now + 2000);
assert.equal(activePlayers(paced).length, 22);
assert.equal(hardCapEnabled(paced), true);
assert.equal(paced.courts[0].match.pausedAt, null);
assert.equal(paced.courts[0].match.pausedMs, 1000);
paced = applyAction(paced, { type: 'addCourt' }, now + 3000);
assert.equal(hardCapEnabled(paced), true);
assert.equal(hardCapEnabled(applyAction(paced, { type: 'checkoutPlayer', playerId: 'p9' }, now + 3500)), false);
paced = applyAction(paced, { type: 'hardCap', enabled: true }, now + 4000);
assert.equal(hardCapEnabled(paced), true);
assert.equal(applyAction(paced, { type: 'end', courtId: 'c1', scoreA: '5', scoreB: '5' }, now + CAP - 6 * 60000 + 1000).history[0].reason, '13-minute cap');
assert.equal(remaining(paced.courts[0].match, now + CAP - 9 * 60000 + 1000), 3 * 60000);
assert.equal(remaining(paced.courts[0].match, now + CAP - 6 * 60000 + 999), 1);
assert.throws(() => applyAction(paced, { type: 'end', courtId: 'c1', scoreA: '5', scoreB: '5' }, now + CAP - 6 * 60000 + 999), /needs a winner/);
assert.throws(() => applyAction(paced, { type: 'timer', courtId: 'c1' }, now + 4000), /13-minute hard cap/);

const link = { type: 'linkPartners', playerId: 'p9', partnerId: 'p24' };
const reserved = applyAction(started, { type: 'nextLineup', courtId: 'c1', playerIds: ['p9', 'p10', 'p11', 'p12'] }, now);
let paired = applyAction(reserved, link, now);
assert.equal(paired.nextOverrides.c1, undefined);
assert.equal(paired.players.find(player => player.id === 'p9').partnerId, 'p24');
assert.equal(paired.players.find(player => player.id === 'p24').partnerId, 'p9');
assert.throws(() => applyAction(paired, { ...link, partnerId: 'p10' }, now), /current partner/);
assert.throws(() => applyAction(paired, { type: 'nextLineup', courtId: 'c1', playerIds: ['p9', 'p10', 'p24', 'p12'] }, now), /same team/);
assert.throws(() => applyAction(paired, { type: 'swap', courtId: 'c1', incomingId: 'p9', outgoingId: 'p1' }, now), /same team/);
const validNext = ['p9', 'p24', 'p11', 'p12'];
const manualPair = applyAction(paired, { type: 'nextLineup', courtId: 'c1', playerIds: validNext }, now);
assert.deepEqual(upcomingPlans(manualPair).find(plan => plan.courtId === 'c1').teams.flat(), validNext);

const teamsFor = state => upcomingPlans(state).flatMap(plan => plan.teams);
const includesPair = team => team.includes('p9') && team.includes('p24');
let pairedGames = 0;
for (let round = 1; round <= 6; round++) {
  paired = applyAction(paired, { type: 'simulate' }, now + round * 15 * 60000);
  const teams = paired.courts.flatMap(court => court.match.teams);
  assert(teams.every(team => (!team.includes('p9') && !team.includes('p24')) || includesPair(team)));
  if (teams.some(includesPair)) pairedGames++;
}
assert(pairedGames > 0);
const onBreak = applyAction(applyAction(paired, { type: 'endAll' }, now), { type: 'pausePlayer', playerId: 'p9' }, now);
assert(teamsFor(onBreak).every(team => !team.includes('p9') && !team.includes('p24')));
const afterCheckout = applyAction(onBreak, { type: 'checkoutPlayer', playerId: 'p9' }, now);
assert.equal(afterCheckout.players.find(player => player.id === 'p24').partnerId, undefined);
const unlinked = applyAction(paired, { type: 'unlinkPartners', playerId: 'p24' }, now);
assert.equal(unlinked.players.find(player => player.id === 'p9').partnerId, undefined);
console.log('Hard cap threshold, manual override, scoring, timer resume, linked rotations and checkout passed.');

let prioritySession = emptySession(now);
for (let index = 0; index < 8; index++) {
  prioritySession = applyAction(prioritySession, { type: 'addPlayers', names: ['Queue player ' + index] }, now + index * 1000);
}
const [front, ...others] = prioritySession.players;
const back = others.at(-1);
front.missed = 3;
back.games = 1;
prioritySession = applyAction(prioritySession, { type: 'linkPartners', playerId: front.id, partnerId: back.id }, now + 8000);
assert.deepEqual(waiting(prioritySession).map(player => player.id), [
  ...others.slice(0, -1).map(player => player.id), front.id, back.id,
]);
const firstLineup = planMatches(prioritySession, 1, now + 8000)[0].teams.flat();
assert.deepEqual(new Set(firstLineup), new Set(others.slice(0, 4).map(player => player.id)));
const heldPair = applyAction(prioritySession, { type: 'pausePlayer', playerId: back.id }, now + 9000);
assert.equal(waiting(heldPair).at(-1).id, front.id);

let closing = applyAction(demoSession(now), { type: 'queueSettings', queueMode: 'social', selfCheckin: true, showStandings: false }, now);
closing = applyAction(closing, { type: 'end', courtId: 'c1', scoreA: '11', scoreB: '9' }, now);
closing = applyAction(closing, { type: 'nextLineup', courtId: 'c2', playerIds: ['p9','p10','p11','p12'] }, now);
const final = applyAction(closing, { type: 'endSession' }, now + 1000);
assert.equal(final.endedAt, now + 1000);
assert.equal(final.selfCheckin, false);
assert.equal(final.courts.some(court => court.match), false);
assert.equal(final.nextOverrides, undefined);
assert.equal(final.history[0].reason, 'Session ended');
assert.equal(final.history[0].score, 'Not recorded');
assert.deepEqual(sessionResults(final).standings, sessionResults(closing).standings);
assert.deepEqual(upcomingPlans(final), []);
assert.equal(applyAction(final, { type: 'endSession' }, now + 2000), final);
for (const action of [{ type: 'fill' }, { type: 'selfCheckin' }, { type: 'clear' }, { type: 'queueSettings' }]) {
  assert.throws(() => applyAction(final, action, now + 2000), /session has ended/i);
}
assert.equal(applyAction(final, { type: 'demo' }, now + 2000).endedAt, undefined);
assert.throws(() => applyAction({ ...final, id: 'live-session' }, { type: 'demo' }, now + 2000), /session has ended/i);
const outsideClubWars = applyAction(started, { type: 'playerProfile', playerId: 'p9', skill: '4.0', side: 'B' }, now);
assert.equal(outsideClubWars.players[8].side, started.players[8].side);
const clubWars = applyAction(started, { type: 'queueSettings', queueMode: 'clubs', clubA: 'Atherton', clubB: 'Ivory Wood' }, now);
assert.equal(applyAction(clubWars, { type: 'playerProfile', playerId: 'p9', skill: '4.0', side: 'B' }, now).players[8].side, 'B');
console.log('Lower queue priority for linked teammates, Club Wars fields and final standings passed.');

// Deleting removes the current roster entry while preserving completed games.
let deleted = demoSession(now);
deleted = applyAction(deleted, {type: 'linkPartners', playerId: 'p9', partnerId: 'p10'}, now);
deleted = applyAction(deleted, {
  type: 'nextLineup', courtId: 'c1', playerIds: ['p9', 'p10', 'p11', 'p12'],
}, now);
deleted.players.find(player => player.id === 'p9').photo = 'data:image/png;base64,test';
deleted.rotationSelections.push('p9');
deleted = applyAction(deleted, {type: 'deletePlayer', playerId: 'p9'}, now);
assert(!deleted.players.some(player => player.id === 'p9'));
assert(!deleted.players.find(player => player.id === 'p10').partnerId);
assert(!deleted.rotationSelections.includes('p9'));
assert.equal(deleted.nextOverrides.c1, undefined);
assert(!upcomingPlans(deleted).some(plan => plan.teams.flat().includes('p9')));
assert.throws(() => applyAction(deleted, {type: 'deletePlayer', playerId: 'p9'}, now), /already been deleted/);

const activeDelete = demoSession(now);
const match = activeDelete.courts[0].match;
assert.throws(() => applyAction(activeDelete, {type: 'deletePlayer', playerId: 'p1'}, now), /on court/);
assert.throws(() => applyAction(activeDelete, {type: 'deletePlayer', playerId: 'p1', matchId: 'stale'}, now), /on court/);
const removedOnCourt = applyAction(activeDelete, {type: 'deletePlayer', playerId: 'p1', matchId: match.id}, now);
assert.equal(removedOnCourt.courts[0].match, null);
assert(!removedOnCourt.players.some(player => player.id === 'p1'));
assert(removedOnCourt.players.filter(player => ['p2', 'p3', 'p4'].includes(player.id)).every(player => player.status === 'waiting'));
assert.equal(removedOnCourt.history[0].reason, 'Player deleted');
assert(removedOnCourt.history[0].names.flat().includes('Tom Hanks'));
const history = structuredClone(removedOnCourt.history);
const secondDeletion = applyAction(removedOnCourt, {type: 'deletePlayer', playerId: 'p2'}, now);
assert.deepEqual(secondDeletion.history, history);
const checkedOutDelete = applyAction(activeDelete, {type: 'checkoutPlayer', playerId: 'p9'}, now);
assert(!applyAction(checkedOutDelete, {type: 'deletePlayer', playerId: 'p9'}, now).players.some(player => player.id === 'p9'));
console.log('Player deletion, reservations, linked teammates, active-game confirmation and history preservation passed.');

// The court-based capacity toggle applies to all check-in and return paths.
const cappedSession = demoSession(now);
assert.throws(() => applyAction(cappedSession, {type: 'addPlayers', names: ['Player 25']}, now), /capacity/);
let uncappedSession = applyAction(cappedSession, {
  type: 'queueSettings', queueMode: 'social', selfCheckin: true, capacityLimit: false,
}, now);
assert.deepEqual(planMatches(uncappedSession, 2, now), planMatches(cappedSession, 2, now));
assert.equal(hardCapEnabled(uncappedSession), hardCapEnabled(cappedSession));
uncappedSession = applyAction(uncappedSession, {type: 'addPlayers', names: ['Player 25', 'Player 26']}, now + 1);
uncappedSession = applyAction(uncappedSession, {
  type: 'selfCheckin', name: 'Player 27', skill: '3.5', checkInKey: crypto.randomUUID(),
}, now + 2);
assert.equal(activePlayers(uncappedSession).length, 27);
const returnId = uncappedSession.players.at(-1).id;
uncappedSession = applyAction(uncappedSession, {type: 'pausePlayer', playerId: returnId}, now + 3);
uncappedSession = applyAction(uncappedSession, {type: 'pausePlayer', playerId: returnId}, now + 4);
uncappedSession = applyAction(uncappedSession, {type: 'checkoutPlayer', playerId: returnId}, now + 5);
uncappedSession = applyAction(uncappedSession, {type: 'returnPlayer', playerId: returnId}, now + 6);
assert.equal(activePlayers(uncappedSession).length, 27);
assert.equal(applyAction(uncappedSession, {type: 'clear'}, now + 7).capacityLimit, false);
assert.equal(applyAction(uncappedSession, {type: 'demo'}, now + 7).capacityLimit, false);
const restoredCap = applyAction(uncappedSession, {
  type: 'queueSettings', queueMode: 'social', capacityLimit: true,
}, now + 8);
assert.equal(activePlayers(restoredCap).length, 27);
assert.throws(() => applyAction(restoredCap, {type: 'addPlayers', names: ['Player 28']}, now + 9), /capacity/);
console.log('Capacity limit toggle, organizer and QR check-in, returning players and default behavior passed.');
