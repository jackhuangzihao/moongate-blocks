const { COLORS, MODES } = require('../config');
const challenges = require('../challenge/challenges');
const mechanicGuide = require('../progression/mechanic-guide');
const dragPlacement = require('./drag-placement');
const { roundedRect, text } = require('./canvas-ui');
const { drawTarget, drawFlower, drawKey, drawGate } = require('./board-symbols');

function nearbyEnergy(state) {
  if (state.challenge || state.gardenIntro || state.gameOver || !state.board) return null;
  const cols=state.board[0].length/3;
  let best=null;
  for (const index of state.energyPalaces || []) {
    const c=index%cols*3,r=Math.floor(index/cols)*3;
    let missing=0;
    for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(state.board[r+y][c+x]===0)missing++;
    if(missing>0 && missing<=3 && (!best || missing<best.missing))best={c,r,missing};
  }
  return best;
}

function drawBoard(ctx, layout, state) {
  const { boardX, boardY, boardWidth, boardHeight, cellSize } = layout;
  const rows = state.board.length;
  const cols = state.board[0].length;
  const palaceCols = cols / 3;
  const energyPalaces = state.energyPalaces || [];
  const clearingCells = state.clearingCells || [];
  // 数组索引查表代替 `${col},${row}` 字符串键：每帧少建 81 个字符串和一个对象。
  const clearing = [];
  for (let i = 0; i < clearingCells.length; i += 1) {
    clearing[clearingCells[i][1] * cols + clearingCells[i][0]] = true;
  }
  const isEnergyPalace = [];
  for (let i = 0; i < energyPalaces.length; i += 1) isEnergyPalace[energyPalaces[i]] = true;

  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.boardEdge;
  ctx.lineWidth = 1;
  if (MODES[state.mode].missing) {
    // 四角缺格的庭院沿轮廓外扩 7px，与普通底板共用 12px 圆角。
    // 缺角大小从棋盘第一行开头的留白数推出，改地图时轮廓自动跟随。
    let corner = 0;
    while (corner < cols && state.board[0][corner] === -1) corner += 1;
    const x = [boardX - 7, boardX + cellSize * corner - 7,
      boardX + cellSize * (cols - corner) + 7, boardX + boardWidth + 7];
    const y = [boardY - 7, boardY + cellSize * corner - 7,
      boardY + cellSize * (rows - corner) + 7, boardY + boardHeight + 7];
    const corners = [[1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [2, 2],
      [2, 3], [1, 3], [1, 2], [0, 2], [0, 1], [1, 1]];
    ctx.beginPath();
    ctx.moveTo(x[1], (y[0] + y[1]) / 2);
    corners.forEach(([col, row], index) => {
      const [nextCol, nextRow] = corners[(index + 1) % corners.length];
      ctx.arcTo(x[col], y[row], x[nextCol], y[nextRow], 12);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    roundedRect(ctx, boardX - 7, boardY - 7, boardWidth + 14, boardHeight + 14, 12);
    ctx.fill();
    ctx.stroke();
  }

  const gap = 2.5;
  const size = cellSize - gap * 2;
  const radius = Math.max(3, cellSize * 0.12);

  for (let row = 0; row < rows; row += 1) {
    const palaceRowBase = Math.floor(row / 3) * palaceCols;
    for (let col = 0; col < cols; col += 1) {
      const x = boardX + col * cellSize + gap;
      const y = boardY + row * cellSize + gap;
      const cellValue = state.board[row][col];
      if (cellValue === -1) continue;
      const emptyColor = isEnergyPalace[palaceRowBase + Math.floor(col / 3)]
        ? COLORS.energyEmptyCell
        : COLORS.emptyCell;
      // 石台整块画在下面；棋子要落在一个空格底上，所以棋子格照常铺空格色。
      if (cellValue === 2 && !state.challenge && MODES[state.mode].blockedStyle !== 'stone') continue;
      ctx.fillStyle = clearing[row * cols + col] || cellValue === 2 ? COLORS.emptyCell
        : (cellValue === 1 ? COLORS.block : emptyColor);
      roundedRect(ctx, x, y, size, size, radius);
      ctx.fill();
    }
  }
  drawBlocked(ctx, layout, state);
  if (state.challenge) {
    (state.challenge.flowers || []).forEach(([c,r,remaining])=>drawFlower(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,remaining));
    const area=challenges.level(state.challenge.level).area || [];
    if(area.length){
      ctx.save();ctx.strokeStyle=COLORS.primaryButton;ctx.lineWidth=1.5;ctx.setLineDash([3,2]);
      area.forEach(([c,r])=>{roundedRect(ctx,boardX+c*cellSize+2,boardY+r*cellSize+2,cellSize-4,cellSize-4,3);ctx.stroke();});
      ctx.restore();
    }
    state.challenge.stones.forEach(([c,r])=>{
      const x=boardX+c*cellSize+4,y=boardY+r*cellSize+4,size=cellSize-8;
      drawTarget(ctx,x,y,size);
    });
    state.challenge.ice.forEach(([c,r])=>{
      const x=boardX+c*cellSize+3,y=boardY+r*cellSize+3,size=cellSize-6;
      ctx.fillStyle='rgba(208,242,250,.7)';roundedRect(ctx,x,y,size,size,4);ctx.fill();
      ctx.strokeStyle='#326D91';ctx.lineWidth=1.3;roundedRect(ctx,x,y,size,size,4);ctx.stroke();
      // A snow crystal and border distinguish ice from ordinary blocks without color alone.
      ctx.beginPath();ctx.moveTo(x+size*.2,y+size*.5);ctx.lineTo(x+size*.8,y+size*.5);
      ctx.moveTo(x+size*.5,y+size*.2);ctx.lineTo(x+size*.5,y+size*.8);
      ctx.moveTo(x+size*.3,y+size*.3);ctx.lineTo(x+size*.7,y+size*.7);ctx.stroke();
      if (state.challenge.stones.some(([sx,sy])=>sx===c&&sy===r)) {
        const radius=Math.max(5,cellSize*.21);
        ctx.fillStyle='#F8FCFF';ctx.beginPath();ctx.arc(x+size/2,y+size/2,radius,0,Math.PI*2);ctx.fill();
        text(ctx,'2',x+size/2,y+size/2+radius*.65,Math.max(10,cellSize*.33),'#263E6A','center','700');
      }
    });
    for(const gate of state.challenge.gates || [])for(const [c,r] of gate.cells)
      drawGate(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,gate.id);
    for(const [c,r,id] of state.challenge.keys || [])
      drawKey(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,id,state.challenge.ice.some(p=>p[0]===c&&p[1]===r));
    if (state.challenge.level>=0 && state.challenge.level<3 && !state.piecesPlaced && !state.drag) {
      ctx.strokeStyle=COLORS.primaryButton;ctx.lineWidth=1.5;
      if(ctx.setLineDash)ctx.setLineDash([3,3]);
      challenges.level(state.challenge.level).holes.forEach(([c,r])=>{
        roundedRect(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,cellSize-6,3);ctx.stroke();
      });
      if(ctx.setLineDash)ctx.setLineDash([]);
    }
  }

  ctx.strokeStyle = COLORS.palaceLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (state.board[row][col] === -1) continue;
      const x = boardX + col * cellSize;
      const y = boardY + row * cellSize;
      if (col > 0 && col % 3 === 0 && state.board[row][col - 1] !== -1) {
        ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize);
      }
      if (row > 0 && row % 3 === 0 && state.board[row - 1][col] !== -1) {
        ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y);
      }
    }
  }
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.energy;
  ctx.font = `600 ${Math.max(14, cellSize * 0.5)}px sans-serif`;
  ctx.globalAlpha = 0.42;
  energyPalaces.forEach(palaceIndex => {
    const palaceCol = palaceIndex % palaceCols;
    const palaceRow = Math.floor(palaceIndex / palaceCols);
    if (state.board[palaceRow * 3 + 1][palaceCol * 3 + 1] !== 0) return;
    const centerX = boardX + (palaceCol * 3 + 1.5) * cellSize;
    const centerY = boardY + (palaceRow * 3 + 1.5) * cellSize;
    ctx.fillText('✦', centerX, centerY + cellSize * 0.17);
  });
  ctx.globalAlpha = 1;
  const near=nearbyEnergy(state);
  if(near){
    ctx.strokeStyle=COLORS.energyText;ctx.lineWidth=2;
    roundedRect(ctx,boardX+near.c*cellSize+1,boardY+near.r*cellSize+1,cellSize*3-2,cellSize*3-2,7);ctx.stroke();
  }
}

function drawBlocked(ctx, layout, state) {
  const { boardX, boardY, cellSize } = layout;
  const board = state.board;
  const gap = 2.5;
  const style = state.challenge ? 'stone' : MODES[state.mode].blockedStyle || 'slab';
  if (style === 'stone') {
    const radius = (cellSize - gap * 2) * 0.36;
    board.forEach((boardRow, row) => boardRow.forEach((value, col) => {
      if (value !== 2) return;
      if(state.challenge && ((state.challenge.flowers || []).some(([c,r])=>c===col && r===row)
        || (state.challenge.gates || []).some(gate=>gate.cells.some(([c,r])=>c===col&&r===row))))return;
      const cx = boardX + (col + 0.5) * cellSize;
      const cy = boardY + (row + 0.5) * cellSize;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = COLORS.text;
      ctx.beginPath();
      ctx.arc(cx, cy + 1.2, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const shade = ctx.createRadialGradient
        ? ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius)
        : null;
      if (shade && shade.addColorStop) {
        shade.addColorStop(0, COLORS.stoneLight);
        shade.addColorStop(1, COLORS.stone);
        ctx.fillStyle = shade;
      } else ctx.fillStyle = COLORS.stone;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }));
    return;
  }
  // 按四连通找出每一块禁区；整块是矩形就画成一整块石台，否则逐格画。
  const seen = board.map(r => r.map(() => false));
  board.forEach((boardRow, row) => boardRow.forEach((value, col) => {
    if (value !== 2 || seen[row][col]) return;
    const cells = [];
    const stack = [[row, col]];
    seen[row][col] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      cells.push([r, c]);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (board[nr] && board[nr][nc] === 2 && !seen[nr][nc]) {
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      });
    }
    const rs = cells.map(cell => cell[0]);
    const cs = cells.map(cell => cell[1]);
    const r0 = Math.min(...rs);
    const c0 = Math.min(...cs);
    const h = Math.max(...rs) - r0 + 1;
    const w = Math.max(...cs) - c0 + 1;
    const rects = cells.length === w * h ? [[r0, c0, w, h]] : cells.map(([r, c]) => [r, c, 1, 1]);
    rects.forEach(([r, c, rw, rh]) => {
      const x = boardX + c * cellSize + gap;
      const y = boardY + r * cellSize + gap;
      const width = rw * cellSize - gap * 2;
      const height = rh * cellSize - gap * 2;
      const corner = Math.max(4, cellSize * 0.16);
      ctx.fillStyle = COLORS.slab;
      roundedRect(ctx, x, y, width, height, corner);
      ctx.fill();
      // 一道浅色内边，让石台读作"一块完整的实物"，而不是一片灰色空格。
      if (width > 16 && height > 16) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = COLORS.panel;
        ctx.lineWidth = 1.5;
        roundedRect(ctx, x + 4, y + 4, width - 8, height - 8, Math.max(3, corner - 3));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }));
}

function drawClearAnimation(ctx, layout, state) {
  const cells = state.clearingCells;
  if (!cells || !cells.length) return;
  const progress = state.clearProgress || 0;
  if (progress >= 1) return;
  const { boardX, boardY, cellSize } = layout;
  const gap = 2.5;
  const size = cellSize - gap * 2;
  const shrink = progress * cellSize * 0.34;
  const radius = Math.max(3, cellSize * 0.12);
  // 场景层已经把这些格子画成空格底色，这里只叠加收缩淡出的金块。
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = COLORS.energy;
  for (let i = 0; i < cells.length; i += 1) {
    const x = boardX + cells[i][0] * cellSize + gap + shrink;
    const y = boardY + cells[i][1] * cellSize + gap + shrink;
    roundedRect(ctx, x, y, size - shrink * 2, size - shrink * 2, radius);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlacementPreview(ctx, layout, state) {
  if (!state.drag || !state.drag.target || !state.drag.valid) return;
  const { boardX, boardY, cellSize } = layout;
  const { shape, target } = state.drag;
  dragPlacement.drawLanding(ctx, layout,
    shape.cells.map(([dx, dy]) => [target.col + dx, target.row + dy]), COLORS.block);
  // Preview the cells removed by this placement; later gravity chains are resolved after release.
  dragPlacement.drawLanding(ctx, layout, state.drag.previewClearingCells || [], COLORS.clearGlow, 0.6);
  for (const [c,r] of state.drag.previewBreakingIce || []) drawIceCrack(ctx,layout,c,r);
  const preview=state.drag.challengePreview;
  if(preview){
    ctx.save();ctx.strokeStyle='#BE9144';ctx.lineWidth=2;
    for(const [c,r,left] of preview.wateredFlowers){
      drawFlower(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,left);
      ctx.strokeStyle='#BE9144';ctx.lineWidth=2;
      roundedRect(ctx,boardX+c*cellSize+1,boardY+r*cellSize+1,cellSize-2,cellSize-2,5);ctx.stroke();
    }
    ctx.setLineDash([3,2]);
    for(const [c,r] of preview.openedGates){
      ctx.fillStyle=COLORS.emptyCell;roundedRect(ctx,boardX+c*cellSize+3,boardY+r*cellSize+3,cellSize-6,cellSize-6,4);ctx.fill();ctx.stroke();
    }
    ctx.restore();
    const notes=[];
    if(preview.won)notes.push('将完成目标');
    else if(preview.progressGain>0)notes.push(`目标 +${preview.progressGain}`);
    else if(preview.progressGain<0)notes.push(`待清理多 ${-preview.progressGain} 格`);
    if(preview.openedGates.length)notes.push(`开启 ${[...new Set(preview.openedGates.map(p=>p[2]))].join('、')} 机关`);
    if(preview.bloomedFlowers.length)notes.push(`${preview.bloomedFlowers.length} 处开花`);
    if(preview.wateredFlowers.length>preview.bloomedFlowers.length)notes.push(`浇灌 ${preview.wateredFlowers.length-preview.bloomedFlowers.length} 处`);
    const x=layout.horizontalPadding,y=layout.boardY-60;
    ctx.fillStyle=COLORS.panel;ctx.fillRect(x+8,y+23,layout.width-2*x-16,17);
    ctx.font='600 11px sans-serif';ctx.fillStyle=COLORS.primaryButton;ctx.textAlign='left';
    ctx.fillText('落子预览 · '+(notes.join(' · ') || (preview.brokenIce.length?'薄冰破开 · 下方方块保留':'本步不增加目标进度')),x+13,y+35,layout.width-x*2-26);
  }
}

function drawIceCrack(ctx, layout, col, row, spread = 0) {
  const size = layout.cellSize, x = layout.boardX+(col+.5)*size, y = layout.boardY+(row+.5)*size;
  ctx.strokeStyle = COLORS.text; ctx.lineWidth = 1.6;
  ctx.beginPath();ctx.moveTo(x-3-spread,y-size*.3);ctx.lineTo(x+2+spread,y-1);
  ctx.lineTo(x-2-spread,y+3);ctx.lineTo(x+3+spread,y+size*.3);ctx.stroke();
}

function drawIceAnimation(ctx, layout, state) {
  const progress = state.clearProgress || 0;
  ctx.globalAlpha = 1-progress;
  for (const [c,r] of state.breakingIce || []) drawIceCrack(ctx,layout,c,r,progress*5);
  ctx.strokeStyle='#BE9144';ctx.lineWidth=2;
  for(const [c,r] of state.openingGates || []){
    const size=layout.cellSize;
    roundedRect(ctx,layout.boardX+c*size+2,layout.boardY+r*size+2,size-4,size-4,4);ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawDraggedShape(ctx, layout, state) {
  dragPlacement.drawHeld(ctx, layout.cellSize, state.drag, COLORS.block);
}

function drawMechanicGuide(ctx,layout,state) {
  const guide=state.mechanicGuide,{panel,skip}=mechanicGuide.rects(layout,guide,state.challenge);
  const p=guide.progress || 0,[c,r]=guide.cell,s=layout.cellSize;
  ctx.save();ctx.strokeStyle='#BE9144';ctx.lineWidth=2+Math.sin(p*Math.PI*4);
  roundedRect(ctx,layout.boardX+c*s+1,layout.boardY+r*s+1,s-2,s-2,5);ctx.stroke();
  if(guide.id==='flowers')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(c+dx<0||c+dx>8||r+dy<0||r+dy>8)continue;
    ctx.globalAlpha=.12+.1*Math.sin(p*Math.PI*4);ctx.fillStyle='#BE9144';
    roundedRect(ctx,layout.boardX+(c+dx)*s+2,layout.boardY+(r+dy)*s+2,s-4,s-4,4);ctx.fill();
  }
  ctx.globalAlpha=.97;ctx.fillStyle=COLORS.panel;roundedRect(ctx,panel.x,panel.y,panel.width,panel.height,14);ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle=COLORS.boardEdge;ctx.lineWidth=1;ctx.stroke();
  text(ctx,guide.title,panel.x+12,panel.y+23,13,COLORS.text,'left','600');
  text(ctx,'跳过',skip.x+skip.width/2,skip.y+25,12,COLORS.secondaryText);
  if(panel.height<90){
    text(ctx,guide.lines[0],panel.x+12,panel.y+40,11,COLORS.text,'left');
    if(panel.height>=62)text(ctx,guide.lines[1],panel.x+12,panel.y+56,11,COLORS.secondaryText,'left');
    ctx.restore();return;
  }
  const x=panel.x+16,y=panel.y+37,phase=Math.min(2,Math.floor(p*3));
  if(guide.id==='flowers')drawFlower(ctx,x,y,31,2-phase);
  else if(guide.id==='keys')drawKey(ctx,x,y,31,guide.cell[2]);
  else if(guide.id==='stones')drawTarget(ctx,x,y,31);
  else if(guide.id==='ice'){
    ctx.fillStyle=phase===0?'#D0F2FA':COLORS.block;roundedRect(ctx,x,y,31,31,5);ctx.fill();
    text(ctx,phase===0?'2':phase===1?'1':'✓',x+15,y+22,17,COLORS.text,'center','600');
  } else {
    ctx.strokeStyle=COLORS.primaryButton;ctx.setLineDash([3,2]);ctx.strokeRect(x,y,31,31);ctx.setLineDash([]);
    text(ctx,guide.id==='cross'?'+':'✓',x+15,y+22,18,COLORS.primaryButton,'center','600');
  }
  text(ctx,guide.lines[0],x+43,y+12,11,COLORS.text,'left');
  text(ctx,guide.lines[1],panel.x+12,panel.y+(panel.height<100?panel.height-8:80),11,COLORS.secondaryText,'left');
  ctx.restore();
}

function drawEnergy(ctx, layout, state) {
  if (state.challenge) {
    const next = challenges.nextTray(state.challenge);
    const labelX = layout.horizontalPadding;
    text(ctx, '下一组', labelX, layout.energyY+4, 11, COLORS.secondaryText, 'left');
    const width = layout.width - labelX*2 - 58;
    next.forEach((shape, i) => {
      if (!shape) return;
      const bounds = shapeBounds(shape), size = Math.min(8, 26 / bounds.height);
      const x = labelX + 58 + width*(i+.5)/3 - bounds.width*size/2;
      const y = layout.energyY - bounds.height*size/2;
      ctx.fillStyle = COLORS.secondaryText;
      shape.cells.forEach(([c,r]) => { roundedRect(ctx,x+c*size,y+r*size,size-1,size-1,1);ctx.fill(); });
    });
    if (!next.some(Boolean)) text(ctx, '本关最后一组', layout.width/2+24, layout.energyY+4, 11, COLORS.secondaryText);
    return;
  }
  if (state.luckyPendingCount > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.secondaryText;
    ctx.font = '600 13px sans-serif';
    const queued = state.luckyPendingCount > 1 ? ` · 待领 ${state.luckyPendingCount} 个` : '';
    ctx.fillText(`✦ 下一组获得幸运方块${queued}`, layout.width / 2, layout.energyY + 5);
    return;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.secondaryText;
  ctx.font = '600 13px sans-serif';
  ctx.fillText('✦ 能量', layout.width / 2 - 24, layout.energyY + 5);
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i += 1) {
    const cx = layout.width / 2 + i * 24 - 8;
    ctx.beginPath();
    if (i < state.energy) {
      ctx.arc(cx, layout.energyY, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.energy;
      ctx.fill();
    } else {
      // 未点亮画空心圈：亮 / 暗靠形状区分，全色盲下两者明度只差 7。
      ctx.arc(cx, layout.energyY, 5.25, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.energyRing;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function shapeBounds(shape) {
  return shape.cells.reduce((bounds, cell) => ({
    width: Math.max(bounds.width, cell[0] + 1),
    height: Math.max(bounds.height, cell[1] + 1)
  }), { width: 0, height: 0 });
}

function drawSuggestion(ctx, layout, state) {
  const move=state.suggestion || mechanicGuide.move(state.mechanicGuide,state.challenge),piece=move&&state.tray[move.slot];
  if(!piece || state.gameOver)return;
  ctx.save();ctx.strokeStyle=COLORS.primaryButton;ctx.lineWidth=2;ctx.setLineDash([4,3]);
  for(const [x,y] of piece.cells) {
    roundedRect(ctx,layout.boardX+(move.c+x)*layout.cellSize+2,layout.boardY+(move.r+y)*layout.cellSize+2,layout.cellSize-4,layout.cellSize-4,4);ctx.stroke();
  }
  const center=layout.horizontalPadding+layout.traySlotWidth*(move.slot+.5);
  roundedRect(ctx,center-layout.traySlotWidth/2+5,layout.trayY-38,layout.traySlotWidth-10,76,10);ctx.stroke();ctx.restore();
}

function drawTray(ctx, layout, state) {
  const blockSize = layout.trayBlockSize;
  const entrance = state.trayAppearProgress == null ? 1 : state.trayAppearProgress;
  const scale = 0.72 + entrance * 0.28;

  state.tray.forEach((shape, index) => {
    if (!shape || (state.drag && state.drag.trayIndex === index)) return;
    const centerX = layout.horizontalPadding + layout.traySlotWidth * (index + 0.5);
    const bounds = shapeBounds(shape);
    const scaledBlockSize = Math.min(blockSize * scale,
      (layout.traySlotWidth - 8) / bounds.width, 84 / bounds.height);
    const startX = centerX - bounds.width * scaledBlockSize / 2;
    const startY = layout.trayY - bounds.height * scaledBlockSize / 2;
    const unavailable = Boolean(state.unavailableTray && state.unavailableTray[index]);
    const highlighted = shape.lucky && state.luckyHighlightUntil > 0;

    // 不可放置状态保持接近实色；透明度过低会与米灰背景混合成禁区灰。
    ctx.globalAlpha = entrance * (unavailable ? 0.94 : 1);
    ctx.fillStyle = unavailable ? COLORS.alert : (highlighted ? COLORS.energy : COLORS.block);
    shape.cells.forEach(([x, y]) => {
      roundedRect(ctx, startX + x * scaledBlockSize + 1.5, startY + y * scaledBlockSize + 1.5,
        scaledBlockSize - 3, scaledBlockSize - 3, 4);
      ctx.fill();
    });
    if (highlighted) {
      ctx.textAlign = 'center';
      ctx.font = '600 12px sans-serif';
      ctx.fillStyle = COLORS.secondaryText;
      ctx.fillText('✦ 幸运', centerX, startY + bounds.height * scaledBlockSize + 16);
    }
    if (unavailable) {
      // 浅色斜线压在砖红上，比深红斜线更柔和，也更醒目。
      ctx.strokeStyle = COLORS.panel;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX + 2, startY + bounds.height * scaledBlockSize - 2);
      ctx.lineTo(startX + bounds.width * scaledBlockSize - 2, startY + 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

module.exports = { 
  nearbyEnergy,
  drawBoard,
  drawClearAnimation,
  drawPlacementPreview,
  drawIceAnimation,
  drawDraggedShape,
  drawMechanicGuide,
  drawEnergy,
  drawSuggestion,
  drawTray
 };
