// Pure gravity rules shared by WeChat and the offline preview. No platform I/O.
const B=require('../rules/board');
const {SHAPES}=require('../rules/shapes');
const copy=value=>JSON.parse(JSON.stringify(value));
const shape=id=>SHAPES.find(item=>item.id===id);
function empty(){return Array.from({length:9},()=>Array(9).fill(0));}
function puzzle(id,title,description,floating,gap,deck,solution,goal){
 const board=empty();for(let c=0;c<9;c++)if(!gap.includes(c))board[8][c]=1;
 floating.forEach(([c,r])=>board[r][c]=1);
 return {id,title,description,board,deck,solution,goal};
}
const floats=Array.from({length:9},(_,c)=>[c,c%3]);
// Keep legacy lesson definitions for save validation; the UI exposes only one demo.
const PUZZLES=[
 puzzle(0,'初落','先填满底行：消除后，上方玉块才会落下。',[[1,2],[4,1],[7,3]],[3,4,5],['line3H','line2V','dot'],[[0,3,8]],{clears:1,falls:1,chain:1}),
 puzzle(1,'留空','普通落子不会触发重力。先补缺口，再完成底行。',[[0,1],[4,2],[8,0]],[2,3,4,5],['dot','line3H','square2'],[[0,2,8],[1,3,8]],{clears:1,falls:1,chain:1}),
 puzzle(2,'接力','上方每列留一格，落稳后会再次填满底行。',floats,[3,4,5],['line3H','square2','line2V'],[[0,3,8]],{clears:2,falls:1,chain:2}),
 puzzle(3,'双层','两层散落的玉块，会在落稳后一起完成消除。',floats.concat(Array.from({length:9},(_,c)=>[c,3+c%3])),[6,7,8],['line3H','corner3A','dot'],[[0,6,8]],{clears:3,falls:1,chain:2}),
 puzzle(4,'补桥','观察缺少玉块的列，先补上，再触发下落。',floats.slice(0,8),[3,4,5],['dot','line3H','line2V'],[[0,8,2],[1,3,8]],{clears:2,falls:1,chain:2}),
 puzzle(5,'合流','先为两列各留一格，让分散的玉块落成一行。',floats.slice(0,7),[3,4,5],['line2H','line3H','square2'],[[0,7,3],[1,3,8]],{clears:2,falls:1,chain:2})
];
function nextRandom(state){state.random=(Math.imul(state.random,1664525)+1013904223)>>>0;return state.random/4294967296;}
function deal(state){return Array.from({length:3},()=>SHAPES[Math.floor(nextRandom(state)*SHAPES.length)].id);}
function start(mode=0,seed=271828){
 if(mode!=='free' && !PUZZLES[mode])throw Error('Unknown gravity puzzle');
 const state={version:2,mode,seed:seed>>>0,random:seed>>>0,board:mode==='free'?empty():copy(PUZZLES[mode].board),tray:[],score:0,clears:0,falls:0,chain:0,steps:0,previous:null,moves:[],undoUsed:false,won:false,over:false};
 state.tray=mode==='free'?deal(state):PUZZLES[mode].deck.slice();return state;
}
function drop(board){
 const movements=[];
 for(let c=0;c<9;c++){
  let bottom=8;
  for(let r=8;r>=0;r--)if(board[r][c]===1){
   if(r!==bottom){board[bottom][c]=1;board[r][c]=0;movements.push({c,from:r,to:bottom});}
   bottom--;
  }
 }
 return movements;
}
function settle(board){
 const frames=[];let clears=0,falls=0,chain=0;
 // Every wave removes at least one occupied cell, so 81 is a strict bound.
 for(let i=0;i<81;i++){
  const regions=B.findCompletedRegions(board),count=regions.rows.length+regions.cols.length+regions.palaces.length;
  if(!count)break;
  const before=copy(board);B.clearCompletedRegions(board,regions);
  frames.push({kind:'clear',before,after:copy(board),wave:++chain});clears+=count;
  const from=copy(board),movements=drop(board);falls+=movements.length;
  if(movements.length)frames.push({kind:'fall',before:from,after:copy(board),movements,wave:chain});
 }
 return {frames,clears,falls,chain};
}
function canPlay(state,slot,c,r){
 if(![slot,c,r].every(Number.isInteger)||slot<0||slot>2||state.won||state.over)return false;
 const piece=shape(state.tray[slot]);return Boolean(piece && B.canPlace(state.board,piece,c,r));
}
function play(current,slot,c,r){
 if(!canPlay(current,slot,c,r))return null;
 const piece=shape(current.tray[slot]);
 const state=copy({...current,previous:null});state.previous=copy({...current,previous:null});B.placeShape(state.board,piece,c,r);state.tray[slot]=null;
 const result=settle(state.board);state.clears+=result.clears;state.falls+=result.falls;state.chain=Math.max(state.chain,result.chain);
 state.score+=piece.cells.length+result.clears*9;state.steps++;state.moves=[[slot,c,r]];
 if(state.tray.every(item=>!item))state.tray=deal(state);
 if(state.mode!=='free'){
  const goal=PUZZLES[state.mode].goal;
  state.won=state.clears>=goal.clears && state.falls>=goal.falls && state.chain>=goal.chain;
 }
 state.over=!state.won && !state.tray.some(id=>id && B.hasAnyPlacement(state.board,shape(id)));
 return {state,frames:result.frames};
}
function replay(mode,seed,moves){
 let state=start(mode,seed);
 for(const move of moves){if(!Array.isArray(move)||move.length!==3)throw Error('Invalid move');const result=play(state,...move);if(!result)throw Error('Illegal move');state=result.state;}
 return state;
}
function undo(state){
 if(state.over || state.undoUsed || !state.previous)return null;
 return {...copy(state.previous),previous:null,undoUsed:true};
}
function save(state){return copy(state);}
function validCore(data){
 if(!data || data.version!==2 || !(data.mode==='free'||Number.isInteger(data.mode)&&PUZZLES[data.mode]))return false;
 if(!['seed','random'].every(k=>Number.isInteger(data[k])&&data[k]>=0&&data[k]<=4294967295))return false;
 if(!['score','clears','falls','chain','steps'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0))return false;
 if(!['undoUsed','won','over'].every(k=>typeof data[k]==='boolean'))return false;
 if(!Array.isArray(data.board)||data.board.length!==9||!data.board.every(row=>Array.isArray(row)&&row.length===9&&row.every(cell=>cell===0||cell===1)))return false;
 if(!Array.isArray(data.tray)||data.tray.length!==3||!data.tray.every(id=>id===null||Boolean(shape(id)))||!data.tray.some(Boolean))return false;
 if(!Array.isArray(data.moves)||data.moves.length>(data.steps?1:0)||!data.moves.every(move=>Array.isArray(move)&&move.length===3&&move.every(Number.isInteger)))return false;
 const completed=B.findCompletedRegions(data.board);if(completed.rows.length||completed.cols.length||completed.palaces.length)return false;
 const goal=data.mode==='free'?null:PUZZLES[data.mode].goal;
 const won=Boolean(goal&&data.clears>=goal.clears&&data.falls>=goal.falls&&data.chain>=goal.chain);
 return data.won===won && data.over===(!won&&!data.tray.some(id=>id&&B.hasAnyPlacement(data.board,shape(id))));
}
function restore(data){
 try{
  // Migrate browser prototype saves once; new saves and rollback stay constant-size.
  if(data && data.version===1){
   if(!(data.mode==='free'||Number.isInteger(data.mode)&&PUZZLES[data.mode])||!Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295||!Array.isArray(data.moves)||data.moves.length>10000||typeof data.undoUsed!=='boolean')return null;
   const state=replay(data.mode,data.seed,data.moves);state.undoUsed=data.undoUsed;
   if(state.previous)state.previous.undoUsed=data.undoUsed;
   return state;
  }
  if(!validCore(data))return null;
  // Validate the bounded history before cloning any supplied object.
  if(data.previous && (!validCore(data.previous)||data.previous.previous!==null))return null;
  const state=copy(data);
  if(state.previous){
   if(!validCore(state.previous)||state.previous.previous!==null||state.moves.length!==1||state.previous.mode!==state.mode||state.previous.seed!==state.seed)return null;
   const check=play(state.previous,...state.moves[0]);
   if(!check || ['board','tray','random','score','clears','falls','chain','steps','undoUsed','won','over'].some(k=>JSON.stringify(check.state[k])!==JSON.stringify(state[k])))return null;
  }else if(state.steps===0){
   const initial=start(state.mode,state.seed);
   if(['board','tray','random','score','clears','falls','chain','won','over'].some(k=>JSON.stringify(initial[k])!==JSON.stringify(state[k])))return null;
  }else if(!state.undoUsed)return null;
  return state;
 }catch(_){return null;}
}
function preview(state,slot,c,r){
 if(!canPlay(state,slot,c,r))return null;
 const board=copy(state.board);B.placeShape(board,shape(state.tray[slot]),c,r);
 const regions=B.findCompletedRegions(board);
 return {regions,falls:regions.rows.length+regions.cols.length+regions.palaces.length>0};
}
module.exports={PUZZLES,start,play,canPlay,preview,drop,settle,undo,save,restore,shape};
