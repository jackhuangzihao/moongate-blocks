const { energyPalacePool } = require('./board');

// Calculations only: callers own the state, random sequence and save timing.
function createEnergyPalaces(mode, random = Math.random) {
  const pool = energyPalacePool(mode);
  if (!pool.length) return [];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, Math.min(3, pool.length));
}

function completedCells(board, completed) {
  const seen = [];
  const cells = [];
  function addCell(col, row) {
    const key = row * board[0].length + col;
    if (seen[key] || board[row][col] === 2 || board[row][col] === -1) return;
    seen[key] = true;
    cells.push([col, row]);
  }
  completed.rows.forEach(row => {
    for (let col = 0; col < board[row].length; col += 1) addCell(col, row);
  });
  completed.cols.forEach(col => {
    for (let row = 0; row < board.length; row += 1) addCell(col, row);
  });
  completed.palaces.forEach(([palaceCol, palaceRow]) => {
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        addCell(palaceCol * 3 + dx, palaceRow * 3 + dy);
      }
    }
  });
  return cells;
}

function boardOccupancy(board) {
  let filled = 0;
  let total = 0;
  board.forEach(row => row.forEach(value => {
    if (value === -1) return;
    total += 1;
    if (value !== 0) filled += 1;
  }));
  return total ? filled / total : 0;
}

function simultaneousClearScore(regionCount) {
  if (regionCount <= 0) return 0;
  if (regionCount === 1) return 10;
  if (regionCount === 2) return 40;
  if (regionCount === 3) return 80;
  return 80 + (regionCount - 3) * 35;
}

module.exports = { createEnergyPalaces, completedCells, boardOccupancy, simultaneousClearScore };
