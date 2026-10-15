const assert=require('assert');
const fs=require('fs'),vm=require('vm'),path=require('path');
const {createRequire}=require('module');
const C=require('../js/challenge/challenges');
const B=require('../js/rules/board');
const clone=x=>JSON.parse(JSON.stringify(x));
// Every authored puzzle is legal, has no pre-cleared regions, and has a 3-star solution.
for(const level of C.LEVELS){
 const run=C.start(level.id),initial=clone(run),done=B.findCompletedRegions(run.board);
 assert.equal(done.rows.length+done.cols.length+done.palaces.length,0,level.title);
 for(const [c,r] of run.stones)assert.equal(run.board[r][c],1);
 for(const [c,r] of run.ice)assert.equal(run.board[r][c],1);
 if(level.id>=3)for(let slot=0;slot<3;slot++)for(let r=0;r<9;r++)for(let c=0;c<9;c++){
  const trial=clone(run);if(C.play(trial,slot,c,r))assert.equal(trial.won,false,'Non-tutorial puzzle cannot finish in one move');
 }
 for(const move of level.solution){
  assert.deepStrictEqual(clone(C.restore(C.checkpoint(run))),clone(run));
  assert.ok(C.play(run,...move),level.title);
 }
 assert.ok(run.won,level.title);assert.equal(C.stars(run),3);assert.equal(C.checkpoint(run),null);
 assert.equal(C.play(run,0,0,0),null);assert.deepStrictEqual(clone(C.start(level.id)),initial);
}
// 200 deterministic random games per level: budgets terminate, checkpoints replay exactly,
// and invalid input cannot change a board or consume a move.
let seed=28109,games=0,moves=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const level of C.LEVELS)for(let i=0;i<200;i++){
 const run=C.start(level.id);
 while(!run.ended){
  const options=[];
  run.tray.forEach((piece,slot)=>{if(piece)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(B.canPlace(run.board,piece,c,r))options.push([slot,c,r]);});
  assert.ok(options.length);
  const before=clone(run);assert.equal(C.play(run,0,-9,0),null);assert.deepStrictEqual(clone(run),before);
  const result=C.play(run,...options[Math.floor(random()*options.length)]);moves++;
  for(const [c,r] of level.blocked||[]){assert.equal(run.board[r][c],2);assert.ok(!result.cells.some(p=>p[0]===c&&p[1]===r));}
  const completed=C.completedRegions(run);assert.equal(completed.rows.length+completed.cols.length+completed.palaces.length,0);
  for(const [c,r] of result.brokenIce){assert.equal(run.board[r][c],1);assert.ok(!run.ice.some(p=>p[0]===c&&p[1]===r));}
  if (!run.won) assert.deepStrictEqual(clone(C.undo(run)), before, 'Undo restores the entire turn, even after failure');
  else assert.equal(C.undo(run), null);
  if(!run.ended)assert.deepStrictEqual(clone(C.restore(C.checkpoint(run))),clone(run));
  assert.ok(run.history.length<=level.limit);
  for(const [c,r] of run.stones)assert.equal(run.board[r][c],1);
 }
 games++;
}
for(const saved of [null,{level:0,history:[[0,-1,4]]},{level:0,history:[[0,3.5,4]]},{level:99,history:[]},{level:0,history:[[0,3,4],[1,0,0]]}])assert.equal(C.restore(saved),null);
assert.deepStrictEqual(C.load({getStorageSync:()=>({version:1,stars:[3,2]})}).stars,[3,2,...Array(C.LEVELS.length-2).fill(0)]);
assert.deepStrictEqual(C.load({getStorageSync:()=>({version:1,stars:Array(15).fill(3)})}).stars,[...Array(15).fill(3),...Array(C.LEVELS.length-15).fill(0)]);
assert.equal(C.unlocked(C.load({getStorageSync:()=>({version:1,stars:[0,3,...Array(10).fill(0)]})})),0);

const gamePath=path.resolve(__dirname,'../game.js'),req=createRequire(gamePath);
function boot(storage,fault={}){
 const handlers={},notices=[];
 const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const wx={getWindowInfo:()=>({windowWidth:390,windowHeight:844,safeArea:{top:44,bottom:810}}),createCanvas:()=>({getContext:()=>ctx}),
  getStorageSync:k=>storage[k]===undefined?undefined:clone(storage[k]),
  setStorageSync:(k,v)=>{if(fault.write)throw Error('full');storage[k]=clone(v)},showToast:o=>notices.push(o.title)};
 Object.assign(wx, fault.api || {});
 for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show'])wx['on'+name]=fn=>handlers[name]=fn;
 const sandbox=vm.createContext({wx,requestAnimationFrame(){},require:n=>n==='./js/platform/feedback'?{settings:{},playMusic(){},placement(){},elimination(){},suspend(){},resume(){}}:req(n)});
 vm.runInContext(fs.readFileSync(gamePath,'utf8'),sandbox);const run=s=>vm.runInContext(s,sandbox);
 const settle=()=>run('stepAnimations(Date.now()+1000);stepAnimations(Date.now()+2000)');
 const tap=rect=>{const p={clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,identifier:7};handlers.TouchStart({touches:[p],changedTouches:[p]});handlers.TouchEnd({touches:[],changedTouches:[p]});settle();};
 function drop(slot,c,r,finish=true){
  const from=run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:3})`);
  const to=run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:3}})()`);
  handlers.TouchStart({touches:[from],changedTouches:[from]});handlers.TouchEnd({touches:[],changedTouches:[to]});if(finish)settle();
 }
 return {run,tap,drop,settle,handlers,notices};
}
const storage={fangcunBestV2Easy:123};let app=boot(storage);
app.tap(app.run('getHomeActions(layout).challenge'));app.tap(app.run('getHomeActions(layout).choose'));
assert.equal(app.run('state.screen'),'levels');app.tap(app.run('getLevelActions(layout)[1]'));assert.equal(app.run('state.screen'),'levels');
app.tap(app.run('getLevelActions(layout)[0]'));
for(const level of C.CHAPTERS.flatMap((_,chapter)=>C.chapterLevels(chapter))){
 assert.equal(app.run('state.challenge.level'),level.id);
 level.solution.forEach((move,i)=>app.drop(...move,i<level.solution.length-1));
 // Even during the clear animation the completed progress has been persisted.
 assert.equal(storage[C.KEY].stars[level.id],3);assert.equal(storage[C.KEY].active,null);
 app.settle();app.run('present()');assert.equal(app.run('state.challenge.won'),true);
 assert.equal(storage.fangcunBestV2Easy,123);
 app.tap(app.run('getGameOverActions(layout).restart'));
}
assert.equal(app.run('state.screen'),'levels');assert.ok(storage[C.KEY].stars.every(x=>x===3));
// Resume actual handlers after a clear mid-level; the rewarded target cannot be cleared twice.
app.run('startChallenge(4)');C.LEVELS[4].solution.slice(0,3).forEach((m,i)=>app.drop(...m,i<2));
const checkpoint=clone(storage[C.KEY]);app=boot(storage);
app.tap(app.run('getHomeActions(layout).challenge'));app.tap(app.run('getHomeActions(layout).start'));
assert.equal(app.run('state.challenge.progress'),1);assert.equal(app.run('state.piecesPlaced'),3);
assert.deepStrictEqual(storage[C.KEY],checkpoint);app.drop(...C.LEVELS[4].solution[3]);assert.equal(app.run('state.challenge.won'),true);
app.tap(app.run('getGameOverActions(layout).menu'));app.tap(app.run('getHomeActions(layout).garden'));app.tap(app.run('getHomeActions(layout).start'));
assert.equal(app.run('state.challenge'),null);assert.equal(app.run('state.best'),123);
// Failed save is visible; returning to background retries the same progress.
const fault={};app=boot({},fault);app.run('startChallenge(0)');fault.write=true;app.drop(0,3,4);assert.equal(app.notices.length,1);
fault.write=false;app.handlers.Hide();assert.equal(app.run('saveFailureNotified'),false);
console.log(`PASS: ${C.LEVELS.length} solvable levels, ${games} random games / ${moves} moves, actual UI progression, resume, score isolation and storage retry`);

// New controls use the actual touch handlers, including modal shielding and failure recovery.
const undoStorage={ [C.KEY]: { version:1, stars:Array(12).fill(3),active:null } };
app=boot(undoStorage);app.run('startChallenge(10)');
app.tap(app.run('getChallengeActions(layout).undo'));assert.equal(app.notices.at(-1),'当前没有可撤回的落子');
app.drop(...C.LEVELS[10].solution[0]);app.drop(...C.LEVELS[10].solution[1]);
const beforeRefill=clone(app.run('state.challenge'));
app.drop(...C.LEVELS[10].solution[2]);assert.equal(app.run('state.challenge.cursor'),6);
app.tap(app.run('getChallengeActions(layout).undo'));
beforeRefill.undoBudget.spent++;
assert.deepStrictEqual(clone(app.run('state.challenge')),beforeRefill);
assert.deepStrictEqual(clone(C.restore(undoStorage[C.KEY].active)),beforeRefill);
assert.equal(app.run('getChallengeActions(layout,state).hint'),undefined);
app.drop(...C.LEVELS[10].solution[2]);assert.equal(app.run('state.piecesPlaced'),3);
const failureMoves=[[1,0,0],[2,8,7],[0,0,8],[0,3,0]];
for(let i=0;i<2;i++){
 app.run('startChallenge(0)');failureMoves.forEach(m=>app.drop(...m));
 assert.equal(app.run('state.gameOver'),true);assert.equal(app.run('state.challenge.won'),false);
}
assert.ok(!app.notices.some(n=>n.includes('思路提示')));
assert.equal(app.run('getGameOverActions(layout).hint'),undefined);
app.tap(app.run('getGameOverActions(layout,state).undo'));
assert.equal(app.run('state.playPanel'),'undo');
assert.equal(app.run('state.gameOver'),true,'choosing rollback does not consume it');
app.tap(app.run('getPlayPanelActions(layout,state).confirm'));
assert.equal(app.run('state.gameOver'),false);assert.equal(app.run('state.piecesPlaced'),1);
assert.ok(app.run('state.feedback').includes('剩余 0 次'));
assert.equal(undoStorage[C.KEY].active.history.length,1);
app=boot(undoStorage);app.tap(app.run('getHomeActions(layout).challenge'));app.tap(app.run('getHomeActions(layout).start'));
assert.equal(app.run('state.piecesPlaced'),1);assert.equal(app.run('state.gameOver'),false);
const exhausted=clone(app.run('state.challenge'));
app.tap(app.run('getChallengeActions(layout).undo'));
assert.deepStrictEqual(clone(app.run('state.challenge')),exhausted,'resume does not replenish a used opportunity');
app.run('restartGame()');
assert.equal(app.run('state.challenge.history.length'),0);
assert.equal(app.run('state.challenge.undoBudget.spent'),0);
app=boot({});app.tap(app.run('getHomeActions(layout).challenge'));
app.tap(app.run('getHomeActions(layout).ranking'));assert.equal(app.notices.length,0);
app.tap(app.run('getHomeActions(layout).choose'));app.run('state.levelScroll=levelScrollFor(layout,challenges.level(11))');app.tap(app.run('getLevelActions(layout,0,state.levelScroll)[11]'));
assert.equal(app.notices.at(-1),'先完成本章前面的关卡即可解锁');
// Result share only opens on a tap, exports a card and does not change stars or saves.
const shared=[];app=boot({}, {api:{createCanvas:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}}),toTempFilePathSync:()=>'/tmp/result.png'}),shareAppMessage:o=>shared.push(o)}});
app.run('startChallenge(0)');app.drop(0,3,4);assert.equal(shared.length,0);
const starsBefore=clone(app.run('state.challengeProgress'));
app.tap(app.run('getGameOverActions(layout,state).share'));
assert.equal(shared.length,1);assert.ok(shared[0].title.includes('1 步'));assert.equal(shared[0].imageUrl,'/tmp/result.png');
assert.deepStrictEqual(clone(app.run('state.challengeProgress')),starsBefore);
console.log('PASS: undo across tray refill/failure/relaunch, video hint entry, locked feedback, append-only progress migration and result share');

assert.equal(app.run('typeof reviveGarden'),'undefined');

// Old stars survive the revision; changed in-progress layouts restart instead of replaying on a different board.
const old={version:1,stars:Array(12).fill(3),active:{level:4,history:[]}};
const migrated=C.load({getStorageSync:()=>old});
assert.deepStrictEqual(migrated.stars,[...Array(12).fill(3),...Array(C.LEVELS.length-12).fill(0)]);
assert.equal(migrated.active,null);assert.equal(migrated.updatedLayout,true);
assert.ok(C.restore({level:0,history:[]}));
assert.equal(C.restore({level:4,rule:999,history:[]}),null);
// Ice break, undo, relaunch and second clearing all preserve the frozen objective.
const iceStorage={[C.KEY]:{version:1,stars:Array(12).fill(3),active:null}};
app=boot(iceStorage);app.run('startChallenge(12)');
const frozenBefore=clone(app.run('state.challenge'));
app.drop(...C.LEVELS[12].solution[0],false);
assert.ok(app.run('state.challenge.ice.length')<frozenBefore.ice.length);
assert.equal(app.run('state.challenge.stones.length'),2);
app=boot(iceStorage);app.tap(app.run('getHomeActions(layout).challenge'));app.tap(app.run('getHomeActions(layout).start'));
assert.equal(app.run('state.piecesPlaced'),1);
app.tap(app.run('getChallengeActions(layout).undo'));frozenBefore.undoBudget.spent++;assert.deepStrictEqual(clone(app.run('state.challenge')),frozenBefore);
C.LEVELS[12].solution.forEach(m=>app.drop(...m));assert.ok(app.run('state.challenge.won'));
// Chapter tabs can be browsed without unlocking levels. Their labels stay within the selected chapter.
app=boot({});app.tap(app.run('getHomeActions(layout).challenge'));app.tap(app.run('getHomeActions(layout).choose'));
app.tap(app.run('getChapterActions(layout)[1]'));assert.equal(app.run('state.levelChapter'),1);
app.tap(app.run('getLevelActions(layout,state.levelChapter)[13]'));assert.equal(app.run('state.screen'),'levels');
assert.equal(app.notices.at(-1),'先完成本章前面的关卡即可解锁');
app.tap(app.run('getChapterActions(layout)[2]'));assert.equal(app.run('state.levelChapter'),2);
app.run('present()');
console.log('PASS: ice two-hit rules, no one-move shortcuts after tutorials, chapter tabs, permanent barriers and revision migration');

assert.equal(C.restore({level:0,rule:0,history:[]}),null);
// A failed winning save survives navigation, mode changes and backgrounding.
const pendingStore={},pendingFault={};app=boot(pendingStore,pendingFault);
app.run('startChallenge(0)');pendingFault.write=true;app.drop(0,3,4);
assert.equal(app.run('state.savePending'),true);assert.equal(pendingStore[C.KEY].stars[0],0);
app.tap(app.run('getGameOverActions(layout).menu'));
app.tap(app.run('getHomeActions(layout).garden'));app.tap(app.run('getHomeActions(layout).start'));
assert.equal(app.run('state.challenge'),null);
pendingFault.write=false;app.handlers.Hide();
assert.equal(pendingStore[C.KEY].stars[0],3);assert.equal(app.run('state.savePending'),false);
assert.equal(C.load({getStorageSync:k=>pendingStore[k]}).stars[0],3);
// Broken reads never prevent reaching the menu; retries also work while idle on it.
const readError=boot({}, {api:{getStorageSync(){throw Error('read failed')}}});
assert.equal(readError.run('state.screen'),'menu');
const idleFault={write:true},idleStore={};const idle=boot(idleStore,idleFault);
idle.run('startChallenge(0)');idle.drop(0,3,4);idle.tap(idle.run('getGameOverActions(layout).menu'));
idleFault.write=false;idle.run('lastSaveRetry=Date.now()-6000;loop()');
assert.equal(idleStore[C.KEY].stars[0],3);
// Preview exactly matches the next deal and is restored by undo/relaunch.
for (const level of C.LEVELS) {
 const run=C.start(level.id);
 for(const move of level.solution) {
  const preview=C.nextTray(run).map(p=>p.id),before=clone(run),result=C.play(run,...move);
  if(result.dealt && !run.ended) assert.deepStrictEqual(run.tray.map(p=>p.id),preview);
  if(!run.ended)assert.deepStrictEqual(C.nextTray(C.restore(C.checkpoint(run))),C.nextTray(run));
  if(!run.won)assert.deepStrictEqual(C.nextTray(C.undo(run)),C.nextTray(before));
 }
}
for(const id of [17,23,32]) {
 const oldProgress={version:1,stars:Array(36).fill(3),active:{level:id,rule:2,history:[]}};
 const upgraded=C.load({getStorageSync:()=>oldProgress});
 assert.equal(upgraded.active,null);assert.ok(upgraded.updatedLayout);
 assert.ok(upgraded.stars.slice(0,36).every(s=>s===3));assert.ok(upgraded.stars.slice(36).every(s=>s===0));
}
// On a frosted palace, glow means removal; cracks mean the block will remain.
app=boot({[C.KEY]:{version:1,stars:Array(12).fill(3)}});app.run('startChallenge(12)');
const [slot,c,r]=C.LEVELS[12].solution[0];
app.run(`state.drag={trayIndex:${slot},shape:state.tray[${slot}],bounds:shapeBounds(state.tray[${slot}]),lastPreviewKey:''};
updateDrag({x:layout.boardX+(${c}+state.drag.bounds.width/2)*layout.cellSize,
y:layout.boardY+(${r}+state.drag.bounds.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2)})`);
assert.equal(app.run('state.drag.previewBreakingIce.length'),6);
assert.equal(app.run('state.drag.previewClearingCells.length'),3);
console.log('PASS: pending saves survive home/mode changes, failed reads, next-tray/undo consistency, rule-3 migration and distinct ice preview');

if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({games,moves,levels:C.LEVELS.map(l=>({id:l.id+1,chapter:l.chapter+1,title:l.title,referenceMoves:l.par,limit:l.limit,ice:(l.ice||[]).length,barriers:(l.blocked||[]).length}))},null,2)+'\n');

// Revised crossing layouts reuse space cleared earlier and require more than one
// type of region. Changing only the order within a tray can invalidate the route.
let orderSensitive=0;
for(const level of C.LEVELS.filter(l=>l.id<36 && l.rule===6 && l.kind==='stones')){
 const run=C.start(level.id),cleared=new Set(),types=new Set();let reused=0,barrierClear=false;
 for(const [slot,c,r] of level.solution){
  reused+=run.tray[slot].cells.filter(([x,y])=>cleared.has(`${c+x},${r+y}`)).length;
  const placed=clone(run.board);B.placeShape(placed,run.tray[slot],c,r);
  const regions=B.findCompletedRegions(placed);
  for(const type of ['rows','cols','palaces'])if(regions[type].length)types.add(type);
  if((level.blocked||[]).some(([x,y])=>regions.rows.includes(y)||regions.cols.includes(x)))barrierClear=true;
  C.play(run,slot,c,r).cells.forEach(([x,y])=>cleared.add(`${x},${y}`));
 }
 assert.ok(reused>=3 && types.size>=2,level.title+' must connect clears');
 if(level.chapter===2)assert.ok(barrierClear,level.title+' barriers must affect a completed road');
 let sensitive=false;
 for(let a=0;a<level.solution.length&&!sensitive;a++)for(let b=a+1;b<Math.min(level.solution.length,(Math.floor(a/3)+1)*3);b++){
  const moves=clone(level.solution);[moves[a],moves[b]]=[moves[b],moves[a]];const swapped=C.start(level.id);
  for(const move of moves){if(swapped.ended||!C.play(swapped,...move))break;}
  if(!swapped.won){sensitive=true;break;}
 }
 orderSensitive+=sensitive?1:0;
 // Layout updates preserve earned stars and independently keep an unchanged chapter's run.
 const old={version:1,stars:Array(36).fill(3),chapter:level.chapter,runs:[null,null,null]};
 old.runs[level.chapter]={level:level.id,rule:3,history:[]};
 const saved=C.load({getStorageSync:()=>old});assert.ok(saved.updatedLayout);assert.equal(saved.active,null);
 assert.ok(saved.stars.slice(0,36).every(n=>n===3));assert.ok(saved.stars.slice(36).every(n=>n===0));
}
// Three formerly long stone goals are now breathers; the retained routes still
// include seventeen puzzles where changing a tray's order breaks the solution.
assert.ok(orderSensitive>=17);
console.log(`PASS: crossing/reused-space layouts, road barriers, ${orderSensitive} revised levels with order-sensitive routes, revised progress migration`);

// Expansion is append-only and chapter entries remain independently accessible.
assert.equal(C.CHAPTERS.length,5);assert.equal(C.LEVELS.length,90);
const fresh=C.load({getStorageSync(){}});
assert.equal(fresh.runs.length,C.CHAPTERS.length);
for(let chapter=0;chapter<C.CHAPTERS.length;chapter++) {
 assert.ok(C.isUnlocked(fresh,chapter*12));assert.equal(C.isUnlocked(fresh,chapter*12+1),false);
}
const legacy=C.load({getStorageSync:()=>({version:1,stars:Array(36).fill(3),runs:[null,null,null]})});
assert.deepStrictEqual(legacy.stars,[...Array(36).fill(3),...Array(C.LEVELS.length-36).fill(0)]);
assert.equal(legacy.runs.length,C.CHAPTERS.length);
const changed=C.load({getStorageSync:()=>({version:1,stars:Array(36).fill(3),chapter:2,
 runs:[{level:4,rule:2,history:[]},null,{level:25,rule:4,history:[]}]})});
assert.ok(changed.updatedLayout);assert.equal(changed.active,null);
assert.ok(C.restore(changed.runs[0]),'Unchanged chapter save survives a different chapter revision');
assert.deepStrictEqual(changed.stars,legacy.stars);
for(const level of C.LEVELS.slice(7,36)) {
 assert.equal(level.limit-level.par,level.pace==='运用'?3:4);
}
// New goals alternate; every reference route reuses cleared space and crosses
// at least two region types. This catches disconnected fill-the-hole reskins.
let newOrderSensitive=0;
for(const level of C.LEVELS.slice(36,48)) {
 const run=C.start(level.id),cleared=new Set(),types=new Set();let reused=0;
 // Even a clever alternative must require planning beyond the first two pieces.
 for(let slot=0;slot<3;slot++)for(let y=0;y<9;y++)for(let x=0;x<9;x++) {
  if(!B.canPlace(run.board,run.tray[slot],x,y))continue;
  const first=clone(run);C.play(first,slot,x,y);
  for(let next=0;next<3;next++)if(first.tray[next])for(let r=0;r<9;r++)for(let c=0;c<9;c++) {
   if(!B.canPlace(first.board,first.tray[next],c,r))continue;
   const second=clone(first);C.play(second,next,c,r);
   assert.equal(second.won,false,level.title+' cannot finish in two moves');
  }
 }
 for(const [slot,c,r] of level.solution) {
  reused+=run.tray[slot].cells.filter(([x,y])=>cleared.has(`${c+x},${r+y}`)).length;
  const placed=clone(run.board);B.placeShape(placed,run.tray[slot],c,r);
  const done=B.findCompletedRegions(placed);
  for(const type of ['rows','cols','palaces'])if(done[type].length)types.add(type);
  C.play(run,slot,c,r).cells.forEach(([x,y])=>cleared.add(`${x},${y}`));
 }
 assert.ok(reused>=3 && types.size>=2,level.title+' must connect clears');
 assert.ok(level.par>=(level.id===36?4:5));
 assert.equal(level.limit-level.par,level.pace==='运用'?3:4);
 assert.notEqual(level.kind,C.LEVELS[level.id-1].kind);
 for(let a=0,sensitive=false;a<level.solution.length&&!sensitive;a++)for(let b=a+1;b<Math.min(level.solution.length,(Math.floor(a/3)+1)*3);b++) {
  const moves=clone(level.solution);[moves[a],moves[b]]=[moves[b],moves[a]];const swapped=C.start(level.id);
  for(const move of moves){if(swapped.ended||!C.play(swapped,...move))break;}
  if(!swapped.won){newOrderSensitive++;sensitive=true;break;}
 }
}
assert.ok(newOrderSensitive>=8,'Most new routes must require a considered placement order');
console.log(`PASS: ${C.CHAPTERS.length} chapter entries, append-only progress migration, moderate budgets, ${newOrderSensitive} order-sensitive fourth-chapter puzzles`);

// Watering is orthogonal and per placement, persists through rewind/relaunch,
// and never clears or opens the bed itself. Multi-clears cannot double-water.
assert.ok(C.LEVELS.slice(36).filter(l=>l.kind==='flowers').length>=6);
for(const level of C.LEVELS.filter(l=>l.kind==='flowers')) {
 const run=C.start(level.id);
 for(const move of level.solution) {
  const before=clone(run),result=C.play(run,...move);
  for(const [c,r,left] of run.flowers) {
   const old=before.flowers.find(p=>p[0]===c&&p[1]===r)[2];
   const adjacent=result.cells.some(([x,y])=>Math.abs(c-x)+Math.abs(r-y)===1);
   assert.equal(left,Math.max(0,old-Number(adjacent)));
   assert.equal(run.board[r][c],2);
   assert.ok(!result.cells.some(([x,y])=>x===c&&y===r));
   assert.equal(result.wateredFlowers.some(([x,y])=>x===c&&y===r),old>0&&adjacent);
  }
  if(!run.won)assert.deepStrictEqual(C.undo(run),before);
  if(!run.ended)assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);
 }
 assert.equal(run.progress,level.target);assert.ok(run.flowers.every(p=>p[2]===0));
}
// One simultaneous row/palace clear adjacent to both sides still waters once.
const bloom=C.start(36);bloom.board=Array.from({length:9},()=>Array(9).fill(0));
bloom.flowers=[[3,3,2]];bloom.board[3][3]=2;
for(let y=3;y<6;y++)for(let x=0;x<3;x++)bloom.board[y][x]=1;
for(let x=0;x<9;x++)bloom.board[4][x]=1;
bloom.board[4][2]=0;bloom.tray[0]=require('../js/rules/shapes').SHAPES.find(p=>p.id==='dot');
const watered=C.play(bloom,0,2,4);
assert.ok(watered.count>=2);assert.deepStrictEqual(bloom.flowers,[[3,3,1]]);
assert.equal(bloom.progress,0);assert.equal(bloom.won,false);
const diagonal=C.start(36);diagonal.board=Array.from({length:9},()=>Array(9).fill(0));
diagonal.flowers=[[3,3,2]];diagonal.board[3][3]=2;
for(let y=0;y<3;y++)for(let x=0;x<3;x++)diagonal.board[y][x]=1;
diagonal.board[0][0]=0;diagonal.tray[0]=require('../js/rules/shapes').SHAPES.find(p=>p.id==='dot');
assert.equal(C.play(diagonal,0,0,0).wateredFlowers.length,0);
assert.deepStrictEqual(diagonal.flowers,[[3,3,2]],'Diagonal clears do not water');
console.log('PASS: flower watering, simultaneous-clear limit, permanent beds, replay and undo');
