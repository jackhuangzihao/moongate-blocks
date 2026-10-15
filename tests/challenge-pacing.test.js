const assert=require('assert');
const C=require('../js/challenge/challenges');
const B=require('../js/rules/board');
const copy=value=>JSON.parse(JSON.stringify(value));
const changed=[
  {id:8,kind:'regions',target:2,par:3,oldRule:6},
  {id:16,kind:'ice',target:2,par:4,oldRule:6},
  {id:20,kind:'regions',target:3,par:7,oldRule:6},
  {id:28,kind:'area',target:9,par:6,oldRule:6},
  {id:32,kind:'ice',target:4,par:5,oldRule:6},
  {id:40,kind:'flowers',target:1,par:7,oldRule:1},
  {id:44,kind:'flowers',target:1,par:6,oldRule:1}
];

assert.equal(C.LEVELS.length,90);
for(let chapter=0;chapter<C.CHAPTERS.length;chapter++) {
  const levels=C.chapterLevels(chapter);
  assert.equal(levels.length,18);
  assert.equal(levels[0].pace,'入门');assert.equal(levels[11].pace,'综合');
  for(const pace of ['入门','运用','规划','小憩','综合'])assert.ok(levels.some(l=>l.pace===pace));
  for(const level of levels.filter(l=>l.pace==='小憩')) {
    assert.ok(level.par<C.LEVELS[level.id-1].par,'A breather has a shorter authored route than the preceding puzzle');
    assert.ok(level.par<C.LEVELS[level.id+1].par,'Planning returns after the breather');
    assert.ok(level.limit>=level.par+4,'A breather also leaves room for experimentation');
  }
}
for(const level of C.LEVELS) {
  const run=C.start(level.id),done=B.findCompletedRegions(run.board);
  assert.equal(done.rows.length+done.cols.length+done.palaces.length,0,level.title);
  assert.equal(level.solution.length,level.par,'Three stars retain a concrete verified move budget');
  assert.ok(level.limit>=level.par+3);
  assert.deepStrictEqual(C.start(level.id),run,'The authored deal never rerolls');
  level.solution.forEach((move,i)=>{
    assert.deepStrictEqual(C.restore(C.checkpoint(run)),run,level.title+' checkpoint');
    assert.ok(C.play(run,...move),level.title+' legal route');
    assert.equal(run.won,i===level.solution.length-1,level.title+' reaches its goal at the end of the route');
  });
  assert.equal(C.stars(run),3,level.title);
}
for(const level of C.LEVELS.slice(0,3)) {
  assert.equal(level.par,1);assert.equal(level.limit,4);assert.equal(level.rule,1);
}
// Passing and star hunting are distinct: two harmless experiments still pass
// the tutorial, but earn one star; the direct route continues to earn three.
const retry=C.start(0);
assert.ok(C.play(retry,1,0,0));assert.ok(C.play(retry,2,8,0));
assert.ok(C.play(retry,...C.LEVELS[0].solution[0]));assert.ok(retry.won);assert.equal(C.stars(retry),1);

// Goal/layout changes reset only the affected in-progress run. Earned stars
// and another chapter's untouched run survive that migration.
const stars=Array(C.LEVELS.length).fill(3);
for(const change of changed) {
  const level=C.LEVELS[change.id];
  for(const key of ['kind','target','par'])assert.equal(level[key],change[key]);
  assert.equal(level.pace,'小憩');assert.notEqual(level.rule,change.oldRule);
  const chapter=Math.floor(change.id/12),other=(chapter+1)%4;
  const runs=Array(4).fill(null);
  runs[chapter]={level:change.id,rule:change.oldRule,history:[]};
  runs[other]=C.checkpoint(C.start(other*12));
  const loaded=C.load({getStorageSync:()=>({version:1,chapter,stars,runs})});
  assert.deepStrictEqual(loaded.stars,stars);assert.equal(loaded.active,null);assert.ok(loaded.updatedLayout);
  assert.deepStrictEqual(loaded.runs[other],runs[other]);
}

// Stress the seven changed tasks with repeatable legal choices, including
// failure, replay and undo. Invalid moves never consume the expanded budget.
let seed=20261004,games=0,moves=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const {id} of changed)for(let game=0;game<100;game++) {
  const run=C.start(id);
  while(!run.ended) {
    const choices=[];
    run.tray.forEach((piece,slot)=>{if(piece)for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(B.canPlace(run.board,piece,c,r))choices.push([slot,c,r]);});
    assert.ok(choices.length);
    const before=copy(run);assert.equal(C.play(run,0,-1,-1),null);assert.deepStrictEqual(run,before);
    C.play(run,...choices[Math.floor(random()*choices.length)]);moves++;
    assert.ok(run.history.length<=C.LEVELS[id].limit);
    if(!run.won)assert.deepStrictEqual(C.undo(run),before);
    if(!run.ended)assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);
  }
  games++;
}
console.log(`PASS: ${C.LEVELS.length} verified three-star routes, ${C.CHAPTERS.length} chapter pacing curves, seven goal migrations, ${games} games / ${moves} moves`);
