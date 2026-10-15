const assert = require('assert');
const C = require('../js/challenge/challenges'), D = require('../js/daily/daily'), B = require('../js/rules/board'), Tools = require('../js/rules/tools');
const copy = value => JSON.parse(JSON.stringify(value));
assert.equal(C.LEVELS.length, C.CHAPTERS.length * 18, 'Dedicated puzzles do not append chapter progress');
assert.equal(C.DAILY_LEVELS.length, 42);
assert.equal(new Set(C.DAILY_LEVELS.map(level=>level.kind)).size, 6);
for (const bad of [-C.DAILY_LEVELS.length - 1, C.LEVELS.length, '0', '-1', NaN, null]) assert.equal(C.level(bad), undefined);
function orientations(board) {
  const result=[];
  for(let mirror=0;mirror<2;mirror++) {
    let b=board.map(row=>mirror?row.slice().reverse():row.slice());
    for(let turn=0;turn<4;turn++){result.push(JSON.stringify(b));b=b[0].map((_,c)=>b.map(row=>row[c]).reverse());}
  }
  return result;
}
const chapterBoards=new Set(C.LEVELS.flatMap(level=>orientations(C.start(level.id).board))), dailyBoards=new Set();
for (const level of C.DAILY_LEVELS) {
  let run=C.start(level.id);
  const signature=JSON.stringify(run.board);
  assert.ok(!chapterBoards.has(signature),`${level.title} is not a chapter board or its rotation/mirror`);
  assert.ok(!dailyBoards.has(signature),`${level.title} has its own board`); dailyBoards.add(signature);
  assert.deepStrictEqual(B.findCompletedRegions(run.board),{rows:[],cols:[],palaces:[]});
  for(let slot=0;slot<3;slot++)for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const trial=copy(run); if(C.play(trial,slot,c,r))assert.equal(trial.won,false,'No daily puzzle is a one-move tutorial');
  }
  for(const move of level.solution){
    assert.deepStrictEqual(C.restore(C.checkpoint(run)),run,'Negative-id checkpoint replays exactly');
    const before=copy(run);assert.ok(C.play(run,...move),level.title);
    if(!run.won)assert.deepStrictEqual(C.undo(run),before,'Undo crosses daily tray refreshes');
  }
  assert.ok(run.won,level.title);assert.equal(C.stars(run),3);
  assert.equal(run.history.length,level.par);
  run=C.start(level.id);C.play(run,...level.solution[0]);
  const hint=Tools.winningPath(run,{maxMs:1000});assert.ok(hint,`${level.title} has a verified hint continuation`);
  for(const move of hint)assert.ok(C.play(run,...move));assert.ok(run.won);
}

let seed=71381,games=0,moves=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const level of C.DAILY_LEVELS)for(let round=0;round<50;round++){
  const run=C.start(level.id);
  while(!run.ended){
    const options=[];
    run.tray.forEach((piece,slot)=>{if(piece)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(B.canPlace(run.board,piece,c,r))options.push([slot,c,r]);});
    assert.ok(options.length);const before=copy(run),move=options[Math.floor(random()*options.length)];
    assert.ok(C.play(run,...move));moves++;
    if(!run.won)assert.deepStrictEqual(C.undo(run),before);
    if(!run.ended)assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);
    for(const [c,r] of level.blocked)assert.equal(run.board[r][c],2);
    assert.ok(run.history.length<=level.limit);
  }
  games++;
}
const oldPool=[3,4,5,6,7,12,13,17,19,22,24,28,32,36,38,40,42,44];
for(let offset=0;offset<40;offset++){
  const timestamp=Date.UTC(2026,8,offset+1),date=D.dateKey(timestamp),day=timestamp/86400000;
  if(date<'2026-10-05')assert.equal(D.levelFor(date),oldPool[day%oldPool.length],'Previous dates keep the exact 18-puzzle rotation');
}
for(let i=0;i<8;i++)assert.equal(D.levelFor(D.dateKey(Date.UTC(2026,9,5+i))),-(i%28)-1);
assert.equal(D.levelFor('2026-10-05'),-1);
console.log(`PASS: ${C.DAILY_LEVELS.length} independent daily layouts, no chapter mirrors, all reference solutions/hints, ${games} random games / ${moves} moves, old-date compatibility`);
