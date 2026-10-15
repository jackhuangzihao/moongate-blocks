// 第一批只使用容易识别、无需旋转的基础图形。
const SHAPES = [
  { id: 'dot', cells: [[0, 0]], weight: 10 },
  { id: 'line2H', cells: [[0, 0], [1, 0]], weight: 10 },
  { id: 'line2V', cells: [[0, 0], [0, 1]], weight: 10 },
  { id: 'line3H', cells: [[0, 0], [1, 0], [2, 0]], weight: 9 },
  { id: 'line3V', cells: [[0, 0], [0, 1], [0, 2]], weight: 9 },
  { id: 'square2', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], weight: 8 },
  { id: 'corner3A', cells: [[0, 0], [0, 1], [1, 1]], weight: 8 },
  { id: 'corner3B', cells: [[0, 0], [1, 0], [0, 1]], weight: 8 },
  { id: 'corner3C', cells: [[0, 0], [1, 0], [1, 1]], weight: 8 },
  { id: 'corner3D', cells: [[1, 0], [0, 1], [1, 1]], weight: 8 },
  { id: 'line4H', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 5 },
  { id: 'line4V', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 5 },
  // T 形补齐四个朝向。方向变化比单纯增大面积更考验空间观察，
  // 同时每块只有 4 格，不会像完整 3×3 那样在中后期频繁成为死牌。
  { id: 'tee4Down', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], weight: 2 },
  { id: 'tee4Up', cells: [[1, 0], [0, 1], [1, 1], [2, 1]], weight: 2 },
  { id: 'tee4Right', cells: [[0, 0], [0, 1], [1, 1], [0, 2]], weight: 2 },
  { id: 'tee4Left', cells: [[1, 0], [0, 1], [1, 1], [1, 2]], weight: 2 },
  // S/Z 折线加入镜像与纵向版本，轮廓有变化但仍保持易读。
  { id: 'zig4H', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], weight: 2 },
  { id: 'zag4H', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], weight: 2 },
  { id: 'zig4V', cells: [[1, 0], [0, 1], [1, 1], [0, 2]], weight: 2 },
  { id: 'zag4V', cells: [[0, 0], [0, 1], [1, 1], [1, 2]], weight: 2 },
  { id: 'line5H', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 3 },
  { id: 'line5V', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 3 },
  { id: 'corner5A', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], weight: 3 },
  { id: 'corner5B', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], weight: 3 },
  { id: 'corner5C', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], weight: 3 },
  { id: 'corner5D', cells: [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]], weight: 3 },
  { id: 'plus5', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], weight: 2 },
  { id: 'rect6H', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], weight: 2 },
  { id: 'rect6V', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], weight: 2 }
];

function adjustedWeight(shape, occupancy, recentIds) {
  let weight = shape.weight;
  const size = shape.cells.length;

  if (occupancy < 0.25) {
    if (size === 1) weight *= 0.45;
    if (size >= 4) weight *= 1.3;
  } else if (occupancy > 0.68) {
    if (size <= 3) weight *= 1.65;
    if (size >= 6) weight *= 0.38;
  } else if (occupancy > 0.5) {
    if (size <= 3) weight *= 1.2;
    if (size >= 6) weight *= 0.72;
  }

  if (recentIds.indexOf(shape.id) >= 0) weight *= 0.35;
  return weight;
}

function randomShape(options) {
  const occupancy = options.occupancy || 0;
  const recentIds = options.recentIds || [];
  const candidates = options.candidates || SHAPES;
  const weighted = candidates.map(shape => ({
    shape,
    weight: adjustedWeight(shape, occupancy, recentIds)
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = (options.random || Math.random)() * total;

  for (let i = 0; i < weighted.length; i += 1) {
    roll -= weighted[i].weight;
    if (roll <= 0) return weighted[i].shape;
  }

  return weighted[0].shape;
}

function randomLuckyShape(random) {
  const lucky = SHAPES.filter(shape => shape.cells.length <= 2);
  return lucky[Math.floor(random() * lucky.length)];
}

function createTray(options) {
  const normalized = typeof options === 'boolean' ? { includeLucky: options } : (options || {});
  const random = normalized.random || Math.random;
  const occupancy = normalized.occupancy || 0;
  const recentIds = (normalized.recentIds || []).slice(-6);
  const tray = [];

  for (let index = 0; index < 3; index += 1) {
    const localRecent = recentIds.concat(tray.map(shape => shape.id));
    tray.push(randomShape({ occupancy, recentIds: localRecent, random }));
  }

  let luckySlot = -1;
  if (normalized.includeLucky) {
    luckySlot = Math.floor(random() * tray.length);
    tray[luckySlot] = { ...randomLuckyShape(random), lucky: true };
  }

  if (normalized.canUseShape && !tray.some(normalized.canUseShape)) {
    const usableShapes = SHAPES.filter(normalized.canUseShape);
    if (usableShapes.length > 0) {
      const replaceableSlots = [0, 1, 2].filter(index => index !== luckySlot);
      const slot = replaceableSlots[Math.floor(random() * replaceableSlots.length)];
      tray[slot] = randomShape({ occupancy, recentIds, candidates: usableShapes, random });
      if (normalized.onSafetyUsed) normalized.onSafetyUsed();
    }
  }
  return tray;
}

module.exports = { SHAPES, createTray };
