const assert = require('assert');
const { boot, clone, protectedStore, protectedState } = require('./helpers/game-harness');
const G = require('../js/gravity/gravity-engine');
const { KEY } = require('../js/gravity/gravity-mode');
const U = require('../js/rules/undo-budget');
const { MODE_ORDER } = require('../js/config');
const geometry = app => app.run("require('./js/gravity/gravity-view').layoutFor(layout,gravityMode.model.run.mode!=='free')");
function enter(app) {
  app.tap(app.run('getHomeActions(layout).choose'));
  assert.equal(app.run('state.screen'), 'maps');
  app.tap(app.run('getGravityEntry(layout)'));
  assert.equal(app.run('state.screen'), 'gravity');
}
function drag(app, [slot, c, r], settle = true) {
  const v = geometry(app), box = v.trays[slot];
  const id = app.run(`gravityMode.model.run.tray[${slot}]`), shape = G.shape(id);
  const w = Math.max(...shape.cells.map(p => p[0])) + 1, h = Math.max(...shape.cells.map(p => p[1])) + 1;
  const from = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, identifier: 3 };
  const to = { clientX: v.board.x + (c + w / 2) * v.cell, clientY: v.board.y + (r + h / 2) * v.cell + Math.min(86, v.cell * 2.2), identifier: 3 };
  app.handlers.TouchStart({ touches: [from], changedTouches: [from] });
  app.handlers.TouchEnd({ touches: [], changedTouches: [to] });
  if (settle) app.settle();
}
function freeStore(run=G.start('free',42)) { return {fangcunTutorialSeen:true,[KEY]:{version:1,runs:{free:G.save(run)},completed:[],best:0,guideSeen:true}}; }
function firstMove(app) {
  const run=app.run('gravityMode.model.run');
  for(let slot=0;slot<3;slot++)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(G.canPlay(run,slot,c,r))return [slot,c,r];
  throw Error('No legal move');
}
// One skippable demonstration, no six-card menu. Ordinary progress is untouched.
for(const size of [{w:320,h:568},{w:390,h:844}]){
 const app=boot(protectedStore(),{size}),before=protectedState(app.store);enter(app);
 assert.equal(app.run('gravityMode.model.run.mode'),2);
 const v=geometry(app);
 for(const rect of [...Object.values(v.buttons),...v.trays,v.rulesDemo,v.rulesClose]){
  assert.ok(rect.height>=44 && rect.width>=44);
  assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=size.w && rect.y+rect.height<=size.h);
 }
 assert.ok(v.statusY+19<=v.buttons.undo.y-8);
 assert.ok(!app.draw().some(item=>item.text.includes('选择题目')||item.text.includes('自由试验')));
 const initial=clone(app.run('gravityMode.model.run'));
 drag(app,[0,0,5]);assert.deepStrictEqual(clone(app.run('gravityMode.model.run')),initial);
 assert.ok(app.run('gravityMode.model.message').includes('框出的空位'));
 drag(app,G.PUZZLES[2].solution[0]);
 assert.equal(app.run('gravityMode.model.run.won'),true);
 assert.equal(app.run('gravityMode.model.animation'),null);
 assert.equal(app.store[KEY].best,0,'demo points never enter the free record');
 app.tap(geometry(app).buttons.next);
 assert.equal(app.run('gravityMode.model.run.mode'),'free');
 app.tap(geometry(app).buttons.back);assert.equal(app.run('state.screen'),'maps');
 app.tap(app.run('getGravityEntry(layout)'));assert.equal(app.run('gravityMode.model.run.mode'),'free');
 assert.deepStrictEqual(protectedState(app.store),before);
}
// Skipping is remembered; old lesson data survives without being shown as levels.
const oldLesson=G.play(G.start(1),0,2,8).state;
const skipped=boot({[KEY]:{version:1,runs:{1:G.save(oldLesson)},completed:[],best:0}});
enter(skipped);skipped.tap(geometry(skipped).buttons.next);skipped.handlers.Hide();
const again=boot(skipped.store);enter(again);
assert.equal(again.run('gravityMode.model.run.mode'),'free');
assert.deepStrictEqual(G.restore(again.store[KEY].runs[1]),oldLesson);
const completed=boot({[KEY]:{version:1,completed:[0],runs:{},best:0}});enter(completed);
assert.equal(completed.run('gravityMode.model.run.mode'),'free');
const legacyFree=G.play(G.start('free',42),0,0,0).state;
const noFlag=freeStore(legacyFree);delete noFlag[KEY].guideSeen;
const returning=boot(noFlag);enter(returning);assert.equal(returning.run('gravityMode.model.run.steps'),1);
// One undo survives leaving/reopening/process loss; only an explicit restart resets it.
const app=boot(freeStore());enter(app);drag(app,firstMove(app));app.handlers.Hide();
const resumed=boot(app.store);enter(resumed);assert.equal(resumed.run('gravityMode.model.run.steps'),1);
resumed.tap(geometry(resumed).buttons.undo);assert.equal(resumed.run('gravityMode.model.run.steps'),0);
assert.equal(resumed.run('gravityMode.model.run.undoUsed'),true);drag(resumed,firstMove(resumed));
const twice=boot(resumed.store);enter(twice);twice.tap(geometry(twice).buttons.undo);
assert.equal(twice.run('gravityMode.model.run.steps'),1);assert.equal(twice.run('gravityMode.model.run.undoUsed'),true);
twice.tap(geometry(twice).buttons.retry);assert.equal(twice.run('gravityMode.model.confirmRestart'),true);
twice.tap(geometry(twice).cancel);assert.equal(twice.run('gravityMode.model.run.steps'),1);
// Rules block the underlying board; replaying the demo preserves score/randomness/undo.
const preserved=clone(twice.run('gravityMode.model.run'));
twice.tap(geometry(twice).buttons.next);assert.equal(twice.run('gravityMode.model.rulesOpen'),true);
drag(twice,firstMove(twice));assert.deepStrictEqual(clone(twice.run('gravityMode.model.run')),preserved);
twice.tap(geometry(twice).rulesDemo);assert.equal(twice.run('gravityMode.model.run.mode'),2);
drag(twice,[0,3,8],false);assert.ok(twice.run('gravityMode.model.animation'));
const settled=clone(twice.run('gravityMode.model.run'));twice.handlers.Hide();
assert.equal(twice.run('gravityMode.model.animation'),null);
assert.deepStrictEqual(G.restore(twice.store[KEY].runs[2]),settled);
// Reopening the app while in a replay always resumes the preserved free run.
const lost=boot(twice.store);enter(lost);assert.deepStrictEqual(clone(lost.run('gravityMode.model.run')),preserved);
twice.handlers.Show({});twice.tap(geometry(twice).buttons.next);
assert.deepStrictEqual(clone(twice.run('gravityMode.model.run')),preserved);
twice.tap(geometry(twice).buttons.retry);twice.tap(geometry(twice).accept);
assert.equal(twice.run('gravityMode.model.run.steps'),0);assert.equal(twice.run('gravityMode.model.run.undoUsed'),false);
// No repaint loop once animations finish; failed writes use the existing retry queue.
twice.settle();twice.run('loop();loop();stepAnimations(Date.now()+5000)');assert.equal(twice.run('pendingPresents'),0);
const fault={write:false},fail=boot(freeStore(),{fault});enter(fail);
fault.write=true;drag(fail,firstMove(fail));assert.equal(fail.run("require('./js/persistence/storage').hasPending(wx)"),true);
fault.write=false;fail.handlers.Show({});assert.equal(fail.store[KEY].runs.free.steps,1);
assert.equal(fail.run("require('./js/persistence/storage').hasPending(wx)"),false);
// All three ordinary garden layouts use the same attempt-wide free undo.
for (const mode of MODE_ORDER) {
  const garden = boot({ fangcunTutorialSeen: true, fangcunGameModeV2: mode });
  garden.run(`state.mode='${mode}';continueOrStartGame()`);
  const move = garden.run("(()=>{for(let i=0;i<3;i++)for(let r=0;r<state.board.length;r++)for(let c=0;c<state.board[0].length;c++)if(canPlace(state.board,state.tray[i],c,r))return [i,c,r]})()");
  const initial = clone(garden.run('state.board')); garden.move(move);
  assert.equal(garden.run('state.piecesPlaced'), 1, mode);
  assert.ok(garden.draw().some(item => item.text === '剩余 1 次'), mode);
  const saved = boot(garden.store); saved.run(`state.mode='${mode}';continueOrStartGame()`);
  assert.equal(U.remaining(saved.run('state.undoBudget')), 1);
  saved.tap(saved.run('getChallengeActions(layout,state).undo'));
  assert.equal(saved.run('state.piecesPlaced'), 0, mode);
  assert.deepStrictEqual(clone(saved.run('state.board')), initial);
  saved.move(move);
  const spent = boot(saved.store); spent.run(`state.mode='${mode}';continueOrStartGame()`);
  assert.equal(U.remaining(spent.run('state.undoBudget')), 0);
  spent.tap(spent.run('getChallengeActions(layout,state).undo'));
  assert.equal(spent.run('state.piecesPlaced'), 1);
  spent.run('state.gameOver=true;undoMove()'); assert.equal(spent.run('state.gameOver'), true);
  spent.run('restartGame()'); assert.equal(U.remaining(spent.run('state.undoBudget')), 1);
}
// Interrupted gestures and other fingers cannot place or consume an undo.
const touchApp = boot(); enter(touchApp); touchApp.tap(geometry(touchApp).buttons.next);
const tray = geometry(touchApp).trays[0];
const finger = { clientX: tray.x + tray.width / 2, clientY: tray.y + tray.height / 2, identifier: 3 };
touchApp.handlers.TouchStart({ touches: [finger], changedTouches: [finger] });
touchApp.handlers.TouchEnd({ touches: [finger], changedTouches: [{ ...finger, identifier: 9 }] });
assert.equal(touchApp.run('gravityMode.touchId'), 3);
touchApp.handlers.TouchCancel({ changedTouches: [{ ...finger, identifier: 9 }] });
assert.equal(touchApp.run('gravityMode.touchId'), 3);
touchApp.handlers.Hide(); assert.equal(touchApp.run('gravityMode.touchId'), null);
touchApp.handlers.Show({});
assert.equal(touchApp.run('gravityMode.model.run.steps'), 0);
assert.equal(touchApp.run('gravityMode.model.run.undoUsed'), false);
// A fresh touch without the old owner recovers from a lost touch-end event.
touchApp.handlers.TouchStart({ touches: [finger], changedTouches: [finger] });
const replacement = { ...finger, identifier: 4 };
touchApp.handlers.TouchStart({ touches: [replacement], changedTouches: [replacement] });
assert.equal(touchApp.run('gravityMode.touchId'), 4);
touchApp.handlers.TouchCancel({ changedTouches: [replacement] });
assert.equal(touchApp.run('gravityMode.touchId'), null);
const damaged = boot({ [KEY]: { version: 1, runs: { 1: { version: 2, board: [] } } } });
enter(damaged); damaged.tap(geometry(damaged).buttons.next);
assert.equal(damaged.run('gravityMode.model.run.steps'), 0);
assert.ok(damaged.events.some(([event]) => event === 'gravity_invalid_save'));
const legacy = G.restore({ version: 1, mode: 1, seed: 271828, moves: [[0, 2, 8]], undoUsed: true });
assert.ok(legacy); assert.deepStrictEqual(G.restore(G.save(legacy)), legacy);
for (const corrupt of [{ ...G.save(legacy), board: [] }, { ...G.save(legacy), steps: -1 }, { ...G.save(legacy), won: true }]) assert.equal(G.restore(corrupt), null);
assert.ok(JSON.stringify(G.save(legacy)).length < 2000);
console.log('PASS: gravity direct entry, optional demo, undo/resume/restart, animation/background, write retry, idle rendering, isolation and all three garden undo budgets');
