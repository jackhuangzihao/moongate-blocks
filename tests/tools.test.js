const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const {createRequire}=require('module');
const C=require('../js/challenge/challenges'),B=require('../js/rules/board'),S=require('../js/persistence/saves'),T=require('../js/rules/tools');
const clone=x=>JSON.parse(JSON.stringify(x));
const game=path.resolve(__dirname,'../game.js'),req=createRequire(game);
function boot(store={fangcunTutorialSeen:true},id='test-unit') {
 const handlers={},notices=[],labels=[],closed=new Set(),errors=new Set();let shows=0,failLoad=false;
 const ad={load:()=>failLoad?Promise.reject(Error('no fill')):Promise.resolve(),show:()=>{shows++;return Promise.resolve()},
 onClose:f=>closed.add(f),offClose:f=>closed.delete(f),onError:f=>errors.add(f),offError:f=>errors.delete(f)};
 const ctx=new Proxy({},{get:(o,k)=>k==='fillText'?s=>labels.push(s):o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const wx={getWindowInfo:()=>({windowWidth:320,windowHeight:568}),createCanvas:()=>({getContext:()=>ctx}),
 getStorageSync:k=>store[k]===undefined?undefined:clone(store[k]),setStorageSync:(k,v)=>store[k]=clone(v),
 showModal:o=>o.success({confirm:true}),showToast:o=>notices.push(o.title),createRewardedVideoAd:()=>ad};
 for(const n of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show'])wx['on'+n]=f=>handlers[n]=f;
 const sandbox=vm.createContext({wx,requestAnimationFrame(){},require:n=>n==='./js/config'?{...req(n),REWARDED_AD_UNIT_ID:id}:n==='./js/platform/feedback'?{settings:{},playMusic(){},placement(){},elimination(){},resume(){},suspend(){},undoMove(){}}:req(n)});
 vm.runInContext(fs.readFileSync(game,'utf8'),sandbox);const run=s=>vm.runInContext(s,sandbox);
 const settle=()=>run('stepAnimations(Date.now()+1000);stepAnimations(Date.now()+2000)');
 function drop(slot,c,r){
  const from=run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:1})`);
  const to=run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:1}})()`);
  handlers.TouchStart({touches:[from],changedTouches:[from]});handlers.TouchEnd({touches:[],changedTouches:[to]});settle();
 }
 function tap(rect){const p={clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,identifier:2};handlers.TouchStart({touches:[p],changedTouches:[p]});handlers.TouchEnd({touches:[],changedTouches:[p]});settle();}
 return {run,drop,tap,handlers,labels,notices,store,close:res=>[...closed].forEach(f=>f(res)),error:()=>[...errors].forEach(f=>f()),setFail:v=>{failLoad=v},shows:()=>shows,listeners:()=>closed.size+errors.size};
}
(async()=>{
 const corrupted=boot({fangcunBestScoreNormal:-50,fangcunBestScoreHard:'Infinity'});
 assert.equal(corrupted.run('state.bestScores.easy'),0);assert.equal(corrupted.run('state.bestScores.medium'),0);
 // Each chapter starts open, locks only its own successors, and resumes independently.
 const app=boot();
 for(const id of [0,12,24])assert.ok(C.isUnlocked(app.run('state.challengeProgress'),id));
 for(const id of [1,13,25])assert.ok(!C.isUnlocked(app.run('state.challengeProgress'),id));
 app.run('startChallenge(12)');app.drop(...C.LEVELS[12].solution[0]);
 const ice=clone(app.run('state.challenge'));
 app.run('returnHome();startChallenge(24)');app.drop(...C.LEVELS[24].solution[0]);
 const pathRun=clone(app.run('state.challenge'));
 const reopen=boot(app.store);reopen.run('startChallenge(12,true)');assert.deepStrictEqual(clone(reopen.run('state.challenge')),ice);
 reopen.run('returnHome();startChallenge(24,true)');assert.deepStrictEqual(clone(reopen.run('state.challenge')),pathRun);
 const stars=Array(36).fill(0);stars[12]=3;stars[24]=2;
 const loaded=C.load({getStorageSync:()=>({version:1,stars,chapter:2})});
 assert.equal(loaded.stars[12],3);assert.equal(loaded.stars[24],2);assert.ok(C.isUnlocked(loaded,13));assert.ok(C.isUnlocked(loaded,25));assert.ok(!C.isUnlocked(loaded,1));
 // Chapter-2 win survives reboot even while chapter 1 is untouched.
 const second=boot();second.run('startChallenge(12)');C.LEVELS[12].solution.forEach(m=>second.drop(...m));
 assert.equal(boot(second.store).run('state.challengeProgress.stars[12]'),3);
 // Completing chapter 1 must resume, rather than replace, an already-started chapter 2.
 const firstEnd=C.chapterLevels(0).at(-1).id;
 reopen.run(`challenges.chapterLevels(0).forEach(level=>state.challengeProgress.stars[level.id]=3);startChallenge(${firstEnd})`);
 C.LEVELS[firstEnd].solution.forEach(m=>reopen.drop(...m));
 reopen.tap(reopen.run('getGameOverActions(layout,state).restart'));
 assert.deepStrictEqual(clone(reopen.run('state.challenge')),ice);
 // Completing chapter 3 first is not reported as completing all chapters.
 const last=C.chapterLevels(C.CHAPTERS.length-1).at(-1).id;
 const finalChapter=boot();finalChapter.run(`challenges.chapterLevels(challenges.CHAPTERS.length-1).forEach(level=>state.challengeProgress.stars[level.id]=3);startChallenge(${last})`);
 C.LEVELS[last].solution.forEach(m=>finalChapter.drop(...m));finalChapter.run('present()');
 assert.ok(finalChapter.labels.includes('本章完成 · 小径已通'));assert.ok(!finalChapter.labels.includes('所有章节已完成 · 庭间诸景收齐'));
 finalChapter.run('returnHome();present()');assert.ok(finalChapter.labels.includes('本章完成 · 选择章节'));
 finalChapter.tap(finalChapter.run('getHomeActions(layout).start'));assert.equal(finalChapter.run('state.screen'),'levels');
 // Rewarded hint: no automatic drop, no reward on cancellation/undefined/error or missing unit.
 const hinted=boot();hinted.run('startChallenge(0)');const before=clone(hinted.run('state.challenge'));
 const early=hinted.run('requestVideoTool("hint")');hinted.close({isEnded:true});await early;
 assert.equal(hinted.run('state.suggestion'),null,'completion before playback cannot grant a reward');
 for(const result of [{isEnded:false},undefined]){
  const task=hinted.run('requestVideoTool("hint")');await Promise.resolve();await Promise.resolve();hinted.close(result);await task;
  assert.equal(hinted.run('state.suggestion'),null);assert.equal(hinted.listeners(),0);
 }
 const task=hinted.run('requestVideoTool("hint")');await Promise.resolve();await Promise.resolve();
 const blockedBefore=hinted.shows();await hinted.run('requestVideoTool("hint")');assert.equal(hinted.shows(),blockedBefore);
 hinted.drop(0,3,4);assert.deepStrictEqual(clone(hinted.run('state.challenge')),before,'input blocked while ad is active');
 hinted.close({isEnded:true});hinted.close({isEnded:true});await task;
 assert.deepStrictEqual(clone(hinted.run('state.suggestion')),{slot:0,c:3,r:4});assert.deepStrictEqual(clone(hinted.run('state.challenge')),before);
 hinted.drop(0,3,4);assert.equal(hinted.run('state.suggestion'),null);
 const missing=boot({},'');missing.run('startChallenge(0)');await missing.run('requestVideoTool("hint")');assert.equal(missing.shows(),0);assert.equal(missing.run('state.suggestion'),null);
 const failure=boot();failure.run('startChallenge(0)');failure.setFail(true);await failure.run('requestVideoTool("hint")');assert.equal(failure.run('state.rewardBusy'),false);assert.equal(failure.listeners(),0);
 failure.setFail(false);const failed=failure.run('requestVideoTool("hint")');failure.error();await failed;assert.equal(failure.run('state.suggestion'),null);
 // Actual buttons are present and dispatch, including the unconfigured case.
 assert.equal(missing.run('getChallengeActions(layout,state).hint'),undefined);
 assert.equal(missing.run('getGameOverActions(layout,state).revive'),undefined);
 assert.ok(hinted.run('getChallengeActions(layout,state).hint'));
 missing.run('present()');assert.ok(!missing.labels.includes('视频'));
 assert.ok(missing.notices.some(x=>x.includes('暂不可用')));
 // Garden undo survives a new process, restores the tray across a refill, and only offers one step.
 const garden=boot();garden.run("continueOrStartGame();state.tray=[{id:'dot',cells:[[0,0]]},null,null];saveCurrentGame()");
 const previous=clone(garden.run('saves.snapshot(state)'));garden.drop(0,0,0);
 const gardenAgain=boot(garden.store);gardenAgain.run('continueOrStartGame();undoMove()');
 assert.equal(gardenAgain.run('state.score'),previous.score);assert.equal(gardenAgain.run('state.piecesPlaced'),previous.piecesPlaced);
 assert.deepStrictEqual(clone(gardenAgain.run('state.board')),previous.board);assert.equal(gardenAgain.run('state.gardenUndo'),null);
 // Repeat the exact tray-clearing move 40 times per map, including a relaunch after undo.
 for(const mode of ['easy','medium','hard']){
  let repeat=boot();repeat.run(`state.mode='${mode}';continueOrStartGame();state.tray=[{id:'dot',cells:[[0,0]]},null,null];state.luckyPendingCount=1;saveCurrentGame()`);
  const board=repeat.run('state.board');let target;
  board.some((row,r)=>row.some((v,c)=>v===0&&(target=[c,r])));
  repeat.drop(0,...target);const dealt=clone(repeat.run('saves.snapshot(state)'));
  for(let i=0;i<40;i++){
   repeat.run('undoMove()');
   if(i===20){repeat=boot(repeat.store);repeat.run(`state.mode='${mode}';continueOrStartGame()`);}
   if(i===0){repeat.drop(0,...target);dealt.undoBudget.spent=1;}
   else repeat.run('state.playPanel=null');
   assert.deepStrictEqual(clone(repeat.run('saves.snapshot(state)')),dealt,'undo rerolled '+mode);
  }
 }
 // A move that refills the energy targets must also replay the same targets and lucky hand.
 const charge=boot();charge.run("continueOrStartGame();state.board=createBoard('easy');for(let r=0;r<3;r++)for(let c=0;c<3;c++)state.board[r][c]=1;state.board[2][2]=0;state.energyPalaces=[0];state.energy=2;state.tray=[{id:'dot',cells:[[0,0]]},null,null];saveCurrentGame()");
 charge.drop(0,2,2);const charged=clone(charge.run('saves.snapshot(state)'));
 for(let i=0;i<40;i++){charge.run('undoMove()');if(i===0){charge.drop(0,2,2);charged.undoBudget.spent=1;}else charge.run('state.playPanel=null');assert.deepStrictEqual(clone(charge.run('saves.snapshot(state)')),charged);}
 const old=clone(charged);delete old.randomState;
 assert.equal(S.decode(old,'easy').randomState,S.decode(clone(old),'easy').randomState);
 assert.equal(S.decode({...old,randomState:-1},'easy'),null);
 // Video revival: minimal clearing, fixed obstacles preserved, no free reward, no second use even after reboot.
 const revival=boot();revival.run("state.mode='hard';continueOrStartGame();state.board=state.board.map((row,r)=>row.map((v,c)=>v===2?2:(r+c)%3===0?0:1));state.tray=[{id:'square2',cells:[[0,0],[1,0],[0,1],[1,1]]},null,null];state.gameOver=true;state.gameOverProgress=1;state.score=100;updateTrayAvailability()");
 const blocked=clone(revival.run('state.board')).flat().filter(v=>v===2).length;
 const beforeEmpty=clone(revival.run('state.board')).flat().filter(v=>v===0).length;
 const removed=revival.run('gameTools.revivalCells(state).length');
 let rev=revival.run('requestVideoTool("revive")');revival.close({isEnded:false});await rev;assert.equal(revival.run('state.gameOver'),true);
 rev=revival.run('requestVideoTool("revive")');await Promise.resolve();await Promise.resolve();revival.close({isEnded:true});await rev;
 assert.equal(revival.run('state.gameOver'),false);assert.equal(revival.run('state.score'),100);assert.equal(revival.run('state.reviveUsed'),true);
 assert.equal(clone(revival.run('state.board')).flat().filter(v=>v===0).length,beforeEmpty+removed);assert.equal(clone(revival.run('state.board')).flat().filter(v=>v===2).length,blocked);
 assert.equal(revival.run('state.gardenUndo'),null);assert.ok(S.decode(revival.store[S.keyFor('hard')],'hard').reviveUsed);
 const revivedAgain=boot(revival.store);revivedAgain.run("state.mode='hard';continueOrStartGame();state.gameOver=true");
 const count=revivedAgain.shows();await revivedAgain.run('requestVideoTool("revive")');assert.equal(revivedAgain.shows(),count);
 // The reference-path hint can complete every level; off-path suggestions remain legal and don't mutate state.
 for(const level of C.LEVELS){const run=C.start(level.id);while(!run.ended){const state={challenge:run,board:run.board,tray:run.tray};const suggestion=T.suggest(state);assert.ok(suggestion);assert.ok(C.play(run,suggestion.slot,suggestion.c,suggestion.r));}assert.ok(run.won);}
 let witnessed=0,helped=0;
 for(const level of C.LEVELS){
  if(level.solution.length<2)continue;
  // Swapping two independent authored moves creates an off-reference, independently verified witness.
  const run=C.start(level.id),plan=[level.solution[1],level.solution[0],...level.solution.slice(2)];
  if(!C.play(run,...plan[0])||run.ended)continue;
  const check=clone(run);
  if(!plan.slice(1).every(move=>C.play(check,...move))||!check.won)continue;
  witnessed++;const untouched=clone(run),path=T.winningPath(run);
  assert.deepStrictEqual(run,untouched);
  if(!path)continue;
  helped++;for(const move of path)assert.ok(C.play(run,...move));assert.ok(run.won,'hint path was not winning');
 }
 assert.ok(witnessed>10&&helped>0);console.log(`Verified off-path witnesses: ${witnessed}; hints proven: ${helped}; others decline without an ad`);
 let sampled=0,proven=0,seed=930;
 const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const level of C.LEVELS)for(let attempt=0;attempt<3;attempt++){
  const run=C.start(level.id);
  for(let step=0;step<=attempt&&!run.ended;step++){
   const moves=[];
   run.tray.forEach((piece,slot)=>{if(piece)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(B.canPlace(run.board,piece,c,r))moves.push([slot,c,r]);});
   if(!moves.length)break;C.play(run,...moves[Math.floor(rand()*moves.length)]);
  }
  if(run.ended)continue;
  sampled++;const path=T.winningPath(run);if(!path)continue;
  proven++;for(const move of path)assert.ok(C.play(run,...move));assert.ok(run.won);
 }
 console.log(`Random off-path checks: ${sampled}; verified winning routes: ${proven}; unverified boards safely declined`);
 const declined=boot();declined.run('startChallenge(24);state.challenge.history=Array(11).fill([0,0,0])');
 // Limit the remaining budget to one move with several targets still present.
 assert.equal(T.winningPath(declined.run('state.challenge')),null);
 // No verified continuation: the hint steps back to the nearest winnable position instead.
 const back=T.suggest(declined.run('state'));assert.equal(back.undo,11);assert.equal(back.run.history.length,0);
 assert.deepStrictEqual([back.slot,back.c,back.r],C.LEVELS[24].solution[0]);
 const off=C.start(0);C.play(off,1,0,0);const snapshot=clone(off);const suggestion=T.suggest({challenge:off,board:off.board,tray:off.tray});if(suggestion)assert.ok(B.canPlace(off.board,off.tray[suggestion.slot],suggestion.c,suggestion.r));assert.deepStrictEqual(off,snapshot);
 // Without ads: three failures on one level grant exactly one free hint, no video involved.
 const gift=boot({},'');let giftLevel=-1;
 for(const id of [0,1,2,3,4,5]){
  gift.run(`startChallenge(${id})`);
  for(let fail=0;fail<3;fail++){
   gift.run(`restartGame(null,challenges.start(${id}))`);
   for(let g=0;g<40&&!gift.run('state.challenge.ended');g++){
    // Worst-first: the move that advances the goal least, so the level runs out.
    gift.run(`(()=>{const run=state.challenge;let pick=null,low=Infinity;run.tray.forEach((p,slot)=>{if(p)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(canPlace(run.board,p,c,r)){const t=JSON.parse(JSON.stringify(run));challenges.play(t,slot,c,r);const v=t.progress*100+(t.ended&&!t.won?-1:0);if(v<low){low=v;pick={trayIndex:slot,target:{col:c,row:r}};}}});playChallenge(pick);stepAnimations(Date.now()+5000);})()`);
   }
   if(gift.run('state.challenge.won'))break;
  }
  if(gift.run('state.challengeProgress.fails['+id+']')>=3){giftLevel=id;break;}
 }
 assert.ok(giftLevel>=0,'a level should be failable three times');
 gift.run('present()');assert.ok(gift.labels.includes('重试可用一次免费提示'));
 gift.tap(gift.run('getGameOverActions(layout,state).undo'));
 gift.tap(gift.run('getPlayPanelActions(layout,state).steps[1]'));
 gift.tap(gift.run('getPlayPanelActions(layout,state).confirm'));
 assert.ok(gift.run('getChallengeActions(layout,state).hint'),'free hint button appears without ads');
 gift.labels.length=0;gift.run('invalidateScene();present()');assert.ok(gift.labels.includes('免费'));
 const beforeGift=clone(gift.run('state.challenge'));
 assert.ok(T.suggest(gift.run('state')).undo,'this hint requires rollback');
 gift.run('wx.showModal=o=>o.success({confirm:false})');
 await gift.run('requestVideoTool("hint")');
 assert.deepStrictEqual(clone(gift.run('state.challenge')),beforeGift);
 assert.equal(gift.run('state.challengeProgress.freeHints['+giftLevel+']'),0);
 assert.equal(gift.shows(),0);assert.equal(gift.run('state.rewardBusy'),false);
 gift.run('wx.showModal=o=>o.success({confirm:true})');
 await gift.run('requestVideoTool("hint")');
 assert.equal(gift.shows(),0);assert.ok(gift.run('state.suggestion'));
 assert.equal(gift.store[C.KEY].freeHints[giftLevel],1);assert.equal(gift.run('getChallengeActions(layout,state).hint'),undefined,'only one free hint per level');
 assert.equal(C.load({getStorageSync:()=>gift.store[C.KEY]}).fails[giftLevel],3);
 const move=gift.run('state.suggestion');const probe=C.restore(gift.run('challenges.checkpoint(state.challenge)'));
 assert.ok(T.winningPath(probe),'the position after a free hint is winnable');
 assert.ok(B.canPlace(probe.board,probe.tray[move.slot],move.c,move.r));
 // An invitation received during video playback waits until reward handling has finished.
 const queued=boot();queued.run('startChallenge(0)');
 const watching=queued.run('requestVideoTool("hint")');await Promise.resolve();await Promise.resolve();
 queued.handlers.Show({query:{challenge:'1',level:'37',rule:String(C.LEVELS[36].rule)}});
 assert.equal(queued.run('state.screen'),'playing');assert.equal(queued.run('state.challenge.level'),0);
 queued.close({isEnded:true});await watching;
 assert.equal(queued.run('state.screen'),'invitation');assert.equal(queued.run('state.invitation.level'),36);
 assert.ok(queued.store[C.KEY].active,'normal chapter remains saved before opening invitation');
 console.log(`PASS: independent chapters/saves, ${C.LEVELS.length} hint paths, real tool buttons, ad completion/cancel/errors/duplicate lock, garden undo/relaunch, one paid revive and obstacle preservation`);
})().catch(e=>{console.error(e);process.exitCode=1});
