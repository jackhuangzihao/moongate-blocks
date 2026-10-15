const assert=require('assert');
const U=require('../js/rules/undo-budget'),C=require('../js/challenge/challenges'),S=require('../js/persistence/saves'),D=require('../js/daily/daily');
const {boot,clone}=require('./helpers/game-harness');
const failureMoves=[[1,0,0],[2,8,7],[0,0,8],[0,3,0]];
function fail(app){app.run('startChallenge(0)');for(const move of failureMoves)app.move(move);assert.ok(app.run('state.gameOver && !state.challenge.won'));}
const budget=U.create();assert.equal(U.remaining(budget),1);
let spent=U.spend(budget);assert.equal(U.remaining(spent),0);assert.equal(U.spend(spent),null);
for(let i=0;i<2;i++){spent=U.grant(spent);assert.equal(U.remaining(spent),1);assert.equal(U.grant(spent),null);spent=U.spend(spent);}
assert.equal(U.grant(spent),null);assert.equal(spent.grants,2);
for(const bad of [null,{},[],{...budget,spent:-1},{...budget,grants:3},{...budget,attemptId:{}}]){
 const safe=U.normalize(bad);assert.equal(U.remaining(safe),0);assert.equal(U.grant(safe),null);
}
assert.equal(U.remaining(U.normalize(undefined)),1);
// Real failure UI: opening/cancelling/selecting costs nothing; one confirmation rolls back 1–3 moves.
for(const steps of [1,2,3]){
 const app=boot();fail(app);const failed=clone(app.run('state.challenge'));
 app.tap(app.run('getGameOverActions(layout,state).undo'));
 assert.equal(app.run('state.playPanel'),'undo');assert.deepStrictEqual(clone(app.run('state.challenge')),failed);
 assert.deepStrictEqual(Object.keys(app.run('getPlayPanelActions(layout,state).steps')),['1','2','3']);
 app.tap(app.run('getPlayPanelActions(layout,state).close'));assert.equal(app.run('state.playPanel'),null);
 for(const bad of [0,4,1.5,-1])app.run(`undoMove(${bad})`);
 assert.deepStrictEqual(clone(app.run('state.challenge')),failed);
 app.tap(app.run('getGameOverActions(layout,state).undo'));
 app.tap(app.run(`getPlayPanelActions(layout,state).steps[${steps}]`));
 app.tap(app.run('getPlayPanelActions(layout,state).confirm'));
 assert.equal(app.run('state.challenge.history.length'),4-steps);
 assert.equal(app.run('state.challenge.undoBudget.spent'),1);
 assert.equal(app.run('state.challenge.undoBudget.attemptId'),failed.undoBudget.attemptId);
 assert.equal(app.run('state.gameOver'),false);
 const after=clone(app.run('state.challenge'));app.run('undoMove()');assert.deepStrictEqual(clone(app.run('state.challenge')),after);
 const resumed=boot(app.store);resumed.run('startChallenge(0,true)');assert.deepStrictEqual(clone(resumed.run('state.challenge')),after);
 resumed.run('restartGame()');assert.equal(resumed.run('state.challenge.history.length'),0);
 assert.equal(resumed.run('state.challenge.undoBudget.spent'),0);
 assert.notEqual(resumed.run('state.challenge.undoBudget.attemptId'),failed.undoBudget.attemptId);
 assert.ok(app.events.some(([event])=>event==='undo_used'));
}
// A failed attempt itself survives process loss, rather than silently starting over.
const failed=boot();fail(failed);
const failedAgain=boot(failed.store);failedAgain.run('startChallenge(0,true)');failedAgain.settle();
assert.equal(failedAgain.run('state.gameOver'),true);assert.equal(failedAgain.run('state.gameOverProgress'),1);
assert.deepStrictEqual(clone(failedAgain.run('state.challenge')),clone(failed.run('state.challenge')));
// Legacy migration is written once on resume. Invalid budget metadata preserves the board, but grants nothing.
const legacy=clone(failed.store);for(const run of [legacy[C.KEY].active,...legacy[C.KEY].runs])if(run)delete run.undoBudget;
const migrated=boot(legacy);migrated.run('startChallenge(0,true)');const migratedId=legacy[C.KEY].active.undoBudget.attemptId;
const again=boot(legacy);again.run('startChallenge(0,true)');assert.equal(again.run('state.challenge.undoBudget.attemptId'),migratedId);
legacy[C.KEY].runs[0].undoBudget={spent:-1};legacy[C.KEY].active=legacy[C.KEY].runs[0];
const damaged=boot(legacy);damaged.run('startChallenge(0,true)');assert.equal(damaged.run('state.piecesPlaced'),4);
assert.equal(damaged.run('undoBudget.remaining(state.challenge.undoBudget)'),0);
// Garden history is bounded to three snapshots and keeps its random stream through rollback.
const garden=boot({fangcunTutorialSeen:true});garden.run('continueOrStartGame()');
for(let i=0;i<5;i++){
 garden.run("state.tray=[{id:'dot',cells:[[0,0]]},null,null];updateTrayAvailability()");garden.move([0,i,0]);
}
let previous=garden.store[S.keyFor('easy')].previous,count=0;
while(previous){count++;assert.equal(previous.undoBudget,undefined);previous=previous.previous;}
assert.equal(count,3);
const legacyGarden=clone(garden.store);delete legacyGarden[S.keyFor('easy')].undoBudget;
const migratedGarden=boot(legacyGarden);migratedGarden.run('continueOrStartGame();undoMove()');
assert.equal(migratedGarden.run('state.piecesPlaced'),4);assert.equal(migratedGarden.run('state.undoBudget.spent'),1);
const resumedGarden=boot(legacyGarden);resumedGarden.run('continueOrStartGame();undoMove()');assert.equal(resumedGarden.run('state.piecesPlaced'),4);
resumedGarden.run('state.gameOver=true;undoMove()');assert.equal(resumedGarden.run('state.gameOver'),true,'garden undo never revives');
const malformed=clone(garden.store[S.keyFor('easy')]);malformed.previous.board=[];
assert.ok(S.decode(malformed,'easy'));assert.equal(S.decode(malformed,'easy').gardenUndo,null);
// Real rewarded-ad wrapper: cancellations/errors/duplicate completion, attempt binding and two-grant ceiling.
(async()=>{
 const closed=new Set(),errors=new Set();let shows=0,failLoad=false;
 const ad={load:()=>failLoad?Promise.reject(Error('no fill')):Promise.resolve(),show:()=>{shows++;return Promise.resolve();},
  onClose:f=>closed.add(f),offClose:f=>closed.delete(f),onError:f=>errors.add(f),offError:f=>errors.delete(f)};
 const options={adUnitId:'test-unit',api:{createRewardedVideoAd:()=>ad}};
 const app=boot({fangcunTutorialSeen:true},options);app.run('startChallenge(12)');
 app.move(C.LEVELS[12].solution[0]);await app.run('requestVideoTool("undo")');assert.equal(shows,0,'cannot stockpile');
 app.run('undoMove()');app.move(C.LEVELS[12].solution[0]);
 const before=clone(app.run('state.challenge'));
 for(const response of [undefined,{isEnded:false}]){
  const watching=app.run('requestVideoTool("undo")');await Promise.resolve();await Promise.resolve();
  for(const close of [...closed])close(response);await watching;
  assert.deepStrictEqual(clone(app.run('state.challenge')),before);assert.equal(closed.size+errors.size,0);
 }
 failLoad=true;await app.run('requestVideoTool("undo")');failLoad=false;
 assert.deepStrictEqual(clone(app.run('state.challenge')),before);
 for(let i=1;i<=2;i++){
  const watching=app.run('requestVideoTool("undo")');await Promise.resolve();await Promise.resolve();
  const callbacks=[...closed];await app.run('requestVideoTool("undo")');
  app.move(C.LEVELS[12].solution[1]);assert.equal(app.run('state.challenge.history.length'),1,'touches are blocked during video');
  for(const close of callbacks){close({isEnded:true});close({isEnded:true});}await watching;
  assert.equal(app.run('state.challenge.undoBudget.grants'),i);
  assert.equal(app.run('undoBudget.remaining(state.challenge.undoBudget)'),1);
  const resume=boot(app.store,options);resume.run('startChallenge(12,true)');assert.equal(resume.run('state.challenge.undoBudget.grants'),i);
  app.run('undoMove()');app.move(C.LEVELS[12].solution[0]);
 }
 const maxShows=shows;await app.run('requestVideoTool("undo")');assert.equal(shows,maxShows);
 assert.equal(app.run('undoBudget.canSupplement(state)'),false);
 // Three garden rollbacks consume three opportunities while restoring real prior boards.
 const g=boot({fangcunTutorialSeen:true},options);g.run('continueOrStartGame()');
 for(let i=0;i<5;i++){g.run("state.tray=[{id:'dot',cells:[[0,0]]},null,null];updateTrayAvailability()");g.move([0,i,0]);}
 const gardenId=g.run('state.undoBudget.attemptId');g.run('undoMove()');
 for(let i=1;i<=2;i++){
  const watching=g.run('requestVideoTool("undo")');await Promise.resolve();await Promise.resolve();
  for(const close of [...closed])close({isEnded:true});await watching;
  g.run('undoMove()');assert.equal(g.run('state.piecesPlaced'),4-i);
  assert.equal(g.run('state.undoBudget.attemptId'),gardenId);
  assert.equal(g.run('state.undoBudget.spent'),i+1);
 }
 assert.equal(g.run('undoBudget.canSupplement(state)'),false);
 const g2=boot(g.store,options);g2.run('continueOrStartGame()');
 assert.equal(g2.run('state.undoBudget.spent'),3);assert.equal(g2.run('state.piecesPlaced'),2);
 g2.run('state.gameOver=true');assert.equal(g2.run('undoBudget.canSupplement(state)'),false);
 // Late completion for a replaced attempt cannot grant to the new one.
 app.run('restartGame()');app.move(C.LEVELS[12].solution[0]);app.run('undoMove()');app.move(C.LEVELS[12].solution[0]);
 const stale=app.run('requestVideoTool("undo")');await Promise.resolve();await Promise.resolve();
 app.run('restartGame()');for(const close of [...closed])close({isEnded:true});await stale;
 assert.equal(app.run('state.challenge.undoBudget.grants'),0);
 // Daily has one free opportunity, never an undo ad, and retains the spent budget after relaunch.
 const d=boot({},options);d.run('openDaily();startDaily()');const id=d.run('state.challenge.level');d.move(C.level(id).solution[0]);
 d.run('undoMove()');d.move(C.level(id).solution[0]);assert.equal(d.run('undoBudget.canSupplement(state)'),false);
 const d2=boot(d.store,options);d2.run('openDaily();startDaily()');assert.equal(d2.run('state.challenge.undoBudget.spent'),1);
 const n=shows;await d2.run('requestVideoTool("undo")');assert.equal(shows,n);
 console.log('PASS: one free undo, 1–3-step failure choice, bounded garden history, legacy/failure/resume, ad idempotence/ceiling/stale results and daily isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
