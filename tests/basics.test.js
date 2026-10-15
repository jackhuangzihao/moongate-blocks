const assert = require('assert');
const basics = require('../js/progression/basics'), saves = require('../js/persistence/saves');
const C = require('../js/challenge/challenges'), K = require('../js/progression/collection');
const { boot, clone, queryFor } = require('./helpers/game-harness');

function next(app) { if(app.run('state.basics.done'))app.tap(app.run('getBasicsActions(layout).next')); }
function complete(app) {
  for (const move of [[1,6,4], [1,3,5], [0,6,7]]) { app.move(move); next(app); }
}

// Real button/gesture routing enters practice, cancels a drag safely and opens
// replay from help without leaving its old overlay active over the board.
const entry = boot(); entry.tap(entry.run('getHomeActions(layout).start'));
assert.equal(entry.run('state.basics.step'), 0);
const finger = entry.run('({clientX:layout.width/2,clientY:layout.trayY,identifier:3})');
entry.handlers.TouchStart({touches:[finger],changedTouches:[finger]});
assert.ok(entry.run('state.drag'));
entry.handlers.TouchCancel({touches:[],changedTouches:[finger]});
assert.equal(entry.run('state.drag'), null);
assert.ok(entry.run('state.tray[1]'));
entry.tap(entry.run('getBasicsActions(layout).skip'));
entry.run('state.settingsOpen=true;state.helpOpen=true');
entry.tap(entry.run('getHelpActions(layout).practice'));
assert.equal(entry.run('state.basics.step'), 0);
assert.equal(entry.run('state.helpOpen || state.settingsOpen'), false);
entry.tap(entry.run('getBasicsActions(layout).skip'));
assert.equal(entry.run('state.screen'), 'playing');
assert.equal(entry.run('state.basics'), null);

// The last exercise accepts either valid solution, while guided lessons reject
// unrelated placements without spending the piece. Corrupt progress starts fresh.
for (const value of [-1, 3, NaN, null, {}, '2']) assert.equal(basics.create(value).step, 0);
const row = basics.create();
assert.equal(basics.play(row, 0, 6, 4), null);
assert.equal(basics.play(row, 1, 8, 4), null);
assert.deepStrictEqual(basics.play(row, 1, 0, 0), {guided:true});
assert.ok(row.tray[1]);
assert.equal(basics.play(row, 1, 6, 4).cleared, 1);
assert.ok(row.board.every(line => line.every(v => v === 0)));
assert.equal(basics.play(row, 1, 6, 4), null);
const palace = basics.create(1);
assert.equal(basics.play(palace, 1, 3, 5).cleared, 1);
assert.ok(palace.board.every(line => line.every(v => v === 0)));
for (const r of [1, 7]) {
  const lesson = basics.create(2);
  assert.equal(basics.play(lesson, 0, 6, r).cleared, 1);
  assert.ok(lesson.done);
}

// No automatic practice is offered to returning players with a score or a run.
for (const store of [{fangcunBestV2Easy:1}, {[C.KEY]:{version:1,stars:[1]}}]) {
  const app = boot(store); app.run('continueOrStartGame()');
  assert.equal(app.run('state.basics'), null);
}

// Skip never writes a tutorial board into a scored save or spends an undo.
for (const step of [0, 1, 2]) {
  const app = boot({[basics.KEY]:step}); app.run('continueOrStartGame()');
  app.tap(app.run('getBasicsActions(layout).skip'));
  assert.equal(app.run('state.basics'), null);
  assert.equal(app.run('state.score'), 0);
  assert.equal(app.run('state.collection.clears'), 0);
  assert.equal(app.run('undoBudget.remaining(state.undoBudget)'), 1);
  const saved = saves.decode(app.store[saves.keyFor('easy')], 'easy');
  assert.ok(saved && saved.board.every(line => line.every(v => v === 0)));
  assert.equal(app.events.filter(([name]) => name === 'session_exit').length, 0);
}

// Leaving or suspending halfway preserves the teaching step, without a run save.
const paused = boot(); paused.run('continueOrStartGame()');
paused.move([1,6,4]); next(paused);
paused.handlers.Hide(); paused.run('returnHome()');
assert.equal(paused.store[basics.KEY], 1);
assert.ok(!paused.store.fangcunTutorialSeen);
assert.ok(!paused.store[saves.keyFor('easy')]);
const resumed = boot(clone(paused.store)); resumed.run('continueOrStartGame()');
assert.equal(resumed.run('state.basics.step'), 1);

// Unsuccessful independent practice resets safely instead of trapping the player.
resumed.run('applyBasicsStep(2)');
for (const move of [[0,0,3], [1,3,3], [2,0,4]]) resumed.move(move);
assert.equal(resumed.run('state.basics.needsNext'), false);
assert.equal(resumed.run('state.tray.filter(Boolean).length'), 3);
assert.equal(resumed.run('state.collection.clears'), 0);

// Replaying from a live garden preserves the exact random sequence, undo budget,
// score, history and board, including when storage is temporarily unavailable.
for (const failure of [false, true]) {
  const fault = {}, app = boot({fangcunTutorialSeen:true}, {fault});
  app.run('continueOrStartGame();state.undoBudget.spent=1');
  const target = app.run(`(()=>{for(let i=0;i<3;i++)for(let r=0;r<9;r++)for(let c=0;c<9;c++)
    if(canPlace(state.board,state.tray[i],c,r))return [i,c,r]})()`);
  app.move(target);
  const saved = clone(app.run('saves.snapshot(state)'));
  const decor = clone(app.run('state.collection'));
  fault.write = failure;
  app.run('startBasics(true)'); complete(app);
  assert.equal(app.run('state.basics'), null);
  assert.deepStrictEqual(clone(app.run('saves.snapshot(state)')), saved);
  assert.deepStrictEqual(clone(app.run('state.collection')), decor);
  fault.write = false; app.handlers.Hide();
  assert.deepStrictEqual(saves.decode(app.store[saves.keyFor('easy')], 'easy'), saves.decode(saved, 'easy'));
}

// Challenge and daily practice don't alter objectives, steps, hints or rewards.
for (const start of ['startChallenge(12)', 'startDaily()']) {
  const app = boot(); app.run(start);
  const target = C.level(app.run('state.challenge.level')).solution[0];
  app.move(target);
  const run = clone(app.run('state.challenge'));
  const decor = clone(app.run('state.collection'));
  app.run('startBasics(true)'); complete(app);
  assert.deepStrictEqual(clone(app.run('state.challenge')), run);
  assert.deepStrictEqual(clone(app.run('state.collection')), decor);
}

// An incoming invitation may interrupt practice; the old puzzle remains saved.
const invited = boot({fangcunTutorialSeen:true}); invited.run('startChallenge(12)');
invited.move(C.LEVELS[12].solution[0]);
const oldRun = clone(invited.run('state.challenge'));
invited.run(`startBasics(true);receiveInvitation(${JSON.stringify(queryFor(24))})`);
assert.equal(invited.run('state.screen'), 'invitation');
assert.equal(invited.run('state.basics'), null);
invited.run('startInvitation()');
assert.equal(invited.run('state.challenge.level'), 24);
invited.run('returnHome();startChallenge(12,true)');
assert.deepStrictEqual(clone(invited.run('state.challenge')), oldRun);

// Completion grants the first plant once; replay cannot farm progress or scores.
const fresh = boot(); fresh.run('continueOrStartGame()'); complete(fresh);
assert.equal(fresh.run('state.collection.clears'), 1);
assert.ok(K.unlocked(fresh.run('state.collection'), 0).includes('bamboo'));
fresh.run('startBasics(true)'); complete(fresh);
assert.equal(fresh.run('state.collection.clears'), 1);
assert.equal(fresh.run('state.score'), 0);
assert.ok(!fresh.events.some(([name]) => name === 'level_result'));

console.log('PASS: practice solutions, skip/resume, save isolation, storage failure, invitations and one-time reward');
