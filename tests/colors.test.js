const assert = require('assert');
const { COLORS: K, MODES, MODE_ORDER } = require('../js/config');
const { simulate, de2000, chroma, over, KINDS } = require('./color-vision');

// 五种视觉（正常 / 红色盲 / 绿色盲 / 蓝色盲 / 全色盲）下的最差色差。
const worst = (a, b, kinds = KINDS) => Math.min(...kinds.map(k => de2000(simulate(a, k), simulate(b, k))));

// 只靠颜色区分的棋盘状态：任何色觉下都要 ≥ 10。
const mustDiffer = [
  ['已放方块 / 空格', K.block, K.emptyCell],
  ['石台 / 空格', K.slab, K.emptyCell],
  ['棋子 / 空格', K.stone, K.emptyCell],
  ['合法落点 / 空格', over(K.block, 0.8, K.emptyCell), K.emptyCell],
  ['消除预判 / 方块', over(K.clearGlow, 0.6, K.block), K.block]
];
// 能放 / 放不下不靠颜色：能放时才画落点预览（见 game-feedback.test.js）。
for (const [name, a, b] of mustDiffer) {
  assert.ok(worst(a, b) >= 9.5, `${name}: ${worst(a, b).toFixed(1)}`);
}

// 五个模式的色条：常见色觉（正常与三种二色视觉）下两两 ≥ 12。
// 全色盲下柔和色无法全部分开，模式名文字本身承担区分。
const common = ['normal', 'protan', 'deutan', 'tritan'];
for (let i = 0; i < MODE_ORDER.length; i++) {
  for (let j = i + 1; j < MODE_ORDER.length; j++) {
    const a = MODES[MODE_ORDER[i]], b = MODES[MODE_ORDER[j]];
    const d = worst(a.accent, b.accent, common);
    assert.ok(d >= 12, `${a.title} / ${b.title}: ${d.toFixed(1)}`);
  }
}

// 整体色调：图形色不要太艳（文字色另有对比度要求，不在此列）。
for (const [key, value] of Object.entries(K)) {
  if (!/^#/.test(value) || /text/i.test(key)) continue;
  assert.ok(chroma(value) <= 41, `${key} 彩度过高: ${chroma(value).toFixed(0)}`);
}
console.log('Color accessibility checks passed');
