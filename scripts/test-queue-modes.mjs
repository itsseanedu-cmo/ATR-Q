import assert from 'node:assert/strict';
import { applyAction, demoSession, emptySession, planMatches, upcomingPlans, upcomingReasons, waitingForLineup } from '../lib/engine.ts';
import { clubNames, formatCost, ladderTargets, sessionResults } from '../lib/queue-modes.ts';

const now = 1800000000000;
const demo = applyAction(demoSession(now), { type: 'endAll' }, now);
for (const mode of ['balanced', 'social', 'skill', 'results', 'skillCourts', 'mixed', 'ladder', 'clubs']) {
  const session = applyAction(demo, { type: 'queueSettings', queueMode: mode, showStandings: true, clubA: 'Atherton', clubB: 'Ivory Wood' }, now);
  const plans = planMatches(session, 2, now);
  assert.equal(plans.length, 2, mode);
  assert.equal(new Set(plans.flatMap(plan => plan.teams.flat())).size, 8, mode);
  for (const plan of plans) {
    const players = plan.teams.flat().map(id => session.players.find(player => player.id === id));
    assert(Number.isFinite(formatCost(mode, players, session.courts.findIndex(court => court.id === plan.courtId), new Map())), mode);
  }
}
let session = emptySession(now);
session = applyAction(session, { type: 'addPlayers', names: ['A', 'B', 'C', 'D'], skill: '4.0' }, now);
session = applyAction(session, { type: 'queueSettings', queueMode: 'skillCourts', showStandings: true }, now);
session = applyAction(session, { type: 'fill' }, now);
assert.equal(session.courts[0].match, null);
assert(session.courts[1].match);
assert.equal(applyAction(session, { type: 'clear' }, now).showStandings, true);

const playerIds = session.players.map(player => player.id);
const teams = [playerIds.slice(0, 2), playerIds.slice(2)];
const names = [['A', 'B'], ['C', 'D']];
session.history = ['0 – 11', '11 – 10', '11 – 0'].map((score, i) => ({
  id: String(i), court: 'Court 2', endedAt: now - i, duration: 60000, score, reason: 'Game completed', teams, names,
}));
const results = sessionResults(session);
assert.equal(results.standings[0].wins, 2);
assert(results.highlights.some(item => item.title === 'Streak snapped' && item.detail.includes('2-game')));
assert(results.highlights.some(item => item.title === 'Close fight'));
assert(results.highlights.some(item => item.title === 'Pickled!'));
assert.equal(results.latest.get(playerIds[0]), 'loss');
console.log('All eight modes, court eligibility, settings persistence, standings and trivia passed.');

const clubSettings = { type: 'queueSettings', queueMode: 'clubs', selfCheckin: true };
assert.throws(() => applyAction(emptySession(now), clubSettings, now), /two different club names/);
assert.throws(() => applyAction(emptySession(now), { ...clubSettings, clubA: 'Atherton', clubB: 'atherton ' }, now), /two different club names/);
let clubSession = applyAction(emptySession(now), { ...clubSettings, clubA: ' Atherton ', clubB: 'Ivory Wood' }, now);
assert.deepEqual(clubNames(clubSession), { A: 'Atherton', B: 'Ivory Wood' });
assert.deepEqual(clubNames(applyAction(clubSession, { type: 'clear' }, now)), clubNames(clubSession));
const checkin = { type: 'selfCheckin', name: 'Visiting player', skill: '3.5', checkInKey: crypto.randomUUID() };
assert.throws(() => applyAction(clubSession, checkin, now), /club/);
clubSession = applyAction(clubSession, { ...checkin, side: 'B' }, now);
assert.equal(clubSession.players[0].side, 'B');
let largeClubSession = applyAction(clubSession, { type: 'addCourt' }, now);
largeClubSession = applyAction(largeClubSession, { type: 'addPlayers', names: Array.from({ length: 25 }, (_, i) => 'Atherton ' + i), side: 'A' }, now - 120000);
largeClubSession = applyAction(largeClubSession, { type: 'addPlayers', names: ['Ivory 2', 'Ivory 3', 'Ivory 4'], side: 'B' }, now);
const firstClub = largeClubSession.players.filter(player => player.side === 'A');
assert.throws(() => applyAction(largeClubSession, { type: 'nextLineup', courtId: 'c1', playerIds: firstClub.slice(0, 4).map(player => player.id) }, now), /two teammates from each club/);
const clubFilled = applyAction(largeClubSession, { type: 'fill' }, now);
assert.equal(clubFilled.courts.filter(court => court.match).length, 2);
for (const { match } of clubFilled.courts.filter(court => court.match)) {
  assert.deepEqual(match.teams.flat().map(id => clubFilled.players.find(player => player.id === id).side), ['A', 'A', 'B', 'B']);
}
let ladderSession = applyAction(session, { type: 'addCourt' }, now);
ladderSession.history = [session.history[0]];
const targets = ladderTargets(ladderSession);
assert.equal(targets.get(teams[0][0]), 2);
assert.equal(targets.get(teams[1][0]), 0);
assert.equal(formatCost('ladder', ladderSession.players.slice(0, 2), 2, new Map(), targets), 0);
assert(formatCost('ladder', ladderSession.players.slice(0, 2), 0, new Map(), targets) > 0);
console.log('Named Club Wars check-in, club eligibility, manual lineups and three-court ladder targets passed.');

const reasonPatterns = {
  atr: /first-time|priority/,
  atrResults: /results/,
  balanced: /ratings.*balance/,
  social: /first-time|priority/,
  skill: /half a rating point/,
  results: /results/,
  skillCourts: /rating requirement/,
  mixed: /each doubles category/,
  ladder: /ladder/,
  clubs: /Atherton.*Ivory Wood|Ivory Wood.*Atherton/,
};
for (const [mode, pattern] of Object.entries(reasonPatterns)) {
  const state = applyAction(demo, { type: 'queueSettings', queueMode: mode, clubA: 'Atherton', clubB: 'Ivory Wood' }, now);
  const plans = upcomingPlans(state);
  assert.equal(plans.length, 2, mode);
  assert(upcomingReasons(state, plans).every(reason => pattern.test(reason)), mode);
}

const priorityState = { ...structuredClone(demo), queueMode: 'atr' };
const priorityPlan = upcomingPlans(priorityState)[0];
assert.match(upcomingReasons(priorityState, [{ ...priorityPlan, manual: true }])[0], /organizer/);
const firstPlayer = priorityState.players.find(player => player.id === priorityPlan.teams[0][0]);
firstPlayer.missed = 3;
assert.match(upcomingReasons(priorityState, [priorityPlan])[0], /priority/);
firstPlayer.eligibleAfterStart = (priorityState.gameStarts ?? 0) + 1;
const matchingPlans = upcomingPlans(priorityState);
assert(matchingPlans.length);
assert.match(upcomingReasons(priorityState, [priorityPlan])[0], /early return/);
assert.doesNotMatch(upcomingReasons(priorityState, [matchingPlans[0]])[0], /early return/);
assert.match(waitingForLineup(emptySession(now)), /four eligible players/);
const unevenClubs = { ...largeClubSession, players: [...firstClub, clubSession.players[0]] };
assert.equal(upcomingPlans(unevenClubs).length, 0);
assert.match(waitingForLineup(unevenClubs), /each club/);
console.log('Player-facing lineup explanations passed for all ten modes.');
