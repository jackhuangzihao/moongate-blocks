const assert = require('assert');
const rules = require('../js/rules/garden-rules');
const { createBoard, energyPalacePool } = require('../js/rules/board');
const { MODES } = require('../js/config');

// Overlapping regions must produce each playable cell once, in the same order.
const board = createBoard('easy');
board[0][0] = 2;
board[0][1] = -1;
const before = JSON.stringify(board);
const cells = rules.completedCells(board, { rows: [0], cols: [0], palaces: [[0,0]] });
assert.equal(cells.length, 19);
assert.deepStrictEqual(cells.slice(0,7), Array.from({length:7}, (_,i)=>[i+2,0]));
assert.equal(new Set(cells.map(p=>p.join(','))).size, cells.length);
assert.equal(JSON.stringify(board), before);
assert.equal(rules.boardOccupancy(board), 1/80);
assert.equal(rules.boardOccupancy([[-1,-1]]), 0);
assert.deepStrictEqual(rules.completedCells(board,{rows:[],cols:[],palaces:[]}), []);
assert.deepStrictEqual([0,1,2,3,4,5].map(rules.simultaneousClearScore), [0,10,40,80,115,150]);

for (const mode of Object.keys(MODES)) {
  const pool = energyPalacePool(mode);
  let calls = 0;
  const a = rules.createEnergyPalaces(mode, () => { calls++; return .25; });
  assert.equal(calls, Math.max(0,pool.length-1), mode+' random consumption');
  assert.equal(a.length, Math.min(3,pool.length));
  assert.equal(new Set(a).size,a.length);
  assert.ok(a.every(n=>pool.includes(n)));
  assert.deepStrictEqual(a,rules.createEnergyPalaces(mode,()=>.25));
  assert.deepStrictEqual(energyPalacePool(mode),pool);
}
console.log('PASS: garden calculations preserve overlap order, occupancy, scoring and random consumption');
