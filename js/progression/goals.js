const challenges = require('../challenge/challenges');

// Rule explanations are independent of a solution, so revisiting them costs no hint.
function describe(state) {
  const run = state.challenge;
  if (!run) return { title:'这一局怎么玩', goal:'腾出空间，挑战更高分', example:'palaces',
    lines:['方向固定，拖动方块填满行、列或 3×3 九宫。','不限时，没有必须达到的通关分数。',
      '托盘里的方块全都放不下时，本局结束。','累计消除可以解锁庭院里的花木。'],
    caption:'例：补齐九宫 → 九格一起消除' };
  const level = challenges.level(run.level);
  const rules = {
    rows: ['填满一整行，整行方块一起消除。','例：补齐整行 → 完成行消除'],
    cols: ['填满一整列，整列方块一起消除。','例：补齐整列 → 完成列消除'],
    palaces: ['填满一个 3×3 九宫，九格一起消除。','例：补齐九宫 → 完成一次九宫消除'],
    regions: ['行、列、九宫消除都计入目标。','例：一手消行和九宫 → 计两次消除'],
    cross: ['同一次落子同时消行或列与九宫。','例：行和九宫同时消除 → 计一次'],
    ice: ['第一次消除破冰，下面的方块留下。','例：冰层消失 → 破冰目标增加'],
    stones: ['› 是目标，深色圆石不能清除。','例：消除 › 方块 → 清理一个标记'],
    area: ['消除虚线内的方块，外面可以留方块。','例：虚线内空出来 → 目标完成'],
    flowers: ['在花圃上下左右消除，每次浇灌一次。','例：邻格消除 → 花圃数字减一']
  };
  const [rule,caption] = rules[level.kind] || rules.stones;
  const closedGate = run.gates.length > 0;
  return { title:'本关目标', goal:challenges.goal(level), example:closedGate?'keys':level.kind,
    lines:[`还可落子 ${Math.max(0,level.limit-run.history.length)} 步，完成目标即可通关。`,rule,
      level.gates && level.gates.length ? '消除钥匙开同字机关；关门行列不能消。'
        : level.kind==='flowers' ? '同一步最多浇一次，数字归零开花。'
        : level.kind==='stones' && run.ice.length ? '带 2 的目标先破冰，再消方块才计数。'
        : '石障不能放置方块，也不能被消除。',
      '先通关；之后可以重玩，争取更少步数。'],caption:closedGate?'例：消除钥匙 A → 机关 A 开启':caption };
}
module.exports = { describe };
