const { hasAnyPlacement } = require('./board');

function enabled(state) {
  return state.mode === 'easy' && !state.challenge && !state.basics && !state.gardenIntro;
}

function signature(cells) {
  return cells.map(([col, row]) => `${col},${row}`).sort().join(';');
}

function turn(shape, original = shape) {
  const lastRow = Math.max(...shape.cells.map(([, row]) => row));
  const cells = shape.cells.map(([col, row]) => [lastRow - row, col]);
  const rotated = signature(cells);
  if (rotated === signature(shape.cells)) return shape;
  if (rotated === signature(original.cells)) return original;
  return { ...shape, cells };
}

function canRescue(board, tray) {
  return tray.some(original => {
    if (!original) return false;
    let shape = original;
    for (let i = 0; i < 3; i += 1) {
      shape = turn(shape, original);
      if (shape === original) break;
      if (hasAnyPlacement(board, shape)) return true;
    }
    return false;
  });
}

module.exports = { enabled, turn, canRescue };
