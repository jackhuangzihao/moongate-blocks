const { MODES } = require('../config');

// -1 是地图外留白，2 是棋盘内永久禁区；两者都不能落子或被消除。
function createBoard(modeId) {
  const mode = MODES[modeId];
  const board = Array.from({ length: mode.rows }, () => Array(mode.cols).fill(0));
  mode.blocked.forEach(([row, col]) => { board[row][col] = 2; });
  (mode.missing || []).forEach(([row, col]) => { board[row][col] = -1; });
  return board;
}

// Shared by target selection and save validation; maps may have fewer than three full palaces.
function energyPalacePool(modeId) {
  const board = createBoard(modeId), cols = board[0].length / 3, pool = [];
  for (let r = 0; r < Math.floor(board.length / 3); r++) {
    for (let c = 0; c < Math.floor(cols); c++) {
      let valid = true;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        if (board[r * 3 + y][c * 3 + x] !== 0) valid = false;
      }
      if (valid) pool.push(r * cols + c);
    }
  }
  return pool;
}

function canPlace(board, shape, originCol, originRow) {
  return shape.cells.every(([dx, dy]) => {
    const col = originCol + dx;
    const row = originRow + dy;
    return row >= 0 && row < board.length
      && col >= 0 && col < board[row].length
      && board[row][col] === 0;
  });
}

function placeShape(board, shape, originCol, originRow) {
  shape.cells.forEach(([dx, dy]) => {
    board[originRow + dy][originCol + dx] = 1;
  });
}

function findCompletedRegions(board) {
  const rows = [];
  const cols = [];
  const palaces = [];

  for (let row = 0; row < board.length; row += 1) {
    // 至少含一个真实方块：全是留白 / 禁区的行不能凭空"填满"。
    if (board[row].some(cell => cell === 1) && board[row].every(cell => cell !== 0)) rows.push(row);
  }

  for (let col = 0; col < board[0].length; col += 1) {
    let full = true;
    let occupied = false;
    for (let row = 0; row < board.length; row += 1) {
      if (board[row][col] === 0) full = false;
      if (board[row][col] === 1) occupied = true;
    }
    if (full && occupied) cols.push(col);
  }

  for (let palaceRow = 0; palaceRow < Math.floor(board.length / 3); palaceRow += 1) {
    for (let palaceCol = 0; palaceCol < Math.floor(board[0].length / 3); palaceCol += 1) {
      let full = true;
      for (let dy = 0; dy < 3; dy += 1) {
        for (let dx = 0; dx < 3; dx += 1) {
          if (board[palaceRow * 3 + dy][palaceCol * 3 + dx] !== 1) full = false;
        }
      }
      if (full) palaces.push([palaceCol, palaceRow]);
    }
  }

  return { rows, cols, palaces };
}

function clearCompletedRegions(board, completed) {
  completed.rows.forEach(row => {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === 1) board[row][col] = 0;
    }
  });
  completed.cols.forEach(col => {
    for (let row = 0; row < board.length; row += 1) {
      if (board[row][col] === 1) board[row][col] = 0;
    }
  });
  completed.palaces.forEach(([palaceCol, palaceRow]) => {
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        const row = palaceRow * 3 + dy;
        const col = palaceCol * 3 + dx;
        if (board[row][col] === 1) board[row][col] = 0;
      }
    }
  });
}

function hasAnyPlacement(board, shape) {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (canPlace(board, shape, col, row)) return true;
    }
  }
  return false;
}

module.exports = {
  createBoard,
  energyPalacePool,
  canPlace,
  placeShape,
  findCompletedRegions,
  clearCompletedRegions,
  hasAnyPlacement
};
