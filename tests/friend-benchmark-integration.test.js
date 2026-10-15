const assert = require('assert');
const C = require('../js/challenge/challenges'), D = require('../js/daily/daily');
const { boot, protectedStore, protectedState, queryFor, INVITE } = require('./helpers/game-harness');
const decode = card => Object.fromEntries(new URLSearchParams(card.query));

// Reopening a share preserves the board, while each new invitation supplies its own comparison.
const id = 11, level = C.level(id), actual = level.solution.length, benchmark = actual + 1;
assert.ok(benchmark <= level.limit);
const invitation = queryFor(id, undefined, benchmark), store = protectedStore(), before = protectedState(store);
let app = boot(store, { query: invitation });
assert.equal(app.run('state.screen'), 'invitation');
assert.equal(app.run('state.invitation.benchmarkSteps'), benchmark);
assert.equal(decode(app.run('sharing.menuCard(state)')).steps, String(benchmark));
app.tap(app.run('getSpecialActions(layout).start'));
app.move(level.solution[0]);
assert.equal(app.run('state.challenge.benchmarkSteps'), benchmark);
assert.equal(store[INVITE].benchmarkSteps, benchmark);
app.handlers.Show({ query: invitation });
assert.equal(app.run('state.screen'), 'playing', 'repeated onShow for the same invitation does not interrupt play');
assert.equal(app.run('state.challenge.history.length'), 1);
app.handlers.Show({ query: queryFor(id, undefined, actual) });
assert.equal(app.run('state.screen'), 'invitation', 'a new score for the same puzzle is still a new invitation');
app.run('startInvitation()');
assert.equal(app.run('state.challenge.history.length'), 1);
assert.equal(app.run('state.challenge.benchmarkSteps'), actual);
assert.equal(store[INVITE].benchmarkSteps, actual);
for (const legacy of [queryFor(id), { ...invitation, steps: '01' }]) {
  app.handlers.Show({ query: legacy }); app.run('startInvitation()');
  assert.equal(app.run('state.challenge.history.length'), 1);
  assert.equal(app.run('state.challenge.benchmarkSteps'), undefined, 'an old or invalid optional score cannot reuse a previous invite score');
  assert.equal(store[INVITE].benchmarkSteps, undefined);
}
app.handlers.Show({ query: invitation }); app.run('startInvitation();undoMove(1)');
assert.equal(app.run('state.challenge.history.length'), 0);
assert.equal(app.run('state.challenge.benchmarkSteps'), benchmark);
app.run('restartGame()'); app.move(level.solution[0]); app.handlers.Hide();
app = boot(store, { query: invitation }); app.run('startInvitation()');
assert.equal(app.run('state.challenge.history.length'), 1);
assert.equal(app.run('state.challenge.benchmarkSteps'), benchmark);
app.complete();
assert.equal(app.run('sharing.comparison(state.challenge)'), '比挑战成绩少用 1 步');
assert.equal(decode(app.run('sharing.resultCard(state)')).steps, String(actual), 'the returned challenge carries the player own verified completion');
assert.equal(store[INVITE], null);
assert.deepStrictEqual(protectedState(store), before, 'friendly comparisons never transfer chapter stars or garden scores');
app.tap(app.run('getGameOverActions(layout,state).restart'));
assert.equal(app.run('state.challenge.history.length'), 0);
assert.equal(app.run('state.challenge.benchmarkSteps'), benchmark);
app.run('startChallenge(0)');
assert.equal(app.run('state.challenge.benchmarkSteps'), undefined, 'normal chapter play is independent of friend comparison');

// Daily invitations keep the same score across undo, relaunch and retry, without changing the date.
const date = '2026-10-05', dailyId = D.levelFor(date), puzzle = C.level(dailyId), dailyBenchmark = puzzle.solution.length + 1;
const clock = { value: Date.parse(date + 'T04:00:00Z') }, dailyStore = protectedStore();
const dailyInvitation = queryFor(dailyId, date, dailyBenchmark);
app = boot(dailyStore, { clock, query: dailyInvitation });
assert.equal(app.run('state.screen'), 'daily');
assert.equal(app.run('state.invitation.benchmarkSteps'), dailyBenchmark);
assert.equal(decode(app.run('sharing.menuCard(state)')).steps, String(dailyBenchmark), 'daily landing forwards the same benchmark');
app.tap(app.run('getSpecialActions(layout).start')); app.move(puzzle.solution[0]);
assert.equal(dailyStore[D.KEY].active.benchmarkSteps, dailyBenchmark);
app.run('undoMove(1)');
assert.equal(app.run('state.challenge.benchmarkSteps'), dailyBenchmark);
app.move(puzzle.solution[0]); app.handlers.Hide();
app = boot(dailyStore, { clock }); app.run('openDaily();startDaily()');
assert.equal(app.run('state.challenge.history.length'), 1);
assert.equal(app.run('state.challenge.benchmarkSteps'), dailyBenchmark, 'normal daily resume keeps the saved comparison');
app.complete();
assert.equal(app.run('sharing.comparison(state.challenge)'), '比挑战成绩少用 1 步');
assert.equal(decode(app.run('sharing.resultCard(state)')).steps, String(puzzle.solution.length));
app.tap(app.run('getGameOverActions(layout,state).retry'));
assert.equal(app.run('state.challenge.benchmarkSteps'), dailyBenchmark);
assert.equal(app.run('state.challenge.dailyDate'), date);
assert.equal(app.run('state.challenge.history.length'), 0);
app.handlers.Show({ query: queryFor(dailyId, date) }); app.run('startDaily()');
assert.equal(app.run('state.challenge.benchmarkSteps'), undefined, 'a same-day old link clears the previous invite score');

// An old daily share opens today without comparing against any old or unrelated score.
// The weekly rotation can reuse a puzzle, but never another date's benchmark.
const currentDate = '2026-10-26', currentId = D.levelFor(currentDate), previousDate='2026-10-19';
assert.equal(currentId, D.levelFor(previousDate));
const currentPuzzle=C.level(currentId),currentBenchmark=currentPuzzle.par+1;
const expiredWeekly=queryFor(currentId,previousDate,currentBenchmark);
const currentClock = { value: Date.parse(currentDate + 'T04:00:00Z') };
for (const hasCurrentSave of [false, true]) for(const expiredInvitation of [dailyInvitation,expiredWeekly]) {
  const currentStore = protectedStore();
  app = boot(currentStore, { clock: currentClock, query: queryFor(currentId, currentDate, currentBenchmark) });
  if (hasCurrentSave) { app.run('startDaily()'); app.move(currentPuzzle.solution[0]); }
  app.handlers.Show({ query: expiredInvitation });
  assert.equal(app.run('state.screen'), 'daily');
  assert.equal(app.run('state.invitation.benchmarkSteps'), undefined);
  assert.equal(decode(app.run('sharing.menuCard(state)')).steps, undefined);
  app.run('startDaily()');
  assert.equal(app.run('state.challenge.dailyDate'), currentDate);
  assert.equal(app.run('state.challenge.level'), currentId);
  assert.equal(app.run('state.challenge.history.length'), hasCurrentSave ? 1 : 0, 'redirecting preserves the actual daily board');
  assert.equal(app.run('state.challenge.benchmarkSteps'), undefined, 'an expired invitation cannot revive another saved comparison');
  assert.equal(currentStore[D.KEY].active.benchmarkSteps, undefined);
  assert.ok(app.notices.some(text => text.includes('精选已更新')));
}
console.log('PASS: friend scores across changed/legacy invitations, real touch play, save/relaunch, undo/retry, own-score forwarding and daily date isolation');
