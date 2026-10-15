const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const saves = require('../js/persistence/saves');
const { MODE_ORDER, MODES } = require('../js/config');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const file = path.resolve(__dirname, '../game.js');
function boot(storage, faults = {}) {
  const handlers = {}, labels = [], notices = [];
  const ctx = new Proxy({}, {get:(o,k)=>k==='fillText'?(text=>labels.push(text)):(k in o?o[k]:()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const wx = {getWindowInfo:()=>({windowWidth:390,windowHeight:844}),createCanvas:()=>({getContext:()=>ctx}),
    getStorageSync:key=>clone(storage[key]),
    setStorageSync(key,value){if(faults.write)throw Error('disk full');storage[key]=clone(value);},
    showToast: options=>notices.push(options.title)};
  Object.assign(wx, faults.api || {});
  for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show'])wx['on'+name]=fn=>{handlers[name]=fn;};
  const localRequire=createRequire(file);
  const sandbox=vm.createContext({wx,requestAnimationFrame(){},require:name=>name==='./js/platform/feedback'
    ?{settings:{},playMusic(){},placement(){},elimination(){},suspend(){},resume(){}}:localRequire(name)});
  vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
  const run=code=>vm.runInContext(code,sandbox);
  function click(rect){const p={clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,identifier:1};
    handlers.TouchStart({touches:[p],changedTouches:[p]});handlers.TouchEnd({touches:[],changedTouches:[p]});
    run('stepAnimations(Date.now()+1000); stepAnimations(Date.now()+2000)');}
  function drop(col,row,settle=true){
    const start=run('({clientX:layout.horizontalPadding+layout.traySlotWidth/2,clientY:layout.trayY,identifier:2})');
    const end=run(`({clientX:layout.boardX+(${col}+.5)*layout.cellSize,
      clientY:layout.boardY+(${row}+.5)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:2})`);
    handlers.TouchStart({touches:[start],changedTouches:[start]});handlers.TouchEnd({touches:[],changedTouches:[end]});
    if(settle)run('stepAnimations(Date.now()+1000); stepAnimations(Date.now()+2000)');
  }
  return {run,handlers,click,drop,labels,notices};
}
const storage={};
for(const id of MODE_ORDER){
  const app=boot(storage);app.run(`state.mode='${id}'; restartGame(); state.tray[0]={id:'dot',cells:[[0,0]]}`);
  app.drop(id==='courtyard'?1:0,0);
  const saved=clone(storage[saves.keyFor(id)]);
  assert.strictEqual(saved.piecesPlaced,1);
  const reopened=boot(storage);
  reopened.run('state.screen="maps";renderScene(ctx,layout,state)');
  assert.ok(reopened.labels.includes('继续游戏 · 1 分'));
  reopened.click(reopened.run(`getMenuActions(layout)['${id}']`));
  assert.strictEqual(reopened.run('state.screen'),'playing');
  assert.deepStrictEqual(clone(reopened.run('saves.snapshot(state)')),saved);
  assert.strictEqual(reopened.run('state.inputLocked'),false);
  assert.strictEqual(reopened.run('state.drag'),null);
}
assert.ok(MODE_ORDER.every(id=>storage[saves.keyFor(id)]));
// A clear that refreshes the tray is saved BEFORE the animation, including its lucky piece.
const app=boot(storage);
app.run(`state.mode='easy'; restartGame();
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)state.board[r][c]=1;
  state.board[2][2]=0; state.energy=2;state.energyPalaces=[0];
  state.tray=[{id:'dot',cells:[[0,0]]},null,null];`);
app.drop(2,2,false);
assert.ok(app.run('Boolean(clearAnimation)'));
const duringClear=clone(storage[saves.keyFor('easy')]);
assert.strictEqual(duringClear.board[2][2],0);
assert.strictEqual(duringClear.tray.filter(s=>s&&s.lucky).length,1);
assert.ok(saves.decode(duringClear,'easy'));
const resumed=boot(storage);resumed.run('state.screen="maps"');resumed.click(resumed.run('getMenuActions(layout).easy'));
assert.deepStrictEqual(clone(resumed.run('saves.snapshot(state)')),duringClear);
// Best scores stay separate, and the original comparison baseline survives resume.
assert.strictEqual(resumed.run('state.startingBest'),duringClear.startingBest);
assert.ok(MODE_ORDER.every(id=>storage[MODES[id].bestKey]>0));
// Returning to menu keeps the save; explicit restart replaces only the active map.
resumed.run('state.settingsOpen=true;state.confirmAction="menu"');
resumed.click(resumed.run('getConfirmActions(layout).confirm'));
assert.strictEqual(resumed.run('state.screen'),'menu');
assert.deepStrictEqual(storage[saves.keyFor('easy')],duringClear);
const other=clone(storage[saves.keyFor('medium')]);
resumed.run('state.mode="easy";restartGame()');
assert.strictEqual(storage[saves.keyFor('easy')].score,0);
assert.deepStrictEqual(storage[saves.keyFor('medium')],other);
resumed.run('state.gameOver=true;saveCurrentGame()');
assert.strictEqual(storage[saves.keyFor('easy')],null);
assert.strictEqual(boot(storage).run('Boolean(state.savedGames.easy)'),false);
// Bad dimensions, scores, shape ids, map revisions and unreachable targets fail closed.
const valid=storage[saves.keyFor('medium')];
for(const corrupt of [s=>{s.board=[]},s=>{s.score=-1},s=>{s.score=Infinity},s=>{s.rule='old'},
  s=>{s.tray[0]={id:'bad',lucky:false}},s=>{s.energyPalaces=[99]},s=>{s.version=2}]){
 const bad=clone(valid);corrupt(bad);assert.strictEqual(saves.decode(bad,'medium'),null);
}
const damaged=clone(storage);damaged[saves.keyFor('medium')]={version:1};
assert.strictEqual(boot(damaged).run('Boolean(state.savedGames.medium)'),false);
// Saving failure is visible, doesn't stop gameplay, and retries on backgrounding.
const faults={write:true};const failing=boot({},faults);
failing.run('restartGame()');assert.strictEqual(failing.notices.length,1);
failing.run('saveCurrentGame()');assert.strictEqual(failing.notices.length,1);
failing.run('state.score=10;saveBestScore();saveCurrentGame()');
assert.strictEqual(failing.run('state.best'),10);
faults.write=false;failing.handlers.Hide();
assert.strictEqual(failing.run('saveFailureNotified'),false);
console.log('Save/relaunch/animation/failure checks passed');

// The actual home entry opens rankings; map browsing never changes the saved game.
const rankMessages=[];
const ranked=boot(storage,{api:{
 getOpenDataContext:()=>({canvas:{},postMessage:m=>rankMessages.push(m)}),
 getSetting:o=>o.success({authSetting:{'scope.WxFriendInteraction':true}}),
 authorize:o=>o.success()
}});
const beforeRank=clone(storage);
ranked.click(ranked.run('getRankingButton(layout)'));
assert.strictEqual(ranked.run('leaderboard.isOpen()'),true);
ranked.run('present()');
ranked.click(ranked.run('leaderboard.actions(layout).nextMap'));
assert.strictEqual(rankMessages.filter(m=>m.type==='show').length,2);
ranked.click(ranked.run('leaderboard.actions(layout).close'));
assert.strictEqual(ranked.run('leaderboard.isOpen()'),false);
assert.deepStrictEqual(storage,beforeRank);
ranked.click(ranked.run('getHomeActions(layout).choose'));
ranked.click(ranked.run('getMenuActions(layout).medium'));
assert.strictEqual(ranked.run('state.screen'),'playing');
console.log('Home leaderboard entry/return/save isolation checks passed');

// Two complete palaces: targets refill every two clears, energy still charges every three.
const blocked=[];for(let i=2;i<9;i++)blocked.push([Math.floor(i/3)*3,i%3*3]);
MODES.smallTest={...MODES.easy,id:'smallTest',blocked,bestKey:'testSmall'};
const small=boot({fangcunLuckyWelcomeUsed:true});small.run("state.mode='smallTest';state.bestScores.smallTest=0;restartGame()");
for(let i=0;i<6;i++){
 small.run(`const target${i}=state.energyPalaces[0];const result${i}=collectPalaceEnergy({palaces:[[target${i}%3,Math.floor(target${i}/3)]]});moveClearedEnergyPalaces(result${i}.clearedEnergyPalaces)`);
 const saved=clone(small.run('saves.snapshot(state)'));
 assert.ok(saves.decode(saved,'smallTest'));assert.equal(saved.energy,(i+1)%3);
}
assert.equal(small.run('state.luckyPendingCount'),2);
MODES.smallTest.blocked=blocked.concat([[0,0],[0,3]]);
small.run('restartGame()');assert.ok(saves.decode(clone(small.run('saves.snapshot(state)')),'smallTest'));
delete MODES.smallTest;
// Idle shared-canvas polling is 10 Hz; ordinary input still presents immediately.
ranked.run('pendingPresents=0;lastRankingPresent=-Infinity;let testNow=0;Date.now=()=>testNow;let frames=0;present=()=>{frames++}');
// Reopen after the existing entry/return test.
ranked.run("leaderboard.open(wx,layout,'easy',state.bestScores)");
ranked.run('for(let i=0;i<100;i++){testNow=i*10;loop()}');
assert.equal(ranked.run('frames'),10);
ranked.run('invalidateScene();loop()');assert.equal(ranked.run('frames'),11);
console.log('Small-palace saves and 10 Hz ranking idle rendering passed');

// Removed revival metadata is tolerated in existing saves and is no longer carried forward.
const legacy=clone(storage[saves.keyFor('medium')]);legacy.reviveUsed=true;
assert.ok(saves.decode(legacy,'medium'));assert.equal(saves.decode(legacy,'medium').reviveUsed,true);
console.log('Old revival metadata does not invalidate a garden save');

// Welcome energy is once per installation, persists mid-game, and is not renewed by restarting.
const welcomeStore={},welcome=boot(welcomeStore);
welcome.run('restartGame()');assert.equal(welcome.run('state.energy'),2);assert.ok(welcome.run('state.welcomeEnergy'));
const resumedWelcome=boot(welcomeStore);resumedWelcome.run('continueOrStartGame()');
assert.equal(resumedWelcome.run('state.energy'),2);assert.ok(resumedWelcome.run('state.welcomeEnergy'));
resumedWelcome.run('restartGame()');assert.equal(resumedWelcome.run('state.energy'),0);
assert.equal(welcomeStore.fangcunLuckyWelcomeUsed,true);
// Save failure text must not falsely claim the stars have been stored.
const failedStars=boot({}, {write:true});
failedStars.run('startChallenge(0);state.challenge.won=true;state.challenge.ended=true;state.challenge.history=[[0,3,4]];applyChallenge(state.challenge);saveCurrentGame();state.gameOverProgress=1;present()');
assert.ok(failedStars.labels.includes('星级待保存，请稍候再退出'));
assert.ok(!failedStars.labels.includes('已保存星级，可以随时回来重玩'));
// Shared-canvas content is below the press overlay, so ranking buttons respond visually.
const paint=boot({}, {api:{getOpenDataContext:()=>({canvas:{},postMessage(){}}),getSetting:o=>o.success({authSetting:{'scope.WxFriendInteraction':true}})}});
paint.run("leaderboard.open(wx,layout,'easy',{});const drawOrder=[];const originalRankDraw=leaderboard.draw;leaderboard.draw=()=>drawOrder.push('ranking');ctx.fill=()=>{if(ctx.globalAlpha===.12)drawOrder.push('feedback')};state.pressedButton='ranking';state.pressedRect=leaderboard.actions(layout).refresh;present();leaderboard.draw=originalRankDraw");
assert.deepStrictEqual(clone(paint.run('drawOrder.slice(-2)')),['ranking','feedback']);
console.log('Welcome energy, truthful saving status and visible ranking feedback passed');
