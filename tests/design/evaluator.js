// Offline authoring only. Search always executes the shipped rules; no parallel
// model of ice, flowers or doors can quietly disagree with the actual game.
const C=require('../../js/challenge/challenges');
const B=require('../../js/rules/board');
function random(seed) { let n=seed>>>0;return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296); }
function clone(run) {
  return {...run,board:run.board.map(r=>r.slice()),tray:run.tray.slice(),history:run.history.slice(),
    ice:run.ice.map(p=>p.slice()),stones:run.stones.map(p=>p.slice()),keys:run.keys.map(p=>p.slice()),
    gates:run.gates.map(g=>({id:g.id,cells:g.cells.map(p=>p.slice())})),flowers:run.flowers.map(p=>p.slice())};
}
function options(run) {
  const list=[];if(run.ended)return list;
  const shapes=new Set();
  run.tray.forEach((piece,slot)=>{
    if(!piece||shapes.has(piece.id))return;shapes.add(piece.id);
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(B.canPlace(run.board,piece,c,r))list.push([slot,c,r]);
  });return list;
}
function key(run) {
  return [run.board.flat().join(''),run.tray.map(p=>p?p.id:'').join(','),run.cursor,run.progress,
    JSON.stringify([run.ice,run.stones,run.keys,run.gates,run.flowers])].join('|');
}
function potential(run) {
  const targets=run.stones.concat(run.ice,run.keys);
  for(const [c,r,n] of run.flowers)if(n>0)for(const [x,y] of [[c-1,r],[c+1,r],[c,r-1],[c,r+1]])if(x>=0&&x<9&&y>=0&&y<9)targets.push([x,y]);
  let value=0;
  const areas=[];
  for(let n=0;n<9;n++) {
    areas.push(Array.from({length:9},(_,i)=>[i,n]),Array.from({length:9},(_,i)=>[n,i]),
      Array.from({length:9},(_,i)=>[(n%3)*3+i%3,Math.floor(n/3)*3+Math.floor(i/3)]));
  }
  for(const cells of areas) {
    if(cells.some(([c,r])=>run.gates.some(g=>g.cells.some(([x,y])=>x===c&&y===r))))continue;
    if(cells.length===9 && cells.every(([c,r])=>run.board[r][c]===2))continue;
    let filled=0,empty=0;
    for(const [c,r] of cells){if(run.board[r][c]===1)filled++;if(run.board[r][c]===0)empty++;}
    if(!filled||!empty)continue;
    const relevant=targets.some(([x,y])=>cells.some(([c,r])=>c===x&&r===y));
    value+=filled*filled/(empty+1)*(relevant?3:1);
  }
  return value;
}
function value(run) {
  const level=C.level(run.level);
  const water=(level.flowers||[]).reduce((s,f)=>s+f[2],0)-run.flowers.reduce((s,f)=>s+f[2],0);
  return run.progress*700+water*220+((level.keys||[]).length-run.keys.length)*300+
    ((level.ice||[]).length-run.ice.length)*65+run.totalClears*20+potential(run);
}
function solve(id,{width=70,maxSteps=C.level(id).limit}={}) {
  let beam=[C.start(id)],nodes=0;
  for(let depth=0;depth<maxSteps;depth++) {
    const next=[],seen=new Set();
    for(const run of beam)for(const move of options(run)) {
      const trial=clone(run);C.play(trial,...move);nodes++;
      if(trial.won)return {route:trial.history,nodes};
      if(trial.ended)continue;
      const signature=key(trial);if(seen.has(signature))continue;seen.add(signature);
      next.push({run:trial,value:value(trial)});
    }
    next.sort((a,b)=>b.value-a.value);beam=next.slice(0,width).map(x=>x.run);
    if(!beam.length)break;
  }
  return {route:null,nodes};
}
function greedy(id,seed=1,fit=false) {
  const rng=random(seed),run=C.start(id);
  while(!run.ended) {
    let best=null,bestValue=-Infinity;
    for(const move of options(run)) {
      const trial=clone(run),result=C.play(trial,...move);
      // Compare immediate goal reward / clears. The second baseline also values
      // near-full regions, but neither reads the authored reference route.
      const score=(trial.progress-run.progress)*700+result.count*100+result.brokenIce.length*20+
        result.wateredFlowers.length*50+result.collectedKeys.length*150+(fit?potential(trial):0)+rng()*.001;
      if(score>bestValue){bestValue=score;best=trial;}
    }
    if(!best)break;Object.assign(run,best);
  }
  return {won:run.won,stars:C.stars(run),moves:run.history.length};
}
module.exports={random,clone,options,key,potential,solve,greedy};
