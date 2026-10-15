const assert=require('assert');
const C=require('../js/challenge/challenges'), G=require('../js/progression/mechanic-guide'), K=require('../js/progression/collection');
const {boot,clone}=require('./helpers/game-harness');

// Every chapter entrance demonstrates a real mechanic, and retires the guide
// only when the player triggers it. The demonstration never alters a puzzle.
for(const id of [0,12,24,36,48]){
  const app=boot();app.run(`startChallenge(${id})`);
  const guideId=app.run('state.mechanicGuide.id'), expected=C.start(id);
  let steps=0;
  while(app.run('Boolean(state.mechanicGuide)')){
    const move=app.run('mechanicGuide.move(state.mechanicGuide,state.challenge)');
    assert.ok(move,`chapter ${id/12+1} has a legal teaching move`);
    for(const size of [{w:320,h:568},{w:390,h:844}]){
      const {createLayout}=require('../js/views/layout'), layout=createLayout(size.w,size.h);
      const current=app.run('state.challenge'), guide=app.run('state.mechanicGuide');
      const {panel}=G.rects(layout,guide,current);
      for(const [dx,dy] of current.tray[move.slot].cells){
        const y=layout.boardY+(move.r+dy)*layout.cellSize;
        assert.ok(y+layout.cellSize<=panel.y || y>=panel.y+panel.height,'teaching card must not cover the suggested cells');
      }
    }
    C.play(expected,move.slot,move.c,move.r);app.move([move.slot,move.c,move.r]);
    assert.deepStrictEqual(clone(app.run('state.challenge.board')),expected.board);
    assert.equal(app.run('state.challenge.progress'),expected.progress);
    assert.ok(++steps<=6);
  }
  assert.ok(app.store.fangcunMechanicsSeenV1[guideId]);
}
// An off-path move gets no stale arrow and does not count as learning.
const explore=boot();explore.run('startChallenge(36)');explore.move([0,0,0]);
assert.equal(explore.run('state.mechanicGuide.id'),'flowers');
assert.equal(explore.run('mechanicGuide.move(state.mechanicGuide,state.challenge)'),null);
assert.ok(!explore.store.fangcunMechanicsSeenV1?.flowers);
const resumed=boot(clone(explore.store));resumed.run('startChallenge(36,true)');
assert.equal(resumed.run('state.challenge.history.length'),1);
assert.equal(resumed.run('state.mechanicGuide.id'),'flowers');
assert.equal(resumed.run('mechanicGuide.move(state.mechanicGuide,state.challenge)'),null);
resumed.tap(resumed.run('mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip'));
assert.equal(resumed.run('state.mechanicGuide'),null);
assert.ok(resumed.store.fangcunMechanicsSeenV1.flowers);
// No free reference-route arrows in daily puzzles or shared challenges.
const run=C.start(0), guide=G.create(run,{},0);
assert.equal(G.move(guide,{...run,invited:true}),null);
assert.equal(G.move(guide,{...run,dailyDate:'2026-10-06'}),null);
// First completion emphasizes the goal; subsequent attempts show star targets.
const first=boot();first.run('startChallenge(0)');
assert.ok(first.draw().some(x=>x.text==='先完成目标 · 通关后可再争三星'));
first.complete();first.run('restartGame()');
assert.ok(first.draw().some(x=>x.text.includes('三星还可用')));
// Invalid drops explain why without consuming a move or removing the piece.
for(const [id,slot,c,r,label] of [[0,0,0,4,'已有方块'],[36,0,3,3,'花圃'],[48,0,4,3,'机关'],[24,0,0,0,'石障'],[0,0,8,0,'棋盘内']]){
  const app=boot();app.run(`startChallenge(${id})`);
  const before=clone(app.run('state.challenge'));
  app.move([slot,c,r]);
  assert.deepStrictEqual(clone(app.run('state.challenge')),before);
  assert.ok(app.run('state.feedback').includes(label),`${id}: ${app.run('state.feedback')}`);
}
// Garden practice teaches row, palace, then an independently chosen clear.
const garden=boot();garden.run('continueOrStartGame()');
assert.equal(garden.run('state.mode'),'easy');
assert.ok(garden.draw().some(x=>x.text==='① 拖动方块，填满一行'));
assert.ok(!garden.draw().some(x=>x.text.includes('满三点')));
for(const move of [[1,6,4],[1,3,5],[0,6,7]]){
  garden.move(move);
  if(garden.run('state.basics.done'))garden.tap(garden.run('getBasicsActions(layout).next'));
}
assert.equal(garden.run('state.basics'),null);
assert.equal(garden.run('state.score'),0);
assert.equal(garden.run('undoBudget.remaining(state.undoBudget)'),1);
assert.ok(K.unlocked(garden.run('state.collection'),0).includes('bamboo'));
assert.ok(garden.run('state.feedback').includes('正式挑战'));
console.log('PASS: chapter demonstrations, off-path/relaunch/skip, invalid drops and staged garden practice');
