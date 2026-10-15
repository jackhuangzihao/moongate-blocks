// node tests/design/gravity-benchmark.js [games per mode/strategy] [report path]
// Actual production dealing and touch handlers; no undo, revival or tutorial.
const assert=require('assert'),fs=require('fs');
const {boot}=require('../helpers/game-harness');
const B=require('../../js/rules/board'),G=require('../../js/gravity/gravity-engine');
const {MODE_ORDER,MODES}=require('../../js/config');
const games=Number(process.argv[2]||200),cap=500;
assert.ok(Number.isInteger(games)&&games>0&&games<=2000);
function random(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function choose(board,tray,policy,rng,gravity){
 let best=null,value=-Infinity,ties=0;
 tray.forEach((piece,slot)=>{
  if(!piece)return;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
   if(!B.canPlace(board,piece,c,r))continue;
   let rank=0;
   if(policy!=='random'){
    const next=board.map(row=>row.slice());B.placeShape(next,piece,c,r);
    const done=B.findCompletedRegions(next);rank=done.rows.length+done.cols.length+done.palaces.length;
    // Include consequent clears, which the gravity player can observe after a move.
    if(gravity&&rank)rank=G.settle(next).clears;
   }
   if(rank>value){value=rank;ties=0;}
   if(rank===value&&rng()<1/++ties)best=[slot,c,r];
  }
 });return best;
}
const results=[];
for(const policy of ['random','clearFirst'])for(const mode of MODE_ORDER.concat('gravity')){
 let deal=random(1);
 const app=mode==='gravity'?null:boot({fangcunTutorialSeen:true,fangcunLuckyWelcomeUsed:true},{random:()=>deal()});
 const rows=[];
 for(let i=0;i<games;i++){
  const seed=(73919+i*1009)>>>0,rng=random(seed^0x5f3759df);deal=random(seed);
  let state;
  if(app){app.run(`state.challenge=null;state.mode='${mode}';restartGame()`);state=app.run('state');}
  else state=G.start('free',seed);
  let steps=0;
  while(!(app?state.gameOver:state.over)&&steps<cap){
   const tray=app?state.tray:state.tray.map(id=>id?G.shape(id):null);
   const move=choose(state.board,tray,policy,rng,!app);assert.ok(move,'live state must have a legal move');
   if(app)app.move(move);else state=G.play(state,...move).state;
   steps++;
   assert.equal(app?state.piecesPlaced:state.steps,steps);
  }
  rows.push({seed,steps,score:state.score,clears:app?state.sessionClears:state.clears,capped:steps===cap&&!(app?state.gameOver:state.over)});
 }
 const mean=key=>rows.reduce((sum,r)=>sum+r[key],0)/games;
 const sorted=rows.map(r=>r.steps).sort((a,b)=>a-b);
 const result={mode,title:MODES[mode]?.title||'落玉庭',policy,games,meanSteps:mean('steps'),medianSteps:sorted[Math.floor(games/2)],meanClears:mean('clears'),meanScore:mean('score'),reached100:rows.filter(r=>r.steps>=100).length,capped:rows.filter(r=>r.capped).length,rows};
 results.push(result);console.log(JSON.stringify({...result,rows:undefined}));
}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({games,cap,policies:['random','clearFirst'],notes:'Different production dealing/scoring retained. Scores are not comparable. No player retention claims. Step cap is censored, not a loss.',results},null,2));
