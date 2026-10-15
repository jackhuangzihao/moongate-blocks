const { roundedRect } = require('./canvas-ui');

// Both game modes use the same lift, center anchor and grid snapping.
function position(point, bounds, layout) {
  const { cellSize, boardX, boardY, boardWidth, boardHeight } = layout;
  const x = point.x, y = point.y - Math.min(86, cellSize * 2.2);
  const left = x - bounds.width * cellSize / 2, top = y - bounds.height * cellSize / 2;
  const col = Math.round((left - boardX) / cellSize), row = Math.round((top - boardY) / cellSize);
  const nearBoard = left > boardX - cellSize && top > boardY - cellSize
    && left < boardX + boardWidth && top < boardY + boardHeight;
  return { x, y, target: nearBoard ? { col, row } : null };
}

function drawLanding(ctx, layout, cells, color, alpha = 0.8) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const [col, row] of cells) {
    roundedRect(ctx, layout.boardX + col * layout.cellSize + 2.5,
      layout.boardY + row * layout.cellSize + 2.5, layout.cellSize - 5, layout.cellSize - 5, 5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeld(ctx, cellSize, drag, color) {
  if (!drag) return;
  const left = drag.x - drag.bounds.width * cellSize / 2;
  const top = drag.y - drag.bounds.height * cellSize / 2;
  // The held piece stays solid even outside the board or over an invalid landing.
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = color;
  for (const [col, row] of drag.shape.cells) {
    roundedRect(ctx, left + col * cellSize + 2.5, top + row * cellSize + 2.5,
      cellSize - 5, cellSize - 5, 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

module.exports = { position, drawLanding, drawHeld };
