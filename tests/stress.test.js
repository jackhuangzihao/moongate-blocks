// node tests/stress.test.js [games per mode/strategy] [optional JSON report path]
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const games = Number(process.argv[2] || 20);
assert.ok(Number.isInteger(games) && games > 0 && games <= 100000);
let seed = 1, now = 0;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const math = Object.create(Math); math.random = rng;
const handlers = {}, storage = {}, modules = {};
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : () => {}, set: (o,k,v) => (o[k]=v,true) });
const wx = {
  getWindowInfo: () => ({windowWidth:390,windowHeight:844,safeArea:{top:47,bottom:810}}),
  createCanvas: () => ({getContext:()=>ctx}),
  getStorageSync: k => storage[k], setStorageSync: (k,v) => {storage[k]=v;}
};
for (const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show']) wx['on'+name] = fn => {handlers[name]=fn;};
const feedback = {settings:{},playMusic(){},placement(){},elimination(){},suspend(){},resume(){}};
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const sandbox = vm.createContext({wx,Math:math,Date:TestDate,requestAnimationFrame(){}});
function load(file) {
  if (modules[file]) return modules[file].exports;
  const module = {exports:{}}; modules[file] = module;
  const req = name => name.endsWith('/feedback') ? feedback : load(path.resolve(path.dirname(file), name+'.js'));
  vm.runInContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})', sandbox, {filename:file})(req,module,module.exports);
  return module.exports;
}
sandbox.require = name => name === './js/platform/feedback' ? feedback : load(path.resolve(root,name+'.js'));
vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8') + '\nthis.gameTest={state,restartGame,stepAnimations,updateDrag,layout:()=>layout,present};',sandbox);
const game = sandbox.gameTest;
const {MODES,MODE_ORDER}=load(path.join(root,'js/config.js'));
const engine = load(path.join(root,'js/rules/board.js'));
const saveTools = load(path.join(root,'js/persistence/saves.js'));
const gameTools = load(path.join(root,'js/rules/tools.js'));
const same = (a,b,message) => assert.strictEqual(JSON.stringify(a),JSON.stringify(b),message);
const tick = () => {now+=1000;game.stepAnimations(now);};
const event = p => ({touches:[p],changedTouches:[p]});
const startAt = index => ({clientX:game.layout().horizontalPadding+game.layout().traySlotWidth*(index+.5),clientY:game.layout().trayY,identifier:1});
function legal(board,shape,c,r) {
  return shape.cells.every(([x,y])=>r+y>=0 && r+y<board.length && c+x>=0 && c+x<board[0].length && board[r+y][c+x]===0);
}
function available(board,shape) {
  for(let r=0;r<board.length;r++)for(let c=0;c<board[0].length;c++)if(legal(board,shape,c,r))return true;
  return false;
}
// Independent oracle: enumerate regions as coordinate sets rather than call game clear helpers.
function expectedClear(board) {
  const groups=[]; const regions={rows:[],cols:[],palaces:[]};
  const accept=(cells,type,id,palace=false)=>{
    if(cells.every(([r,c])=>palace?board[r][c]===1:board[r][c]!==0)&&cells.some(([r,c])=>board[r][c]===1)){
      groups.push(cells);regions[type].push(id);
    }
  };
  for(let r=0;r<board.length;r++)accept(board[r].map((_,c)=>[r,c]),'rows',r);
  for(let c=0;c<board[0].length;c++)accept(board.map((_,r)=>[r,c]),'cols',c);
  for(let r=0;r+2<board.length;r+=3)for(let c=0;c+2<board[0].length;c+=3){
    const cells=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)cells.push([r+y,c+x]);
    accept(cells,'palaces',[c/3,r/3],true);
  }
  const cleared=new Set();for(const cells of groups)for(const [r,c]of cells)if(board[r][c]===1)cleared.add(r*board[0].length+c);
  return {regions,cleared,count:groups.length};
}
function choose(policy) {
  const s=game.state;let best=null,value=-Infinity,ties=0;
  s.tray.forEach((shape,index)=>{
    if(!shape)return;
    for(let r=0;r<s.board.length;r++)for(let c=0;c<s.board[0].length;c++){
      if(!legal(s.board,shape,c,r))continue;
      let rank=0;
      if(policy!=='random'){
        const b=s.board.map(row=>row.slice());shape.cells.forEach(([x,y])=>{b[r+y][c+x]=1;});
        const done=engine.findCompletedRegions(b);rank=done.rows.length+done.cols.length+done.palaces.length;
        if(policy==='energy'){
          rank*=10;
          for(const p of s.energyPalaces){
            const pr=Math.floor(p/(b[0].length/3))*3,pc=p%(b[0].length/3)*3;
            let filled=0;for(let y=0;y<3;y++)for(let x=0;x<3;x++)filled+=b[pr+y][pc+x]===1?1:0;
            rank+=filled===9?20:(filled/9)**3*3;
          }
        }
      }
      if(rank>value){value=rank;ties=0;}
      if(rank===value && rng()<1/++ties)best={shape,index,r,c};
    }
  });
  return best;
}
const results=[],noise={invalid:0,cancel:0,background:0,multitouch:0,locked:0};
let totalMoves=0, activeCase='';
try {
for(const policy of ['greedy','random','energy'])for(const [modeIndex,id]of MODE_ORDER.entries()){
 const summary={mode:id,strategy:policy,games,steps:0,score:0,regions:0,energy:0,chargedGames:0,deliveredGames:0,pendingAtDeath:0,rescues:0,maxSteps:0};
 for(let iteration=0;iteration<games;iteration++){
  const initialSeed=(73919+iteration*1009+modeIndex*1000003+['greedy','random','energy'].indexOf(policy)*10000019)>>>0;
  seed=initialSeed;activeCase=JSON.stringify({id,policy,iteration,seed:initialSeed});
  const s=game.state;s.mode=id;game.restartGame();tick();
  const base=s.board.map(row=>row.slice());let charged=false,delivered=false;
  while(!s.gameOver){
   assert.ok(s.piecesPlaced<2000,'runaway game '+activeCase);
   const move=choose(policy);assert.ok(move,'false live game');
   const initialScore=s.score, initialBoard=JSON.stringify(s.board), initialSteps=s.piecesPlaced;
   const start=startAt(move.index);
   if(totalMoves%17===0){
    handlers.TouchStart(event(start));handlers.TouchEnd({touches:[],changedTouches:[{...start,clientX:-100,clientY:-100}]});
    assert.strictEqual(JSON.stringify(s.board),initialBoard);assert.strictEqual(s.score,initialScore);noise.invalid++;
   }
   if(totalMoves%29===0){
    handlers.TouchStart(event(start));handlers.TouchCancel({touches:[],changedTouches:[start]});
    assert.strictEqual(s.drag,null);assert.strictEqual(s.piecesPlaced,initialSteps);noise.cancel++;
   }
   if(totalMoves%47===0){
    handlers.TouchStart(event(start));handlers.Hide();handlers.Show();
    assert.strictEqual(s.drag,null);assert.strictEqual(JSON.stringify(s.board),initialBoard);noise.background++;
   }
   handlers.TouchStart(event(start));assert.ok(s.drag,'drag failed '+activeCase);
   if(totalMoves%83===0){
    const extra={...start,identifier:2};handlers.TouchStart({touches:[start,extra],changedTouches:[extra]});
    assert.strictEqual(s.drag.trayIndex,move.index);noise.multitouch++;
   }
   const l=game.layout(),w=Math.max(...move.shape.cells.map(p=>p[0]))+1,h=Math.max(...move.shape.cells.map(p=>p[1]))+1;
   const end={clientX:l.boardX+(move.c+w/2)*l.cellSize,clientY:l.boardY+(move.r+h/2)*l.cellSize+Math.min(86,l.cellSize*2.2),identifier:1};
   const predicted=s.board.map(row=>row.slice());move.shape.cells.forEach(([x,y])=>{predicted[move.r+y][move.c+x]=1;});
   const oracle=expectedClear(predicted);same(engine.findCompletedRegions(predicted),oracle.regions,'region mismatch');
   handlers.TouchMove(event(end));assert.ok(s.drag.valid);
   same(s.drag.previewClearingCells.map(([c,r])=>r*predicted[0].length+c).sort((a,b)=>a-b),[...oracle.cleared].sort((a,b)=>a-b),'preview mismatch');
   const gains=oracle.regions.palaces.filter(([c,r])=>s.energyPalaces.includes(r*(predicted[0].length/3)+c)).length;
   const charge=Math.floor((s.energy+gains)/3), energy=(s.energy+gains)%3;
   const pending=s.luckyPendingCount+charge;
   const refresh=s.tray.filter(Boolean).length===1;
   const lastCombo=s.combo;
   handlers.TouchEnd({touches:[],changedTouches:[end]});
   if(s.inputLocked){handlers.TouchStart(event(startAt((move.index+1)%3)));assert.strictEqual(s.drag,null);noise.locked++;}
   tick();tick();
   for(const key of oracle.cleared)predicted[Math.floor(key/predicted[0].length)][key%predicted[0].length]=0;
   same(s.board,predicted,'board mismatch');
   const n=oracle.count,bonus=n===0?0:n===1?10:n===2?40:80+(n-3)*35;
   assert.strictEqual(s.score,initialScore+move.shape.cells.length+bonus);
   assert.strictEqual(s.piecesPlaced,initialSteps+1);assert.strictEqual(s.combo,n?lastCombo+1:0);
   assert.ok(s.maxCombo>=s.combo);assert.strictEqual(s.energy,energy);
   assert.strictEqual(s.luckyPendingCount,pending-(refresh&&pending>0?1:0));
   if(refresh){assert.strictEqual(s.tray.filter(v=>v&&v.lucky).length,pending>0?1:0);if(pending>0)delivered=true;}
   assert.ok(!s.inputLocked && !s.drag,'input stuck');
   assert.ok(s.safetyGuaranteesRemaining>=0 && s.safetyGuaranteesRemaining<=MODES[id].rescues);
   same(s.unavailableTray,s.tray.map(shape=>Boolean(shape)&&!available(s.board,shape)),'availability mismatch');
   assert.strictEqual(s.gameOver,s.tray.every((shape,i)=>!shape||s.unavailableTray[i]));
   assert.ok(s.best>=s.score);assert.strictEqual(storage[MODES[id].bestKey],s.best);
   const checkpoint = storage[saveTools.keyFor(id)];
   if (s.gameOver) assert.strictEqual(checkpoint,null);
   else {
     assert.ok(saveTools.decode(checkpoint,id),'save cannot be restored');
     same(checkpoint,saveTools.snapshot(s),'save differs from settled game');
   }
   s.board.forEach((row,r)=>row.forEach((v,c)=>assert.ok(base[r][c]===0?(v===0||v===1):v===base[r][c],'map damaged')));
   assert.strictEqual(new Set(s.energyPalaces).size,s.energyPalaces.length);
   for(const p of s.energyPalaces){
    const r=Math.floor(p/(base[0].length/3))*3,c=p%(base[0].length/3)*3;
    for(let y=0;y<3;y++)for(let x=0;x<3;x++)assert.strictEqual(base[r+y][c+x],0,'unreachable energy palace');
   }
   if(totalMoves%101===0)game.present();
   summary.regions+=n;summary.energy+=gains;charged ||= charge>0;totalMoves++;
  }
  // Every generated dead board must have a revival that preserves the map and opens a legal move.
  const deadBoard=JSON.stringify(s.board),revival=gameTools.revivalCells(s);
  assert.ok(revival&&revival.length,'no revival available');
  const revived=s.board.map(row=>row.slice());
  for(const [c,r] of revival){assert.equal(revived[r][c],1);revived[r][c]=0;}
  assert.ok(s.tray.some(piece=>piece&&available(revived,piece)),'revival still dead');
  assert.equal(JSON.stringify(s.board),deadBoard,'revival preview changed board');
  summary.steps+=s.piecesPlaced;summary.score+=s.score;summary.chargedGames+=charged?1:0;summary.deliveredGames+=delivered?1:0;
  summary.pendingAtDeath+=s.luckyPendingCount;summary.rescues+=MODES[id].rescues-s.safetyGuaranteesRemaining;
  summary.maxSteps=Math.max(summary.maxSteps,s.piecesPlaced);
 }
 results.push(summary);console.log(JSON.stringify(summary));
}
} catch(error){console.error('Reproduce:',activeCase,'move',game.state.piecesPlaced);throw error;}
const hash=crypto.createHash('sha256');for(const file of ['game.js','js/rules/board.js','js/rules/shapes.js','js/config.js','js/persistence/saves.js'])hash.update(fs.readFileSync(path.join(root,file)));
const report={games:games*15,totalMoves,noise,sourceSha256:hash.digest('hex'),results};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log('PASS',JSON.stringify({games:report.games,totalMoves,noise}));
