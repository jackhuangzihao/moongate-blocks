const { canPlace, placeShape, findCompletedRegions } = require('./board');
const challenges = require('../challenge/challenges');

// A hint is sold only when a complete winning continuation has been replayed.
// ponytail: bounded search may decline a solvable board; never substitute a greedy guess.
let cachedLevel = -1;
const continuations = new Map();
const copyRun = run => JSON.parse(JSON.stringify(run));
const positionKey = run => JSON.stringify([run.board,run.ice,run.stones,run.flowers,run.keys,run.gates,run.tray.map(p=>p&&p.id),run.cursor,run.progress,run.history.length]);
function winningPath(source, { maxNodes = 20000, maxMs = 60 } = {}) {
  if (!source || source.ended) return null;
  if (cachedLevel !== source.level) { cachedLevel=source.level; continuations.clear(); }
  const key=positionKey(source);
  if (continuations.has(key)) return continuations.get(key).map(m=>m.slice());
  const deadline=Date.now()+maxMs, reference=challenges.level(source.level).solution;
  let nodes=0;
  const expired=()=>nodes>=maxNodes || Date.now()>=deadline;
  const advance=(run,move)=>{
    if(expired())return null;
    nodes++;
    const next=copyRun(run);
    return challenges.play(next,...move)?next:null;
  };
  const visited=new Set();
  function search(run) {
    if(run.won)return [];
    if(run.ended || expired())return null;
    const key=positionKey(run);
    if(visited.has(key))return null;
    visited.add(key);
    // Off-path boards often still admit an authored suffix. Replay it, don't assume it.
    const remaining=reference.slice();
    for(const move of run.history){
      const used=remaining.findIndex(m=>m.every((v,i)=>v===move[i]));
      if(used>=0)remaining.splice(used,1);
    }
    const candidates=continuations.has(key)?[continuations.get(key)]:[remaining,...reference.map((_,i)=>reference.slice(i))];
    for(const plan of candidates){
      let test=run;const path=[];
      for(const move of plan){
        test=advance(test,move);
        if(!test)break;
        path.push(move);
        if(test.won)return path;
        if(test.ended)break;
      }
      if(expired())return null;
    }
    const options=[];
    for(let slot=0;slot<3;slot++){
      const piece=run.tray[slot];if(!piece)continue;
      for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        if(expired())return null;
        if(!canPlace(run.board,piece,c,r))continue;
        const move=[slot,c,r],next=advance(run,move);
        if(!next)continue;
        if(next.won)return [move];
        if(!next.ended)options.push({move,next,value:(next.progress-run.progress)*100+(run.ice.length-next.ice.length)*4
          +(run.flowers || []).reduce((sum,p,i)=>sum+p[2]-next.flowers[i][2],0)*20
          +(run.keys.length-next.keys.length)*40});
      }
    }
    options.sort((a,b)=>b.value-a.value);
    for(const {move,next} of options){const tail=search(next);if(tail)return [move,...tail];if(expired())return null;}
    return null;
  }
  const path=search(source);
  if(!path)return null;
  let run=copyRun(source);
  if(continuations.size>128)continuations.clear();
  for(let i=0;i<path.length;i++){
    continuations.set(positionKey(run),path.slice(i).map(m=>m.slice()));
    challenges.play(run,...path[i]);
  }
  return path.map(m=>m.slice());
}
// No verified continuation from here: step back to the nearest position that still wins.
// An authored prefix always wins, so once the search budget is spent we fall back to it.
function recovery(run, maxMs = 120) {
  const level=challenges.level(run.level), deadline=Date.now()+maxMs;
  for(let undo=1;undo<=run.history.length;undo++){
    const history=run.history.slice(0,run.history.length-undo);
    const authored=history.every((move,i)=>move.every((v,j)=>v===level.solution[i][j]));
    if(!authored && Date.now()>=deadline)continue;
    const earlier=challenges.restore({level:run.level,rule:level.rule,history,failedOnce:run.failedOnce});
    const path=earlier && winningPath(earlier,authored?{maxNodes:Infinity,maxMs:1000}:{maxNodes:3000,maxMs:15});
    if(path)return {undo,run:earlier,path};
  }
  return null;
}
function suggest(state) {
  if (state.gameOver || (state.challenge && state.challenge.ended)) return null;
  if (state.challenge) {
    const path=winningPath(state.challenge);
    if (path) return {slot:path[0][0],c:path[0][1],r:path[0][2]};
    const back=recovery(state.challenge);
    return back && {slot:back.path[0][0],c:back.path[0][1],r:back.path[0][2],undo:back.undo,run:back.run};
  }
  let best = null, value = -Infinity;
  state.tray.forEach((piece,slot)=>{
    if (!piece) return;
    for(let r=0;r<state.board.length;r++) for(let c=0;c<state.board[0].length;c++) {
      if(!canPlace(state.board,piece,c,r))continue;
      const board=state.board.map(row=>row.slice());placeShape(board,piece,c,r);
      const done=findCompletedRegions(board);
      let score=(done.rows.length+done.cols.length+done.palaces.length)*100;
      for(const index of state.energyPalaces) {
        const x=index%(board[0].length/3)*3,y=Math.floor(index/(board[0].length/3))*3;
        let filled=0;for(let a=0;a<3;a++)for(let b=0;b<3;b++)filled+=board[y+a][x+b]===1?1:0;
        score+=filled*filled;
      }
      if(score>value){value=score;best={slot,c,r};}
    }
  });
  return best;
}

// Remove the fewest ordinary cells needed for one current piece to fit.
// Permanent obstacles and missing corners are never touched; no score is earned.
function revivalCells(state) {
  let best=null;
  for(const piece of state.tray) {
    if(!piece)continue;
    for(let r=0;r<state.board.length;r++)for(let c=0;c<state.board[0].length;c++) {
      const cells=piece.cells.map(([x,y])=>[c+x,r+y]);
      if(cells.some(([x,y])=>!state.board[y] || ![0,1].includes(state.board[y][x])))continue;
      const occupied=cells.filter(([x,y])=>state.board[y][x]===1);
      if(occupied.length && (!best || occupied.length<best.length))best=occupied;
    }
  }
  return best;
}
module.exports={suggest,revivalCells,winningPath};
