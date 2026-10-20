function createLayout(width, height, safeArea, menuButtonRect, mode = { rows: 9, cols: 9 }) {
  const safeTop = safeArea && typeof safeArea.top === 'number' ? safeArea.top : 0;
  const safeBottom = safeArea && typeof safeArea.bottom === 'number'
    ? Math.max(0, height - safeArea.bottom)
    : 0;
  const horizontalPadding = Math.max(20, width * 0.06);
  const settingsY = menuButtonRect && menuButtonRect.bottom ? menuButtonRect.bottom + 8 : safeTop + 58;
  const scoreY = settingsY + (height < 700 ? 72 : 82);
  // Keep the score/tools row and one goal card; compact screens give space back to cells.
  const baseBoardY = settingsY + (height < 700 ? 136 : 174);
  const heightLimitedSize = Math.max(144, height - safeBottom - baseBoardY - 138);
  const cellSize = Math.min((width - horizontalPadding * 2) / mode.cols,
    Math.min(height * 0.54, heightLimitedSize) / mode.rows);
  const boardWidth = cellSize * mode.cols;
  const boardHeight = cellSize * mode.rows;
  const traySlotWidth = (width - horizontalPadding * 2) / 3;
  const trayBlockSize = Math.min(24, traySlotWidth / 5);
  const boardY = baseBoardY;
  const boardX = (width - boardWidth) / 2;

  return {
    width,
    height,
    boardX,
    boardY,
    boardWidth,
    boardHeight,
    cellSize,
    scoreY,
    goalY: boardY - 48,
    energyY: boardY + boardHeight + 26,
    trayY: boardY + boardHeight + 84,
    traySlotWidth,
    trayBlockSize,
    // 托盘图形最高 84px：上下各 44px 覆盖图形并留 2px 容差，避开能量点。
    trayHitHalfHeight: 44,
    horizontalPadding,
    safeTop,
    safeBottom,
    settingsY
  };
}

module.exports = { createLayout };
