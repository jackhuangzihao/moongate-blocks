// Transient presentation only: scores, targets and settled boards remain owned by the game.
const DURATION = 900;

function title(completed, combo = 1) {
  const count = completed.rows.length + completed.cols.length + completed.palaces.length;
  if (count > 1) return count === 2 ? '双重消除' : count === 3 ? '三重消除' : `${count}重消除`;
  if (combo > 1) return `连续消除 ${combo} 手`;
  return completed.rows.length ? '一行消除' : completed.cols.length ? '一列消除' : '九宫消除';
}

function create(gain, count, combo, start, label) {
  if (!Number.isSafeInteger(gain) || gain <= 0 || !Number.isFinite(start)) return null;
  return { gain, label, start, progress: 0, strong: count > 1 || combo > 1 };
}

function advance(effect, now) {
  effect.progress = Math.min(1, Math.max(0, (now - effect.start) / DURATION));
  return effect.progress < 1;
}

function gainWidth(effect) {
  return Math.min(116, 36 + String(effect.gain).length * 12);
}

function drawValue(ctx, value, x, y, size, color, effect, maxWidth) {
  const age = effect ? effect.progress * DURATION : DURATION;
  const scale = 1 + (age < 240 ? Math.sin(age / 240 * Math.PI) * .07 : 0);
  ctx.save();ctx.translate(x, y);ctx.scale(scale, scale);
  ctx.font = `600 ${size}px sans-serif`;ctx.fillStyle = color;ctx.textAlign = 'left';
  if (maxWidth) ctx.fillText(String(value), 0, 0, maxWidth / scale);
  else ctx.fillText(String(value), 0, 0);
  ctx.restore();
}

function drawGain(ctx, effect, x, y, color, prefix = '') {
  const age = effect.progress * DURATION;
  const scale = 1 + (effect.strong ? .12 : .08) * Math.exp(-age / 180);
  ctx.save();ctx.translate(x, y);ctx.scale(scale, scale);
  ctx.globalAlpha = Math.min(1, (1 - effect.progress) / .25);
  ctx.font = `600 ${effect.strong ? 20 : 17}px sans-serif`;
  ctx.fillStyle = color;ctx.textAlign = 'right';
  ctx.fillText(`${prefix}+${effect.gain}`, 0, 0, (gainWidth(effect) + (prefix ? 36 : 0)) / scale);
  ctx.restore();
}

module.exports = { create, advance, title, gainWidth, drawValue, drawGain };
