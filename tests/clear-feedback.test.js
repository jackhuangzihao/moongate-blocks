const assert = require('assert');
const { boot, clone } = require('./helpers/game-harness');
const V = require('../js/views/clear-feedback');
const G = require('../js/gravity/gravity-engine');
const C = require('../js/challenge/challenges');
const themes = require('../js/views/themes');
const { drawClearAnimation } = require('../js/views/board-view');

assert.equal(V.create(0,1,1,100,'消除'),null);
assert.equal(V.create(Infinity,1,1,100,'消除'),null);
assert.equal(V.create(13,1,1,NaN,'消除'),null);
assert.equal(V.title({rows:[8],cols:[],palaces:[]}), '一行消除');
assert.equal(V.title({rows:[],cols:[0],palaces:[]}), '一列消除');
assert.equal(V.title({rows:[],cols:[],palaces:[[0,0]]}), '九宫消除');
assert.equal(V.title({rows:[8],cols:[0],palaces:[]},3), '双重消除');
assert.equal(V.title({rows:[8],cols:[],palaces:[]},3), '连续消除 3 手');
const effect=V.create(43,2,1,100,'双重消除');
assert(V.advance(effect,0));assert.equal(effect.progress,0);
assert(V.advance(effect,550));assert.equal(effect.progress,.5);
assert(!V.advance(effect,1100));assert.equal(effect.progress,1);

function garden(app,double=false) {
  app.run(`restartGame();let feedbackClock=10000;Date.now=()=>feedbackClock;
    state.energyPalaces=[0,1,2];state.energy=0;state.welcomeEnergy=false;
    state.score=380;state.collection.clears=300;refreshDecor(false);
    state.board=createBoard('easy');state.suggestion=null;state.tutorialVisible=false;
    state.tray=[SHAPES.find(s=>s.id==='${double?'corner3D':'line3H'}'),SHAPES[0],SHAPES[1]];
    for(let c=0;c<9;c++)if(${double?'c<7':'c<3||c>5'})state.board[8][c]=1;
    ${double?'for(let r=0;r<7;r++)state.board[r][8]=1;':''}
    updateTrayAvailability();`);
}
function place(app,slot,c,r) {
  const from=app.run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:3})`);
  const to=app.run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:3}})()`);
  app.handlers.TouchStart({touches:[from],changedTouches:[from]});
  app.handlers.TouchEnd({touches:[],changedTouches:[to]});
}
for(const size of [{w:320,h:568},{w:360,h:640},{w:390,h:844},{w:430,h:932}]) {
  for(const appearance of ['classic','ink','neon']) {
    const app=boot({fangcunTutorialSeen:true},{size});garden(app,true);
    app.run(`state.appearance.selected='${appearance}'`);
    place(app,0,7,7);
    assert.equal(app.run('state.score'),423);
    assert.equal(app.run('state.clearFeedback.gain'),43);
    assert.equal(app.run('state.clearFeedback.label'),'双重消除');
    assert.equal(app.run('state.clearingCells.length'),17,'intersecting regions are not counted twice as cells');
    const saved=app.run('saves.snapshot(state)');assert(!JSON.stringify(saved).includes('clearFeedback'));
    const labels=app.draw().map(item=>item.text);
    assert(labels.includes('+43'));assert(labels.includes('双重消除'));
    app.run('stepAnimations(10065)');assert(app.run('Boolean(clearAnimation)'));
    app.run('stepAnimations(10130)');assert.equal(app.run('clearAnimation'),null,'clear remains exactly 130ms');
    assert.equal(app.run('state.inputLocked'),false,'number feedback never locks another move');
    const stable=clone(app.run('saves.snapshot(state)'));
    app.run('stepAnimations(10240)');assert.deepEqual(clone(app.run('saves.snapshot(state)')),stable);
    app.run('stepAnimations(10900)');assert.equal(app.run('state.clearFeedback'),null);
    assert(!app.draw().some(item=>item.text==='+43'));
  }
}
{
  const app=boot({fangcunTutorialSeen:true});garden(app,true);place(app,0,7,7);
  app.run('stepAnimations(10130)');place(app,1,0,0);
  assert.equal(app.run('state.score'),424);assert.equal(app.run('state.clearFeedback'),null,'a new quiet placement removes the previous gain');
}
{
  const app=boot({fangcunTutorialSeen:true});garden(app);
  app.run('state.energyPalaces=[6,0,1];state.energy=0;for(let r=6;r<9;r++)for(let c=0;c<3;c++)state.board[r][c]=1;state.board[8][0]=0;state.tray[0]=SHAPES[0];updateTrayAvailability()');
  place(app,0,0,8);assert.equal(app.run('state.clearFeedback.showGain'),false);
  app.run('stepAnimations(10700)');
  assert(!app.draw().some(item=>/^\+\d+$/.test(item.text)),'energy feedback never flashes an ordinary gain when its message expires');
}
{
  const app=boot({fangcunTutorialSeen:true});garden(app);place(app,0,3,8);
  assert.equal(app.run('state.score'),393);assert.equal(app.run('state.clearFeedback.gain'),13);
  const stable=clone(app.run('saves.snapshot(state)'));
  app.handlers.Hide();assert.equal(app.run('state.clearFeedback'),null);
  app.handlers.Show({query:{}});app.settle();assert.equal(app.run('state.clearFeedback'),null);
  assert.deepEqual(clone(app.run('saves.snapshot(state)')),stable,'background settles visuals without changing the saved move');
  app.run('undoMove()');assert.equal(app.run('state.score'),380);assert.equal(app.run('state.clearFeedback'),null);
}
{
  const app=boot({fangcunTutorialSeen:true});garden(app);place(app,0,3,8);
  app.run("showFeedback('庭院新添「修竹」· 回首页看看',3200)");
  assert(!app.draw().some(item=>item.text==='+13'),'important feedback takes the full text line');
  app.run('state.settingsOpen=true;stepAnimations(10040)');assert.equal(app.run('state.clearFeedback'),null);
  app.run('state.settingsOpen=false;restartGame()');assert.equal(app.run('state.clearFeedback'),null);
}
// Real challenge and daily handlers use actual score deltas, never target increments as points.
const candidate=C.LEVELS.find(level=>level.solution.some((move,index)=>{
  const run=C.start(level.id);
  for(let i=0;i<=index;i++){const result=C.play(run,...level.solution[i]);if(i===index)return result.count&&!run.ended&&!result.brokenIce.length&&!result.wateredFlowers.length&&!result.openedGates.length;}
}));
assert(candidate,'fixture needs a non-final ordinary challenge clear');
for(const daily of [false,true]){
  const app=boot({fangcunTutorialSeen:true});
  app.run(`state.challengeProgress.stars.fill(3);startChallenge(${candidate.id});state.mechanicGuide=null;${daily?"state.challenge.dailyDate='2026-10-22';":''}`);
  let found=false;
  for(const move of candidate.solution){
    const before=app.run('state.score');place(app,...move);
    if(app.run('Boolean(state.clearFeedback)')){
      const gain=app.run('state.clearFeedback.gain');
      assert.equal(gain,app.run('state.score')-before);
      assert(!JSON.stringify(app.run('challenges.checkpoint(state.challenge)')).includes('clearFeedback'));
      app.draw();app.run('restartGame(null,state.challenge)');assert.equal(app.run('state.clearFeedback'),null);
      found=true;break;
    }
    app.settle();
  }
  assert(found);
}
// Brightening is confined to the actual removed cells and follows each active palette.
for(const appearance of ['classic','ink','neon']){
  themes.apply({appearance:{selected:appearance},screen:'playing'});
  const fills=[],ctx=new Proxy({}, {get:(o,k)=>k==='fill'?()=>fills.push(o.fillStyle):o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  drawClearAnimation(ctx,{boardX:20,boardY:200,cellSize:30},{clearingCells:[[0,0]],clearProgress:.2});
  assert.equal(fills[0],themes.palette(appearance).clearGlow);
  assert.equal(ctx.globalAlpha,1);
}
// Drive the actual gravity controller through a real chain; state/save already contain final points.
{
  const app=boot({fangcunTutorialSeen:true});app.run('openGravity();let feedbackClock=20000;Date.now=()=>feedbackClock');
  const v=app.run("require('./js/gravity/gravity-view').layoutFor(layout,true)"),box=v.trays[0];
  const from={clientX:box.x+box.width/2,clientY:box.y+box.height/2,identifier:3};
  const to={clientX:v.board.x+4.5*v.cell,clientY:v.board.y+8.5*v.cell+Math.min(86,v.cell*2.2),identifier:3};
  app.handlers.TouchStart({touches:[from],changedTouches:[from]});app.handlers.TouchEnd({touches:[],changedTouches:[to]});
  const expected=G.play(G.start(2),0,3,8).state;
  assert.equal(app.run('gravityMode.model.run.score'),expected.score);
  assert.equal(app.run('gravityMode.model.clearFeedback.gain'),12);
  const saved=clone(app.run('gravityMode.model.run'));
  const started=app.run('gravityMode.model.animation.start');
  app.run(`gravityMode.step(${started}+400)`);
  assert.equal(app.run('gravityMode.model.clearFeedback.gain'),21);
  assert.equal(app.run('gravityMode.model.clearFeedback.label'),'2 连锁');
  app.run("gravityMode.model.run.mode='free'");
  const labels=app.draw().map(item=>item.text);assert(labels.includes('本次 +21'));
  app.run(`gravityMode.model.run.mode=2;gravityMode.step(${started}+1300)`);
  assert.equal(app.run('gravityMode.model.clearFeedback'),null);
  assert.deepEqual(clone(app.run('gravityMode.model.run')),saved);
  assert(!JSON.stringify(app.store.fangcunGravityV1).includes('clearFeedback'));
  app.run('gravityMode.open(2,true)');assert.equal(app.run('gravityMode.model.clearFeedback'),null);
}
console.log('PASS: scoped clear feedback, exact point deltas, 130ms input timing, four sizes/three palettes, priority messages, undo/background/restart, daily/challenge and actual gravity chain/save isolation');
