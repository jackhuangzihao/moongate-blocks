const assert = require('assert');
const C = require('../js/challenge/challenges'), D = require('../js/daily/daily'), K = require('../js/progression/collection'), B = require('../js/rules/board');
const { boot, clone, protectedStore, protectedState, queryFor, INVITE } = require('./helpers/game-harness');

// Daily play goes through real dragging, checkpoint/relaunch, undo and restart paths.
const store = protectedStore(), protectedBefore = protectedState(store);
let app = boot(store);
app.run('startChallenge(4,true);openDaily();startDaily()');
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03');
assert.equal(app.run('getChallengeActions(layout,state).hint'), undefined, 'Daily cannot spend a chapter free hint');
const selected = app.run('state.challenge.level');
app.move(C.level(selected).solution[0]);
assert.equal(store[D.KEY].active.history.length, 1);
app.run('undoMove(1)');
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03');
assert.equal(store[D.KEY].active.history.length, 0);
app.move(C.level(selected).solution[0]);
app.handlers.Hide(); app = boot(store); app.run('openDaily();startDaily()');
assert.equal(app.run('state.challenge.history.length'), 1);
app.run('restartGame()');
assert.equal(app.run('state.challenge.history.length'), 0);
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03');
app.complete();
assert.equal(store[D.KEY].active, null);
assert.equal(store[D.KEY].records.length, 1);
assert.equal(store[D.KEY].records[0].date, '2026-10-03');
const best = store[D.KEY].records[0].bestSteps;
assert.equal(store[K.KEY].dailyCompletions,1);
app.run('openDaily();startDaily()'); app.complete();
assert.equal(store[D.KEY].records.length, 1); assert.equal(store[D.KEY].records[0].bestSteps, best);
assert.equal(store[K.KEY].dailyCompletions,1);
assert.deepStrictEqual(protectedState(store), protectedBefore, 'Daily wins must not change chapter progress, existing furnishings or leaderboard scores');
assert.ok(app.events.some(([name]) => name === 'daily_result'));
assert.ok(!app.events.some(([name]) => name === 'level_result'));

// A failed daily can be rewound/reloaded, while the chapter hint/failure counters remain untouched.
app.run('openDaily();startDaily()');
while (!app.run('state.challenge.ended')) {
  const run = app.run('state.challenge'), options = [];
  run.tray.forEach((piece, slot) => { if (piece) for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (!B.canPlace(run.board, piece, c, r)) continue;
    const trial = clone(run); C.play(trial, slot, c, r);
    options.push({ move: [slot, c, r], won: trial.won, progress: trial.progress });
  } });
  options.sort((a, b) => Number(a.won) - Number(b.won) || a.progress - b.progress);
  assert.ok(options.length); app.move(options[0].move);
}
assert.equal(app.run('state.challenge.won'), false);
app.run('undoMove(1)'); assert.equal(app.run('state.challenge.failedOnce'), true);
app.handlers.Hide(); app = boot(store); app.run('openDaily();startDaily()');
assert.equal(app.run('state.challenge.failedOnce'), true);
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03');
assert.deepStrictEqual(protectedState(store), protectedBefore);

// Midnight does not replace a running board; returning to daily selects the new day.
const clock = { value: Date.parse('2026-10-03T15:59:59Z') }, midnightStore = protectedStore();
app = boot(midnightStore, { clock }); app.run('openDaily();startDaily()');
app.move(C.level(selected).solution[0]);
clock.value = Date.parse('2026-10-03T16:00:01Z'); app.handlers.Show({});
assert.equal(app.run('state.today'), '2026-10-04');
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03'); app.complete();
assert.equal(midnightStore[D.KEY].records[0].date, '2026-10-03');
app.run('openDaily();startDaily()');
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-04');
assert.equal(app.run('state.challenge.history.length'), 0);
app.move(C.level(D.levelFor('2026-10-04')).solution[0]); app.handlers.Hide();
clock.value = Date.parse('2026-10-04T16:00:01Z'); app = boot(midnightStore, { clock });
app.run('openDaily();startDaily()');
assert.equal(app.run('state.challenge.dailyDate'), '2026-10-05'); assert.equal(app.run('state.challenge.history.length'), 0);

// Invitations can open a locked level as an isolated trial and can resume independently.
const invitedId = 11, invitation = queryFor(invitedId), invitedStore = protectedStore(), invitationBefore = protectedState(invitedStore);
app = boot(invitedStore, { query: invitation });
assert.equal(app.run('state.screen'), 'invitation');
assert.equal(app.run(`challenges.isUnlocked(state.challengeProgress,${invitedId})`), false);
app.run('startInvitation()'); assert.equal(app.run('state.challenge.invited'), true);
app.move(C.LEVELS[invitedId].solution[0]);
assert.equal(invitedStore[INVITE].history.length, 1); app.handlers.Hide();
app = boot(invitedStore, { query: invitation }); app.run('startInvitation()');
assert.equal(app.run('state.challenge.history.length'), 1); assert.equal(app.run('state.challenge.invited'), true);
app.run('undoMove(1);restartGame()');
assert.equal(app.run('state.challenge.invited'), true); assert.equal(app.run('state.challenge.history.length'), 0);
app.complete(); assert.equal(invitedStore[INVITE], null);
assert.deepStrictEqual(protectedState(invitedStore), invitationBefore);
assert.ok(!invitedStore[D.KEY]); assert.ok(app.events.some(([name]) => name === 'invite_result'));

// An incoming invite checkpoints the normal game; duplicate onShow is inert during the trial.
app = boot(protectedStore()); app.run('startChallenge(4,true)');
app.move(C.LEVELS[4].solution[1]); const normalActive = clone(app.store[C.KEY]);
app.handlers.Show({ query: invitation }); assert.equal(app.run('state.screen'), 'invitation');
assert.deepStrictEqual(app.store[C.KEY], normalActive);
app.run('startInvitation()'); app.move(C.LEVELS[invitedId].solution[0]);
app.handlers.Show({ query: invitation });
assert.equal(app.run('state.screen'), 'playing'); assert.equal(app.run('state.challenge.history.length'), 1);

// Broken or revised share parameters safely fall back to the normal menu.
for (const query of [{}, { challenge: '1', level: '999', rule: '1' }, { ...invitation, rule: '9999' },
  { ...invitation, level: '../12' }, { ...invitation, daily: '2026-02-30' }, { ...invitation, stars: '3', level: 12 }]) {
  const badStore = protectedStore(), before = protectedState(badStore), rejected = boot(badStore, { query });
  assert.equal(rejected.run('state.screen'), 'menu'); assert.deepStrictEqual(protectedState(badStore), before);
}
const yesterday = '2026-10-02'; app = boot(protectedStore(), { query: queryFor(D.levelFor(yesterday), yesterday) });
assert.equal(app.run('state.screen'), 'daily'); assert.ok(app.notices.some(text => text.includes('精选已更新')));
app.run('startDaily()'); assert.equal(app.run('state.challenge.dailyDate'), '2026-10-03');
assert.equal(app.run('state.challenge.level'), D.levelFor('2026-10-03'));

// Failed persistence retries after navigating away, without touching chapter saves.
const pendingStore = protectedStore(), pendingBefore = protectedState(pendingStore), fault = {};
app = boot(pendingStore, { fault }); app.run('openDaily();startDaily()');
fault.write = true; app.move(C.level(selected).solution[0]);
assert.equal(app.run('state.savePending'), true); assert.equal(pendingStore[D.KEY].active.history.length, 0);
app.run('returnHome()'); fault.write = false; app.handlers.Hide();
assert.equal(app.run('state.savePending'), false); assert.equal(pendingStore[D.KEY].active.history.length, 1);
assert.deepStrictEqual(protectedState(pendingStore), pendingBefore);

// Both new entry pages and result actions work through actual hit testing on small phones.
for (const size of [{ w: 320, h: 568 }, { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 430, h: 932 }]) {
  const ui = boot(protectedStore(), { size });
  const checkLabels = () => {
    const labels = ui.draw(); assert.ok(labels.length);
    for (const label of labels) {
      const font = Number(label.font.match(/([\d.]+)px/)[1]);
      const width = [...label.text].reduce((sum, char) => sum + font * (char.charCodeAt(0) < 128 ? .55 : 1), 0);
      const left = label.x - (label.align === 'center' ? width / 2 : label.align === 'right' ? width : 0);
      assert.ok(label.y >= 0 && label.y <= size.h && left >= -1 && left + width <= size.w + 1,
        `${size.w}×${size.h}: ${label.text} remains on screen`);
    }
  };
  const entry = ui.run('getHomeActions(layout).daily');
  assert.ok(entry.width >= 44 && entry.height >= 44 && entry.x + entry.width <= size.w && entry.y + entry.height <= size.h);
  ui.tap(entry); assert.equal(ui.run('state.screen'), 'daily'); checkLabels();
  const start = ui.run('getSpecialActions(layout).start');
  assert.ok(start.height >= 44 && start.y + start.height <= size.h);
  ui.tap(start); assert.equal(ui.run('state.screen'), 'playing'); ui.complete();
  const resultActions=ui.run('getGameOverActions(layout,state)');
  assert.ok(resultActions.retry.width>=44 && resultActions.retry.height>=44);
  assert.ok(resultActions.retry.x+resultActions.retry.width+8<=resultActions.share.x);
  assert.ok(ui.draw().some(label=>label.text==='再挑战一次')); checkLabels();
  ui.tap(resultActions.retry);
  assert.equal(ui.run('state.challenge.dailyDate'),'2026-10-03');
  assert.equal(ui.run('state.challenge.history.length'),0);
  assert.equal(ui.store[D.KEY].records.length,1); ui.complete();
  ui.tap(ui.run('getGameOverActions(layout,state).restart')); assert.equal(ui.run('state.screen'), 'daily');
  ui.tap(ui.run('getSpecialActions(layout).start')); assert.equal(ui.run('state.challenge.history.length'), 0);
  ui.handlers.Show({ query: invitation }); assert.equal(ui.run('state.screen'), 'invitation'); checkLabels();
  ui.tap(ui.run('getBackButton(layout)')); assert.equal(ui.run('state.screen'), 'menu');
  ui.handlers.Show({ query: invitation, scene: 1007 }); assert.equal(ui.run('state.screen'), 'invitation');
  ui.tap(ui.run('getSpecialActions(layout).start')); assert.equal(ui.run('state.challenge.invited'), true);
}
// Retry a one-star win immediately; personal-best stars survive worse subsequent runs.
const replay=boot(); replay.run('startChallenge(0)');
for(const earned of [1,3,1]){
  if(earned===1){replay.move([1,0,0]);replay.move([2,8,0]);}
  replay.move([0,3,4]);
  assert.equal(replay.run('challenges.stars(state.challenge)'),earned);
  const starsBefore=clone(replay.store[C.KEY].stars);
  replay.tap(replay.run('getGameOverActions(layout,state).retry'));
  assert.equal(replay.run('state.challenge.level'),0);
  assert.equal(replay.run('state.gameOver'),false);
  assert.equal(replay.run('state.challenge.history.length'),0);
  assert.deepStrictEqual(replay.store[C.KEY].stars,starsBefore);
  assert.deepStrictEqual(clone(replay.run('state.challenge.tray')),C.start(0).tray);
}
assert.equal(replay.store[C.KEY].stars[0],3);
assert.equal(replay.store[C.KEY].bestSteps[0],1);
assert.equal(boot(replay.store).run('state.challengeProgress.bestSteps[0]'),1);
const outdatedBest=clone(replay.store);outdatedBest[C.KEY].bestRules[0]=999;
assert.equal(boot(outdatedBest).run('state.challengeProgress.bestSteps[0]'),null);
assert.equal(boot(outdatedBest).run('state.challengeProgress.stars[0]'),3);
// Chapter ends and the final level can be replayed without advancing the level.
for(const id of [11,C.LEVELS.length-1]){
  const end=boot();end.run(`state.challengeProgress.stars.fill(3);startChallenge(${id})`);end.complete();
  end.tap(end.run('getGameOverActions(layout,state).retry'));
  assert.equal(end.run('state.challenge.level'),id);assert.equal(end.run('state.challenge.history.length'),0);
}
// First encounter teaching is contextual, skippable, non-blocking and remembered.
for(const [id,kind] of [[12,'ice'],[4,'stones'],[36,'flowers'],[28,'area'],[3,'cross']]){
  const teach=boot();teach.run(`state.challengeProgress.stars.fill(3);startChallenge(${id})`);
  assert.equal(teach.run('state.mechanicGuide.id'),kind);
  teach.run('stepAnimations(Date.now()+3000)');assert.equal(teach.run('state.mechanicGuide.progress'),1);
  teach.tap(teach.run('mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip'));
  assert.equal(teach.run('state.mechanicGuide'),null);
  assert.equal(teach.run('state.challenge.history.length'),0);
  assert.equal(teach.store.fangcunMechanicsSeenV1[kind],true);
  teach.run('restartGame()');assert.notEqual(teach.run('state.mechanicGuide&&state.mechanicGuide.id'),kind);
  assert.ok(teach.events.some(([event,data])=>event==='mechanic_guide'&&data.action==='skip'));
}
const taught=boot();taught.run('startChallenge(36)');taught.move(C.LEVELS[36].solution[0]);
assert.equal(taught.run('state.mechanicGuide.id'),'flowers');assert.ok(!taught.store.fangcunMechanicsSeenV1?.flowers);
taught.move(C.LEVELS[36].solution[1]);
assert.equal(taught.run('state.mechanicGuide'),null);assert.equal(taught.store.fangcunMechanicsSeenV1.flowers,true);
assert.ok(taught.events.some(([event,data])=>event==='mechanic_guide'&&data.action==='experienced'));
assert.ok(replay.events.some(([event,data])=>event==='result_action'&&data.action==='retry'));
// All daily-only puzzles run through real touch handlers, saves, results and retry.
for(let day=0;day<28;day++){
  const value=Date.parse('2026-10-05T04:00:00Z')+day*86400000;
  const exclusive=boot(protectedStore(),{clock:{value},size:{w:320,h:568}}),before=protectedState(exclusive.store);
  exclusive.run('openDaily();startDaily()');exclusive.draw();
  const id=exclusive.run('state.challenge.level');assert.ok(id<0);
  exclusive.move(C.level(id).solution[0]);exclusive.handlers.Hide();
  const saved=exclusive.store[D.KEY].active;assert.ok(D.restore(saved));
  exclusive.complete();assert.equal(D.completedCount(exclusive.store[D.KEY]),1);
  assert.deepStrictEqual(protectedState(exclusive.store),before);
  const labels=exclusive.draw();assert.ok(!labels.some(label=>/^-[0-9]+$/.test(label.text)));
  exclusive.tap(exclusive.run('getGameOverActions(layout,state).retry'));
  assert.equal(exclusive.run('state.challenge.level'),id);
  assert.equal(exclusive.run('state.challenge.history.length'),0);
  assert.ok(exclusive.events.some(([event,data])=>event==='daily_result'&&data.puzzle_id===String(id)&&data.level_id===0));
}
console.log('PASS: daily/invitation touch play, isolated progress, undo/restart/relaunch, Beijing rollover, share ingress and persistence retry');
