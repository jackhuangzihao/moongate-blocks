const assert=require('assert'),G=require('../docs/prototypes/gravity/engine'),B=require('../js/rules/board');
let moves=0;
for(const p of G.PUZZLES){
 let s=G.start(p.id);
 for(const m of p.solution){const before=JSON.stringify(s),a=G.play(s,...m);assert.ok(a);assert.equal(JSON.stringify(s),before);assert.deepStrictEqual(a,G.play(s,...m));s=a.state;moves++;assert.deepStrictEqual(G.restore(G.save(s)),s);}
 assert.ok(s.won,p.title);assert.equal(G.play(s,0,0,0),null);
 const back=G.undo(s);assert.ok(back.undoUsed);assert.equal(G.undo(back),null);assert.deepStrictEqual(G.restore(G.save(back)),back);
 const again=G.play(back,...p.solution.at(-1));assert.ok(again.state.won);assert.deepStrictEqual(again.state.board,s.board);
}
let state=G.start(1),first=G.play(state,0,2,8);
assert.equal(first.frames.length,0);assert.equal(first.state.board[1][0],1,'no clearing means no gravity');
for(const move of [[-1,0,0],[0,-1,0],[0,9,0],[0,0,9],[0,NaN,0],[3,0,0]])assert.equal(G.play(state,...move),null);
for(const data of [null,{}, {version:1,mode:'wrong'}, {...G.save(state),moves:[[0,9,0]]},{...G.save(state),moves:[null]},{...G.save(state),seed:-1}])assert.equal(G.restore(data),null);
let rnd=123456789;function random(){rnd=(Math.imul(rnd,1664525)+1013904223)>>>0;return rnd/4294967296;}
for(let game=0;game<120;game++){
 let s=G.start('free',game);
 for(let n=0;n<150&&!s.over;n++){
  const choices=[];s.tray.forEach((id,slot)=>{if(id)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(G.canPlay(s,slot,c,r))choices.push([slot,c,r]);});
  if(!choices.length)break;
  const move=choices[Math.floor(random()*choices.length)],result=G.play(s,...move);assert.ok(result);s=result.state;moves++;
  assert.deepStrictEqual(B.findCompletedRegions(s.board),{rows:[],cols:[],palaces:[]});
  assert.ok(result.frames.length<=162);assert.ok(s.board.flat().every(x=>x===0||x===1));
  assert.ok(JSON.stringify(G.save(s)).length < 2000, 'snapshots stay bounded regardless of game length');
  if(n%15===0)assert.deepStrictEqual(G.restore(G.save(s)),s);
 }
}
// A tray refresh and undo must replay the same next draw.
state=G.start('free',42);for(const m of [[0,0,0],[1,4,0],[2,0,5]]){const r=G.play(state,...m);assert.ok(r);state=r.state;}
assert.equal(G.undo({...state,over:true}),null,'ended games cannot use undo as a free revival');
const undone=G.undo(state),replayed=G.play(undone,2,0,5).state;assert.deepStrictEqual(replayed.tray,state.tray);assert.equal(replayed.random,state.random);
console.log(`PASS: six gravity routes, ${moves} placements, settled-board invariants, deterministic refill, whole-turn undo, validated replay saves and bad inputs`);
