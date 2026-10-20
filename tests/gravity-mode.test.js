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
// A reachable crowded board: clearing another piece makes the blocked piece fit again.
let crowded = G.start('free', 1);
for (let i = 0; i < 49; i++) {
  const move = firstMove({ run: () => crowded });
  crowded = G.play(crowded, ...move).state;
}
assert.ok(G.restore(G.save(crowded)));
const blocked = boot(freeStore(crowded)); enter(blocked);
assert.deepStrictEqual(clone(blocked.run('gravityMode.model.unavailableTray')), [false, true, false]);
assert.ok(blocked.draw().some(item => item.text === '暂时无处可放'));
const blockedLabel=blocked.draw().find(item=>item.text==='暂时无处可放');
const luminance=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const trayBackground='#F0F0E7';
assert.ok((luminance(trayBackground)+.05)/(luminance(blockedLabel.color)+.05)>=4.5,'Unavailable-piece text stays legible');
blocked.run('globalThis.availabilityBeforeDraw=gravityMode.model.unavailableTray');
blocked.draw(); blocked.draw();
assert.ok(blocked.run('availabilityBeforeDraw===gravityMode.model.unavailableTray'), 'drawing reuses availability');
const blockedBox = geometry(blocked).trays[1];
const blockedFinger = { clientX: blockedBox.x + blockedBox.width / 2, clientY: blockedBox.y + 20, identifier: 7 };
blocked.handlers.TouchStart({ touches: [blockedFinger], changedTouches: [blockedFinger] });
assert.equal(blocked.run('gravityMode.touchId'), 7, 'blocked pieces remain draggable');
assert.ok(blocked.draw().some(item => item.text.includes('先试试其他方块')));
blocked.handlers.TouchCancel({ changedTouches: [blockedFinger] });
drag(blocked, [2, 6, 6]);
assert.equal(blocked.run('gravityMode.model.unavailableTray[1]'), false);
assert.ok(!blocked.draw().some(item => item.text === '暂时无处可放'));
blocked.tap(geometry(blocked).buttons.undo);
assert.equal(blocked.run('gravityMode.model.unavailableTray[1]'), true);
const blockedResume = boot(blocked.store); enter(blockedResume);
assert.equal(blockedResume.run('gravityMode.model.unavailableTray[1]'), true);
assert.ok(!('unavailableTray' in blocked.store[KEY].runs.free), 'derived flags do not enter saves');

// Settings reuse the real preference module with isolated storage; modals block board touches.
for (const size of [{ w: 320, h: 568 }, { w: 390, h: 844 }]) {
  const settings = boot({ ...protectedStore(), ...freeStore(crowded) }, { size, realFeedback: true });
  const ordinary = protectedState(settings.store); enter(settings);
  const initialRun = clone(settings.run('gravityMode.model.run'));
  const openSettings = () => settings.tap(settings.run('getSettingsButton(layout)'));
  const action = name => settings.tap(settings.run(`getSettingsActions(layout).${name}`));
  openSettings();
  assert.equal(settings.run('state.settingsOpen'), true);
  assert.ok(settings.draw().some(item => item.text === '设置'));
  for (const name of ['sound', 'music', 'vibration']) {
    action(name);
    assert.equal(settings.run(`state.${name}Enabled`), false);
    assert.equal(settings.store[`fangcun${name[0].toUpperCase() + name.slice(1)}Enabled`], false);
  }
  drag(settings, [2, 6, 6]);
  assert.deepStrictEqual(clone(settings.run('gravityMode.model.run')), initialRun);
  action('guide');
  assert.equal(settings.run('state.settingsOpen'), false);
  assert.equal(settings.run('state.helpOpen'), false);
  assert.ok(settings.draw().some(item => item.text === '落玉庭怎么玩'));
  openSettings(); assert.equal(settings.run('state.settingsOpen'), false, 'rules cannot click through to settings');
  settings.tap(geometry(settings).rulesClose);
  openSettings(); action('close');
  assert.equal(settings.run('state.settingsOpen'), false);
  drag(settings, [2, 6, 6], false);
  assert.ok(settings.run('gravityMode.model.animation'));
  openSettings();
  assert.equal(settings.run('state.settingsOpen'), true);
  assert.equal(settings.run('gravityMode.model.animation'), null, 'animation completes behind settings');
  const savedRun = clone(settings.run('gravityMode.model.run'));
  action('restart');
  assert.ok(settings.draw().some(item => item.text === '重新开始？'));
  settings.tap(settings.run('getConfirmActions(layout).cancel'));
  assert.deepStrictEqual(clone(settings.run('gravityMode.model.run')), savedRun);
  settings.handlers.Hide(); settings.handlers.Show({});
  assert.deepStrictEqual(G.restore(settings.store[KEY].runs.free), savedRun);
  action('menu'); settings.tap(settings.run('getConfirmActions(layout).confirm'));
  assert.equal(settings.run('state.screen'), 'menu');
  enter(settings);
  assert.deepStrictEqual(clone(settings.run('gravityMode.model.run')), savedRun);
  openSettings(); action('restart'); settings.tap(settings.run('getConfirmActions(layout).confirm'));
  assert.equal(settings.run('state.screen'), 'gravity');
  assert.equal(settings.run('gravityMode.model.run.steps'), 0);
  assert.equal(settings.run('state.settingsOpen'), false);
  assert.deepStrictEqual(protectedState(settings.store), ordinary);
  const reboot = boot(settings.store, { realFeedback: true }); enter(reboot);
  assert.equal(reboot.run('state.soundEnabled || state.musicEnabled || state.vibrationEnabled'), false);
}
console.log('PASS: gravity entry, undo/save isolation, unavailable pieces after clearing/undo/resume, shared settings, modal input blocking and small-screen flows');

// Shared entry reuses the normal introduction/resume route, with no imported score.
{
  const query={mode:'gravity',score:'99999'};
  const fresh=boot({}, {query});
  assert.equal(fresh.run('state.screen'),'gravity');
  assert.equal(fresh.run('gravityMode.model.run.mode'),2);
  const store={...protectedStore(),...freeStore()},before=protectedState(store);
  const shared=boot(store,{query});
  assert.equal(shared.run('gravityMode.model.run.mode'),'free');
  drag(shared,firstMove(shared));
  const current=clone(shared.run('gravityMode.model.run'));
  shared.handlers.Hide();shared.handlers.Show({query});
  assert.deepStrictEqual(clone(shared.run('gravityMode.model.run')),current,'repeat show never resets a run');
  const reboot=boot(store,{query});
  assert.deepStrictEqual(clone(reboot.run('gravityMode.model.run')),current,'cold share resumes own saved run');
  assert.deepStrictEqual(protectedState(store),before);
  reboot.run('returnHome()');reboot.handlers.Show({query});
  assert.equal(reboot.run('state.screen'),'gravity');
  assert.deepStrictEqual(clone(reboot.run('gravityMode.model.run')),current);
  const warm=boot();warm.run('startChallenge(12)');
  warm.move(require('../js/challenge/challenges').level(12).solution[0]);
  const chapter=clone(warm.run('state.challenge'));
  warm.run("state.settingsOpen=true;state.confirmAction='restart'");warm.handlers.Show({query});
  assert.equal(warm.run('state.screen'),'gravity');assert.equal(warm.run('state.confirmAction'),null);
  warm.run('startChallenge(12,true)');
  assert.deepStrictEqual(clone(warm.run('state.challenge.board')),chapter.board);
  assert.equal(warm.run('state.challenge.history.length'),1);
  const practice=boot();practice.run('continueOrStartGame()');
  assert.ok(practice.run('state.basics'));
  const saveKey=require('../js/persistence/saves').keyFor('easy');
  const ordinarySave=practice.store[saveKey];
  practice.handlers.Show({query});
  assert.equal(practice.run('state.screen'),'gravity');assert.equal(practice.run('state.basics'),null);
  assert.deepStrictEqual(practice.store[saveKey],ordinarySave);
}
console.log('PASS: gravity share cold/warm entry, duplicate show, saved progress and chapter/practice isolation');

// Capture real audio dispatch while driving the same input handlers as the game.
function soundApp(store) {
 const sounds=[];
 const app=boot(store,{realFeedback:true,api:{createInnerAudioContext(){return {stop(){},pause(){},play(){sounds.push(this.src);}};}}});
 enter(app);sounds.length=0;
 return {app,sounds};
}
{
 const {app,sounds}=soundApp({});
 drag(app,[0,3,8],false);
 assert.equal(sounds.filter(s=>s.endsWith('/place.wav')).length,0,'a clearing drop does not also play placement');
 assert.equal(sounds.filter(s=>s.endsWith('/clear.wav')).length,1);
 app.settle();
 assert.equal(sounds.filter(s=>s.endsWith('/win.wav')).length,1,'demo completion still celebrates');
 app.settle();assert.equal(sounds.filter(s=>s.endsWith('/win.wav')).length,1);
}
// Generate a repeatable legal free game with the actual engine, then replay through UI.
let soundRun=G.start('free',42);const soundMoves=[];
while(!soundRun.over && soundMoves.length<200){
 let next=null;
 for(let slot=0;slot<3&&!next;slot++)for(let r=0;r<9&&!next;r++)for(let c=0;c<9&&!next;c++)if(G.canPlay(soundRun,slot,c,r))next=[slot,c,r];
 assert(next);soundMoves.push(next);soundRun=G.play(soundRun,...next).state;
}
assert(soundRun.over && soundRun.score>0,'fixture reaches a scored game over');
for(const best of [0,soundRun.score,soundRun.score+100]){
 const store=freeStore();store[KEY].best=best;
 const {app,sounds}=soundApp(store);
 for(const move of soundMoves)drag(app,move);
 assert.equal(app.run('gravityMode.model.run.score'),soundRun.score);
 assert.equal(sounds.filter(s=>s.endsWith('/win.wav')).length,Number(soundRun.score>best),'only a new record celebrates');
 assert.equal(sounds.filter(s=>s.endsWith('/over.wav')).length,Number(soundRun.score<=best));
 assert(sounds.some(s=>s.endsWith('/place.wav')),'ordinary drops retain placement sound');
 const count=sounds.length;app.settle();assert.equal(sounds.length,count,'result is not repeated');
}
// Reopening an ended save must not replay celebration or treat its saved record as new.
{
 const store=freeStore(soundRun);store[KEY].best=soundRun.score;
 const {app,sounds}=soundApp(store);app.settle();
 assert(!sounds.some(s=>s.endsWith('/win.wav')||s.endsWith('/over.wav')));
 app.handlers.Hide();app.handlers.Show({query:{}});app.settle();
 assert(!sounds.some(s=>s.endsWith('/win.wav')||s.endsWith('/over.wav')));
}
console.log('PASS: gravity clear avoids overlapping placement; record/tie/loss and demo result sounds');

{
 const sent=[],app=boot(freeStore(soundRun),{api:{shareAppMessage:content=>sent.push(content)}});enter(app);
 app.tap(geometry(app).buttons.next);
 assert.equal(sent.length,1);assert.equal(sent[0].query,'mode=gravity');
 assert(sent[0].title.includes(String(soundRun.score)));
 assert(app.draw().some(t=>t.text==='挑战朋友'));
 assert(!JSON.stringify(app.store[KEY]).includes('resultProgress'),'visual progress is not persisted');
}
{
 const app=boot();enter(app);drag(app,[0,3,8],false);
 app.run('gravityMode.step(Date.now()+10000)');
 assert.equal(app.run('gravityMode.model.resultProgress'),0,'celebration starts after the chain');
 app.handlers.Hide();assert.equal(app.run('gravityMode.model.resultProgress'),1);
 app.handlers.Show({query:{}});app.run('gravityMode.step(Date.now()+20000)');
 assert.equal(app.run('gravityMode.model.resultProgress'),1,'background return does not replay celebration');
}
console.log('PASS: gravity result share button, ephemeral celebration and background cleanup');
