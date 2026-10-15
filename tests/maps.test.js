const assert = require('assert');
const { MODES, MODE_ORDER } = require('../js/config');
const { createBoard, canPlace, placeShape, findCompletedRegions, clearCompletedRegions, hasAnyPlacement } = require('../js/rules/board');
const { SHAPES } = require('../js/rules/shapes');
const { createLayout } = require('../js/views/layout');
const { getMenuActions, getSettingsButton, getGravityEntry } = require('../js/renderer');
const dot = SHAPES.find(shape => shape.id === 'dot');
const expected = { easy: [81, 9], medium: [72, 8], hard: [76, 4], long: [54, 6], courtyard: [77, 5] };
for (const id of MODE_ORDER) {
  const mode = MODES[id];
  const board = createBoard(id);
  assert.strictEqual(board.length, mode.rows);
  assert.ok(board.every(row => row.length === mode.cols));
  assert.strictEqual(board.flat().filter(cell => cell === 0).length, expected[id][0]);
  assert.deepStrictEqual(findCompletedRegions(board), { rows: [], cols: [], palaces: [] });
  for (const [row, col] of mode.blocked.concat(mode.missing || [])) {
    assert.ok(!canPlace(board, dot, col, row));
  }
  assert.ok(!canPlace(board, dot, mode.cols, 0));
  assert.ok(!canPlace(board, dot, 0, mode.rows));
  assert.ok(!canPlace(board, dot, -1, 0));
  assert.ok(SHAPES.every(shape => hasAnyPlacement(board, shape)), id);
  const full = board.map(row => row.map(cell => cell === 0 ? 1 : cell));
  const completed = findCompletedRegions(full);
  assert.strictEqual(completed.rows.length, mode.rows);
  assert.strictEqual(completed.cols.length, mode.cols);
  assert.strictEqual(completed.palaces.length, expected[id][1]);
  clearCompletedRegions(full, completed);
  assert.deepStrictEqual(full, board); // Neither missing cells nor blocked cells may become playable.
  for (const [width, height, top, bottom] of [[320, 568, 20, 548], [375, 812, 44, 778], [390, 844, 47, 810], [430, 932, 47, 898]]) {
    const layout = createLayout(width, height, { top, bottom }, { bottom: top + 36 }, mode);
    assert.ok(layout.boardX >= 0);
    assert.ok(layout.boardX + layout.boardWidth <= width);
    assert.ok(Math.abs(layout.boardWidth / layout.boardHeight - mode.cols / mode.rows) < 1e-10);
    assert.ok(layout.trayY + layout.trayHitHalfHeight < bottom);
    assert.ok(layout.trayY - layout.trayHitHalfHeight > layout.energyY + 6);
    assert.ok(layout.trayHitHalfHeight >= 42);
    const cards = Object.values(getMenuActions(layout));
    assert.ok(cards[0].y >= getSettingsButton(layout).y + 48);
    const gravity = getGravityEntry(layout);
    assert.ok(gravity.height >= 44 && gravity.y + gravity.height <= bottom);
    assert.equal(gravity.width, cards[0].width);
    assert.equal(gravity.height, cards[0].height);
    assert.ok(cards.at(-1).y + cards.at(-1).height + 8 <= gravity.y);
    cards.forEach((card, index) => {
      assert.ok(card.height >= 54, `${width}: card too short`);
      assert.ok(card.y + card.height <= bottom);
      if (index) assert.ok(card.y > cards[index - 1].y + cards[index - 1].height);
    });
  }
}
const long = createBoard('long');
placeShape(long, SHAPES.find(s => s.id === 'line5H'), 0, 8);
assert.deepStrictEqual(findCompletedRegions(long).rows, []);
placeShape(long, dot, 5, 8);
assert.deepStrictEqual(findCompletedRegions(long).rows, [8]);

// 庭院四角各缺 1 格：边行、边列各 7 格，填满即按普通行列消除，缺角保持留白。
for (const vertical of [false, true]) {
  const edge = createBoard('courtyard');
  for (let i = 1; i < 8; i++) {
    assert.deepStrictEqual(findCompletedRegions(edge)[vertical ? 'cols' : 'rows'], []);
    placeShape(edge, dot, vertical ? 0 : i, vertical ? i : 0);
  }
  const done = findCompletedRegions(edge);
  assert.deepStrictEqual(done[vertical ? 'cols' : 'rows'], [0]);
  clearCompletedRegions(edge, done);
  assert.deepStrictEqual(edge, createBoard('courtyard'));
}
// 四个角宫各含一个留白格，永远凑不满；中间五宫可以正常消除。
const courtyard = createBoard('courtyard');
for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
  if (courtyard[row][col] === 0) placeShape(courtyard, dot, col, row);
}
assert.deepStrictEqual(findCompletedRegions(courtyard).palaces, []);
for (let row = 0; row < 3; row++) for (let col = 3; col < 6; col++) placeShape(courtyard, dot, col, row);
assert.deepStrictEqual(findCompletedRegions(courtyard).palaces, [[1, 0]]);
clearCompletedRegions(courtyard, findCompletedRegions(courtyard));
assert.strictEqual(courtyard[0][0], -1);
assert.strictEqual(courtyard[0][3], 0);
// 底板轮廓必须跟随棋盘缺角：可放格全部在轮廓内，缺角格全部在轮廓外。
const { renderScene } = require('../js/renderer');
function outlineOf(board, layout) {
  const points = [];
  let done = false;
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'arcTo') return (x, y) => { if (!done) points.push([x, y]); };
      if (key === 'fill') return () => { if (points.length) done = true; };
      return key in target ? target[key] : () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  renderScene(ctx, layout, { screen: 'playing', mode: 'courtyard', board, score: 0, best: 0,
    tray: [null, null, null], energyPalaces: [], clearingCells: [], energy: 0 });
  return points;
}
function inside([px, py], polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
for (const corner of [1, 2]) {
  const board = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) =>
    ((r < corner || r >= 9 - corner) && (c < corner || c >= 9 - corner)) ? -1 : 0));
  const layout = createLayout(390, 844, { top: 47, bottom: 810 }, { bottom: 83 }, MODES.courtyard);
  const polygon = outlineOf(board, layout);
  assert.strictEqual(polygon.length, 12, `corner ${corner}: outline vertices`);
  const { boardX, boardY, cellSize } = layout;
  board.forEach((row, r) => row.forEach((value, c) => {
    const x = boardX + c * cellSize, y = boardY + r * cellSize, g = 3;
    if (value === -1) {
      assert.ok(!inside([x + cellSize / 2, y + cellSize / 2], polygon), `corner ${corner}: gap ${r},${c} covered`);
    } else {
      for (const p of [[x + g, y + g], [x + cellSize - g, y + g], [x + g, y + cellSize - g], [x + cellSize - g, y + cellSize - g]]) {
        assert.ok(inside(p, polygon), `corner ${corner}: cell ${r},${c} outside outline`);
      }
    }
  }));
}
assert.deepStrictEqual(findCompletedRegions(Array.from({ length: 9 }, () => Array(9).fill(-1))),
  { rows: [], cols: [], palaces: [] });
console.log('Map rules and layout checks passed');
