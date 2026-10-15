const COLORS = {
  // 页面背景压到比空格底色更深，棋盘因此读作一块"浮起来"的亮板。
  // 原来背景 / 面板 / 空格三色明度差都在 4% 以内，整块糊成一片。
  background: '#EEEADD',
  panel: '#FAF8F0',
  // 面板与背景的明度差仍然有限，靠一道细描边把棋盘边界钉死。
  boardEdge: '#CFC3A9',
  emptyCell: '#E3DDCC',
  energyEmptyCell: '#E9D49A',
  block: '#81A793',
  primaryButton: '#386551',
  // 放不下 / 非法落点：柔和的砖红，彩度与整体一致。色盲玩家主要靠形状区分——
  // 非法落点画成空心描边格，放不下的托盘方块另有一道斜线。
  alert: '#A26765',
  alertText: '#8B5957',
  // 永久禁区的石料：中等画成一整块石台，困难画成星位上的棋子。
  // 石台面积大，比棋子浅一档（L*62 / L*52）以免压住整个棋盘；它与已放方块明暗接近，
  // 但石台是整块、内部没有格缝，形状上不会认错，所以只要求与空格拉开（色差 21）。
  slab: '#9D968F',
  stone: '#827B76',
  stoneLight: '#9E9894',
  // 消除预判用"变亮"而不是"染金"：明暗变化在任何色觉下都看得见。
  clearGlow: '#FFF3D6',
  gridLine: '#D3C9B8',
  energyRing: '#B7AC99',
  palaceLine: '#AFA38F',
  text: '#344E41',
  secondaryText: '#63645C',
  // 金色分两支：energy 用于图形（✦、能量点、消除动画），不受文字对比度约束；
  // energyText 用于文字，加深以保证小字号星级说明也清晰。两者都压低了彩度。
  energy: '#CDA563',
  energyText: '#846637'
};

const CENTER_BLOCK = [];
for (let row = 3; row < 6; row += 1) {
  for (let col = 3; col < 6; col += 1) CENTER_BLOCK.push([row, col]);
}

// 五处星位：四个角宫的宫心加天元，取自围棋九路盘的星位。
// 它分布在三行、三列和五个宫，比连成一块的中央禁区更分散。
const STAR_BLOCK = [[1, 1], [1, 7], [4, 4], [7, 1], [7, 7]];
// 庭院四角各留 1 格。边行、边列仍有 7 格，照常按行列消除，不需要特殊规则。
// 缺 2×2 时 5 格短边要么太好消（允许单消），要么消不掉（禁止单消，
// 400 局模拟平均仅 100 分，比困难模式还难）；缺 1 格落在中等与困难之间。
const COURTYARD_CORNER = 1;
const COURTYARD_MISSING = [];
for (let row = 0; row < 9; row += 1) {
  for (let col = 0; col < 9; col += 1) {
    if ((row < COURTYARD_CORNER || row >= 9 - COURTYARD_CORNER)
      && (col < COURTYARD_CORNER || col >= 9 - COURTYARD_CORNER)) COURTYARD_MISSING.push([row, col]);
  }
}

// 五个模式的色条分属青绿、赭黄、砖红、石青、灰绿五个色系，并拉开明暗。
// 在红色盲、绿色盲、蓝色盲下两两最差色差约 15（原来只有 2.4，中等与长庭、庭院几乎同色）。
// 全色盲下五色无法全部分开，模式名文字本身就是区分手段。
const MODES = {
  easy: {
    id: 'easy',
    rows: 9, cols: 9,
    title: '方庭',
    description: '新手推荐 · 完整 9×9 无障碍',
    blocked: [],
    rescues: 2,
    bestKey: 'fangcunBestV2Easy',
    cardFill: '#FBF8F1',
    cardStroke: '#D2C7B0',
    titleColor: '#3C4A46',
    accent: '#67A89B'
  },
  medium: {
    id: 'medium',
    rows: 9, cols: 9,
    title: '石台',
    description: '中央 3×3 禁区',
    blocked: CENTER_BLOCK,
    blockedStyle: 'slab',
    rescues: 0,
    bestKey: 'fangcunBestV2Medium',
    cardFill: '#FBF8F1',
    cardStroke: '#E3D2AE',
    titleColor: '#6E5F40',
    accent: '#CFB378'
  },
  hard: {
    id: 'hard',
    rows: 9, cols: 9,
    title: '星位',
    description: '五处星位禁区 · 错落布局',
    blocked: STAR_BLOCK,
    blockedStyle: 'stone',
    rescues: 0,
    bestKey: 'fangcunBestV2Hard',
    cardFill: '#FBF8F1',
    cardStroke: '#B9A4A1',
    titleColor: '#7B5959',
    accent: '#835F5F'
  },
  long: {
    id: 'long', rows: 9, cols: 6,
    title: '长庭',
    description: '六列九行 · 纵向布局',
    help: '长庭：填满 6 格横行或 9 格竖列',
    blocked: [], rescues: 2,
    bestKey: 'fangcunBestLong',
    cardFill: '#FBF8F1', cardStroke: '#97AABC',
    titleColor: '#416588', accent: '#456B91'
  },
  courtyard: {
    id: 'courtyard', rows: 9, cols: 9,
    title: '曲院',
    description: '四角留白 · 边行七格',
    help: '四角留白不可放置，行列只需填满现有格',
    missing: COURTYARD_MISSING,
    blocked: [], rescues: 2,
    bestKey: 'fangcunBestCourtyardV3',
    cardFill: '#FBF8F1', cardStroke: '#B6B893',
    titleColor: '#616536', accent: '#7E8346'
  }
};

// Retired layouts stay in MODES only for legacy data/rule compatibility.
// All current garden entries, save loading and ranking tabs use this list.
const MODE_ORDER = ['easy', 'medium', 'hard'];

// Configure the real rewarded-video unit before enabling video tools.
const REWARDED_AD_UNIT_ID = '';

module.exports = {
  REWARDED_AD_UNIT_ID,
  COLORS,
  MODES,
  MODE_ORDER
};
