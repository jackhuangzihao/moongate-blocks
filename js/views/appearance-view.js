const { COLORS } = require('../config');
const appearance = require('../progression/appearance');
const themes = require('./themes');
const { roundedRect, text, button, pressedRect } = require('./canvas-ui');

function getAppearanceActions(layout) {
  const width = Math.min(342, layout.width - 32);
  const height = Math.min(504, layout.height - layout.safeTop - layout.safeBottom - 16);
  const x = (layout.width - width) / 2;
  const y = layout.safeTop + (layout.height - layout.safeTop - layout.safeBottom - height) / 2;
  const rows = {};
  appearance.SKINS.forEach((skin, i) => { rows[skin.id] = { x: x + 16, y: y + 62 + i * 104,
    width: width - 32, height: 94 }; });
  return { panel: { x, y, width, height }, rows,
    close: { x: x + width - 56, y: y + 6, width: 48, height: 48 },
    use: { x: x + 16, y: y + height - 68, width: width - 32, height: 48 } };
}

// A miniature board previews the real palette without modifying the current run.
function drawMiniBoard(ctx, box, id) {
  const p = themes.palette(id), size = 58, cell = size / 3, x = box.x + 14, y = box.y + 17;
  ctx.fillStyle = p.background; roundedRect(ctx, x - 5, y - 5, size + 10, size + 10, 10); ctx.fill();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    ctx.fillStyle = (r === 1 || c === 0) ? p.block : p.emptyCell;
    roundedRect(ctx, x + c * cell + 1, y + r * cell + 1, cell - 2, cell - 2, 3); ctx.fill();
  }
  ctx.strokeStyle = p.palaceLine; ctx.lineWidth = 1;
  roundedRect(ctx, x - 2, y - 2, size + 4, size + 4, 5); ctx.stroke();
}

function drawAppearance(ctx, layout, state) {
  if (!state.appearancePreview) return;
  const a = getAppearanceActions(layout), { x, y, width, height } = a.panel;
  ctx.fillStyle = 'rgba(15,24,32,.68)'; ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = COLORS.panel; roundedRect(ctx, x, y, width, height, 22); ctx.fill();
  text(ctx, '外观', layout.width / 2, y + 38, 21, COLORS.text, 'center', '600');
  text(ctx, '×', a.close.x + 24, a.close.y + 32, 22, COLORS.secondaryText);
  const completed = Math.min(3, appearance.completedLevels(state.challengeProgress));
  for (const skin of appearance.SKINS) {
    const box = pressedRect(state, 'appearance-' + skin.id, a.rows[skin.id]);
    const selected = state.appearancePreview === skin.id, available = appearance.unlocked(skin.id, state.appearance);
    ctx.fillStyle = selected ? COLORS.traySelected : COLORS.trayBackground;
    roundedRect(ctx, box.x, box.y, box.width, box.height, 14); ctx.fill();
    if (selected) { ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5; ctx.stroke(); }
    drawMiniBoard(ctx, box, skin.id);
    const xx = box.x + 91;
    text(ctx, skin.name, xx, box.y + 29, 16, COLORS.text, 'left', '600');
    text(ctx, skin.detail, xx, box.y + 51, 11, COLORS.secondaryText, 'left');
    const note = !available ? `通关解锁 · ${completed}/3 关`
      : state.appearance.selected === skin.id ? '正在使用' : selected ? '预览中 · 点下方使用' : '点击预览';
    text(ctx, note, xx, box.y + 74, 10, available ? COLORS.accent : COLORS.secondaryText, 'left');
  }
  text(ctx, '仅改变外观，不影响玩法和成绩', layout.width / 2, y + height - 88, 11, COLORS.secondaryText);
  const available = appearance.unlocked(state.appearancePreview, state.appearance);
  button(ctx, a.use, available ? state.appearance.selected === state.appearancePreview ? '保留当前外观' : '使用此外观'
    : `通关 ${3 - completed} 个不同关卡后可用`, available, state, 'appearance-use', 14);
}

module.exports = { getAppearanceActions, drawAppearance };
