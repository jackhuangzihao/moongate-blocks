const assert=require('assert');
const C=require('../js/challenge/challenges'),B=require('../js/rules/board'),T=require('../js/rules/tools');
const copy=value=>JSON.parse(JSON.stringify(value));
const fifth=C.LEVELS.slice(48,60);
assert.equal(C.CHAPTERS.length,5);assert.equal(fifth.length,12);
const legacy=C.load({getStorageSync:()=>({version:1,stars:Array(48).fill(3),runs:Array(4).fill(null)})});
assert.deepStrictEqual(legacy.stars,[...Array(48).fill(3),...Array(C.LEVELS.length-48).fill(0)]);
assert.equal(legacy.runs.length,5);assert.ok(C.isUnlocked(legacy,48));assert.ok(!C.isUnlocked(legacy,49));

let previews=0,opened=0,reordered=0,shortcuts=0;
for(const level of fifth) {
  const source=JSON.stringify(level),run=C.start(level.id),usedDoors=new Set(),openedDoors=new Set();
  assert.ok(level.keys.length>=1 && level.keys.length<=3);
  assert.equal(new Set(level.keys.map(p=>p[2])).size,level.keys.length,'Lettered keys are unique');
  assert.equal(level.keys.length,level.gates.length);
  for(const key of level.keys) {
    assert.equal(run.board[key[1]][key[0]],1);
    assert.ok(level.gates.some(gate=>gate.id===key[2]));
  }
  for(const gate of level.gates)for(const [c,r] of gate.cells) {
    assert.equal(run.board[r][c],2);
    assert.ok(!level.blocked.some(([x,y])=>x===c&&y===r),'An opening is never a permanent obstacle');
  }
  // A locked room must not offer an accidental one/two-piece shortcut by
  // treating its closed doors as filled squares in a crossing row or column.
  for(let slot=0;slot<3;slot++)for(let y=0;y<9;y++)for(let x=0;x<9;x++) {
    if(!B.canPlace(run.board,run.tray[slot],x,y))continue;
    const first=copy(run);C.play(first,slot,x,y);assert.equal(first.won,false);
    for(let next=0;next<3;next++)if(first.tray[next])for(let r=0;r<9;r++)for(let c=0;c<9;c++) {
      if(!B.canPlace(first.board,first.tray[next],c,r))continue;
      const second=copy(first);C.play(second,next,c,r);shortcuts++;
      assert.equal(second.won,false,level.title+' requires at least three placements');
    }
  }
  for(const move of level.solution) {
    const before=copy(run),preview=C.preview(run,...move);
    assert.deepStrictEqual(run,before,'Hovering must not change the run');
    assert.ok(preview);
    const [slot,c,r]=move;
    for(const [x,y] of run.tray[slot].cells)if(openedDoors.has(`${c+x},${r+y}`))usedDoors.add(`${c+x},${r+y}`);
    const result=C.play(run,...move);
    for(const key of Object.keys(result))assert.deepStrictEqual(result[key],preview[key],'Preview and move use one engine');
    assert.equal(preview.progressGain,run.progress-before.progress);assert.equal(preview.won,run.won);
    assert.deepStrictEqual(preview.bloomedFlowers,result.wateredFlowers.filter(p=>p[2]===0));
    for(const [x,y,id] of result.openedGates) {
      assert.equal(before.board[y][x],2);assert.equal(run.board[y][x],0);
      assert.ok(result.collectedKeys.some(key=>key[2]===id));
      assert.ok(!result.cells.some(([c,r])=>c===x&&r===y),'An opened cell does not clear on the opening move');
      assert.ok(!run.gates.some(gate=>gate.id===id));
      openedDoors.add(`${x},${y}`);opened++;
    }
    for(const [x,y] of run.keys)assert.equal(run.board[y][x],1);
    for(const gate of run.gates)for(const [x,y] of gate.cells)assert.equal(run.board[y][x],2);
    if(!run.won)assert.deepStrictEqual(C.undo(run),before,'Undo restores closed gates, keys and frozen layers');
    if(!run.ended)assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);
    previews++;
  }
  assert.ok(run.won,level.title);assert.equal(C.stars(run),3);assert.equal(run.keys.length,0);
  assert.ok(usedDoors.size>=level.gates.length,'The route must actually use the newly opened space');
  assert.equal(JSON.stringify(level),source,'Neither a preview nor a move mutates level definitions');
  const hint=T.winningPath(C.start(level.id),{maxMs:1000});assert.ok(hint,'Authored route is a verified hint');
  const hinted=C.start(level.id);hint.forEach(move=>assert.ok(C.play(hinted,...move)));assert.ok(hinted.won);
  let sensitive=false;
  for(let a=0;a<level.solution.length&&!sensitive;a++)for(let b=a+1;b<Math.min(level.solution.length,(Math.floor(a/3)+1)*3);b++) {
    const plan=copy(level.solution);[plan[a],plan[b]]=[plan[b],plan[a]];
    const alternate=C.start(level.id);
    for(const move of plan)if(!C.play(alternate,...move))break;
    if(!alternate.won){sensitive=true;break;}
  }
  if(sensitive)reordered++;
}
assert.ok(reordered>=8,'Most routes depend on the placement order inside the same hand');

// Frost protects the key itself. The first clear only breaks its ice; only the
// second removal collects it, and undo/replay must close its door again.
const frost=C.start(53),frostLevel=C.LEVELS[53],firstKey=frost.keys[0];
frostLevel.solution.slice(0,2).forEach(move=>C.play(frost,...move));
assert.ok(!frost.ice.some(([c,r])=>c===firstKey[0]&&r===firstKey[1]));
assert.equal(frost.keys.length,1);assert.equal(frost.gates.length,1);
assert.equal(frost.board[firstKey[1]][firstKey[0]],1);
frostLevel.solution.slice(2,3).forEach(move=>C.play(frost,...move));
const beforeOpening=copy(frost),opening=C.play(frost,...frostLevel.solution[3]);
assert.deepStrictEqual(opening.collectedKeys,[firstKey]);assert.equal(frost.keys.length,0);
assert.deepStrictEqual(C.undo(frost),beforeOpening);
assert.equal(C.preview(frost,0,-1,-1),null);
assert.equal(C.preview(null,0,0,0),null);

// Permanent stones may complete a line, but closed doors must not. Without this
// distinction these two chain puzzles could finish before collecting any key.
for(const [id,move] of [[51,[1,3,3]],[57,[0,3,3]]]) {
  const locked=C.start(id),before=copy(locked),preview=C.preview(locked,...move);
  assert.deepStrictEqual(locked,before);assert.equal(preview.count,0);
  const result=C.play(locked,...move);
  assert.equal(result.count,0);assert.equal(locked.progress,0);assert.equal(locked.won,false);
  assert.deepStrictEqual(locked.keys,before.keys);assert.deepStrictEqual(locked.gates,before.gates);
}

console.log(`PASS: fifth chapter, ${previews} exact immutable previews, ${opened} gate-cell openings, ${reordered} order-sensitive routes, ${shortcuts} two-move shortcut checks, ice keys, undo/relaunch and verified hints`);
