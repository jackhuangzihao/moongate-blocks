const { SHAPES } = require('../rules/shapes');
const undoBudget = require('../rules/undo-budget');
const { canPlace, placeShape, findCompletedRegions, clearCompletedRegions, hasAnyPlacement } = require('../rules/board');
const KEY = 'fangcunChallengesV1';
const shape = id => SHAPES.find(piece => piece.id === id);
const { LEVELS, CHAPTERS, chapterLevels, nextLevel } = require('./challenge-levels');
const DAILY_LEVELS = require('../daily/daily-levels');
function getLevel(id) { return Number.isInteger(id) ? (id < 0 ? DAILY_LEVELS[-id - 1] : LEVELS[id]) : undefined; }
function start(id) {
  const level = getLevel(id);
  if (!Number.isInteger(id) || !level) return null;
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  level.filled.forEach(([c,r]) => { board[r][c] = 1; });
  level.holes.forEach(([c,r]) => { board[r][c] = 0; });
  (level.blocked || []).forEach(([c,r]) => { board[r][c] = 2; });
  (level.gates || []).forEach(gate => gate.cells.forEach(([c,r]) => { board[r][c] = 2; }));
  const run = { level: id, board, ice: (level.ice || []).map(p=>p.slice()), stones: (level.stones || []).map(p=>p.slice()),
    keys: (level.keys || []).map(p=>p.slice()), gates: (level.gates || []).map(gate=>({id:gate.id,cells:gate.cells.map(p=>p.slice())})),
    flowers: (level.flowers || []).map(p=>p.slice()), history: [], score: 0,
    progress: 0, totalClears: 0, combo: 0, maxCombo: 0, cursor: 0, tray: [], won: false, ended: false };
  if (level.kind==='area') run.progress=level.area.filter(([c,r])=>board[r][c]===0).length;
  deal(run); return run;
}
function deal(run) {
  const deck = getLevel(run.level).deck;
  run.tray = [0,1,2].map(() => shape(deck[run.cursor++]) || null);
}
function nextTray(run) {
  if (!run || run.ended || run.history.length + run.tray.filter(Boolean).length >= getLevel(run.level).limit) return [];
  return getLevel(run.level).deck.slice(run.cursor, run.cursor+3).map(shape);
}
function completedRegions(run) {
  const completed=findCompletedRegions(run.board);
  // A closed door is different from a permanent stone: it also prevents its
  // line from clearing. Otherwise a row could collect a key behind its own lock.
  for(const gate of run.gates)for(const [c,r] of gate.cells) {
    completed.rows=completed.rows.filter(y=>y!==r);
    completed.cols=completed.cols.filter(x=>x!==c);
  }
  return completed;
}
function play(run, slot, c, r) {
  if (!run || run.ended || ![slot,c,r].every(Number.isInteger) || slot < 0 || slot > 2) return null;
  const piece = run.tray[slot];
  if (!piece || !canPlace(run.board,piece,c,r)) return null;
  placeShape(run.board,piece,c,r);
  const completed = completedRegions(run), cells = [];
  for (let y=0;y<9;y++) for (let x=0;x<9;x++) {
    if (run.board[y][x] === 1 && (completed.rows.includes(y) || completed.cols.includes(x)
      || completed.palaces.some(([pc,pr])=>Math.floor(x/3)===pc&&Math.floor(y/3)===pr))) cells.push([x,y]);
  }
  const before = run.stones.length;
  // A flower receives at most one watering per placement, even when several
  // adjacent cells or several regions clear together. Bloomed flowers stay put.
  const wateredFlowers=[];
  for(const flower of run.flowers) {
    if(flower[2]>0 && cells.some(([x,y])=>Math.abs(x-flower[0])+Math.abs(y-flower[1])===1)) {
      flower[2]--; wateredFlowers.push(flower.slice());
    }
  }
  const frozen = run.ice.filter(([x,y]) => cells.some(([c,r]) => c===x && r===y));
  const collectedKeys = run.keys.filter(([x,y]) => cells.some(([c,r])=>c===x&&r===y)
    && !frozen.some(([c,r])=>c===x&&r===y));
  run.keys = run.keys.filter(key=>!collectedKeys.includes(key));
  const opening = run.gates.filter(gate=>collectedKeys.some(key=>key[2]===gate.id));
  const openedGates = opening.flatMap(gate=>gate.cells.map(([x,y])=>[x,y,gate.id]));
  run.gates = run.gates.filter(gate=>!opening.includes(gate));
  run.ice = run.ice.filter(([x,y]) => !frozen.some(([c,r]) => c===x && r===y));
  run.stones = run.stones.filter(([x,y]) => frozen.some(([c,r])=>c===x&&r===y) || !cells.some(([c,r])=>c===x&&r===y));
  const count = completed.rows.length + completed.cols.length + completed.palaces.length;
  run.totalClears += count;
  const level = getLevel(run.level);
  run.progress += level.kind==='stones' ? before-run.stones.length
    : level.kind==='regions' ? count : level.kind==='ice' ? frozen.length
    : level.kind==='cross' ? Number(completed.palaces.length>0 && completed.rows.length+completed.cols.length>0)
    : level.kind==='area' || level.kind==='flowers' ? 0 : completed[level.kind].length;
  run.combo = count ? run.combo + 1 : 0; run.maxCombo = Math.max(run.maxCombo,run.combo);
  run.score += piece.cells.length + (count===1 ? 10 : count===2 ? 40 : count>=3 ? 80+(count-3)*35 : 0);
  clearCompletedRegions(run.board,completed);
  frozen.forEach(([c,r]) => { run.board[r][c] = 1; });
  // Open after this move's clears. A newly opened cell is available next turn,
  // never filled, scored or cleared by the move that collected its key.
  openedGates.forEach(([c,r]) => { run.board[r][c] = 0; });
  if (level.kind==='area') run.progress=level.area.filter(([x,y])=>run.board[y][x]===0).length;
  if (level.kind==='flowers') run.progress=run.flowers.filter(flower=>flower[2]===0).length;
  run.history.push([slot,c,r]); run.tray[slot] = null;
  let dealt = false;
  if (run.tray.every(piece=>!piece)) { deal(run); dealt = true; }
  run.won = run.progress >= level.target;
  run.ended = run.won || run.history.length >= level.limit || !run.tray.some(piece=>piece&&hasAnyPlacement(run.board,piece));
  return { cells, count, completed, dealt, brokenIce: frozen, wateredFlowers, collectedKeys, openedGates };
}
function preview(run, slot, c, r) {
  if (!run || run.ended) return null;
  const trial=JSON.parse(JSON.stringify(run)), result=play(trial,slot,c,r);
  return result && {...result,progressGain:trial.progress-run.progress,
    bloomedFlowers:result.wateredFlowers.filter(flower=>flower[2]===0),won:trial.won};
}
function stars(run) { return run.won ? (run.history.length<=getLevel(run.level).par ? 3 : run.history.length<=getLevel(run.level).par+1 ? 2 : 1) : 0; }
function unlocked(progress, chapter = progress.chapter || 0) {
  const levels=chapterLevels(chapter);
  const next=levels.find(level=>!progress.stars[level.id]);
  return next ? next.id : levels.length ? levels[levels.length-1].id : null;
}
function isUnlocked(progress, id) {
  return Number.isInteger(id) && Boolean(LEVELS[id]) && LEVELS[id].order <= LEVELS[unlocked(progress, LEVELS[id].chapter)].order;
}
function checkpoint(run) {
  // Failed attempts remain resumable, including their exhausted undo budget.
  return run && !run.won ? { level: run.level, rule: getLevel(run.level).rule,
    history: run.history.map(move=>move.slice()),
    ...(run.undoBudget !== undefined ? {undoBudget: undoBudget.normalize(run.undoBudget)} : {}),
    ...(run.failedOnce ? {failedOnce:true} : {}) } : null;
}
function restore(saved) {
  if (!saved || !Array.isArray(saved.history) || !getLevel(saved.level)
    || saved.history.length>getLevel(saved.level).limit) return null;
  if ((saved.rule === undefined ? 1 : saved.rule) !== getLevel(saved.level).rule) return null;
  const run=start(saved.level); if (!run) return null;
  for (const move of saved.history) if (!Array.isArray(move)||move.length!==3||!play(run,...move)) return null;
  if (saved.undoBudget !== undefined) run.undoBudget = undoBudget.normalize(saved.undoBudget);
  if (saved.failedOnce === true) run.failedOnce=true;
  return run.won ? null : run;
}
function undo(run) {
  if (!run || run.won || !run.history.length) return null;
  return restore({ level: run.level, rule: getLevel(run.level).rule, history: run.history.slice(0, -1), failedOnce:run.failedOnce, undoBudget:run.undoBudget });
}
// 没有广告时的保底：同一关失败满 3 次，送 1 次提示；每关只送一次。
const FREE_HINT_AFTER = 3;
function freeHintReady(progress, id) {
  return Boolean(progress && progress.fails && progress.freeHints && LEVELS[id])
    && progress.fails[id] >= FREE_HINT_AFTER && !progress.freeHints[id];
}
function load(wx) {
  const progress={version:1, stars:LEVELS.map(()=>0), chapter:0, runs:CHAPTERS.map(()=>null), active:null,
    fails:LEVELS.map(()=>0), freeHints:LEVELS.map(()=>0), bestSteps:LEVELS.map(()=>null), bestRules:LEVELS.map(level=>level.rule)};
  try {
    const stored=wx.getStorageSync(KEY);
    if (!stored || stored.version!==1) return progress;
    if (Array.isArray(stored.stars) && stored.stars.every(n=>Number.isInteger(n)&&n>=0&&n<=3)) {
      // A later star cannot unlock a gap in the chapter.
      // Levels are append-only: retain the old prefix and initialize new levels to zero.
      for(let chapter=0;chapter<CHAPTERS.length;chapter++) {
        let gap=false;
        for(const level of chapterLevels(chapter)) {
          const n=stored.stars[level.id]||0;if(!n)gap=true;
          progress.stars[level.id]=gap?0:n;
        }
      }
    }
    const counts=(list,max)=>LEVELS.map((_,i)=>Array.isArray(list)&&Number.isInteger(list[i])&&list[i]>=0?Math.min(list[i],max):0);
    progress.fails=counts(stored.fails,999); progress.freeHints=counts(stored.freeHints,1);
    progress.bestSteps=LEVELS.map((level,i)=>stored.bestRules && stored.bestRules[i]===level.rule
      && stored.bestSteps && Number.isInteger(stored.bestSteps[i]) && stored.bestSteps[i]>0
      && stored.bestSteps[i]<=level.limit ? stored.bestSteps[i] : null);
    progress.chapter = Number.isInteger(stored.chapter) && stored.chapter>=0 && stored.chapter<CHAPTERS.length
      ? stored.chapter : (stored.active && LEVELS[stored.active.level] ? LEVELS[stored.active.level].chapter : 0);
    const savedRuns = Array.isArray(stored.runs) ? stored.runs : [];
    if (!stored.runs && stored.active && LEVELS[stored.active.level]) savedRuns[LEVELS[stored.active.level].chapter]=stored.active;
    progress.runs = CHAPTERS.map((_,chapter)=>{
      const saved = savedRuns[chapter], run = restore(saved);
      if (saved && LEVELS[saved.level] && (saved.rule ?? 1)!==LEVELS[saved.level].rule) progress.updatedLayout=true;
      return run && LEVELS[run.level].chapter===chapter && isUnlocked(progress,run.level) ? checkpoint(run) : null;
    });
    progress.active = progress.runs[progress.chapter];
  } catch (_) { /* Local data damage must not block a fresh chapter. */ }
  return progress;
}
function goal(level) { return level.kind==='rows'?'填满一行':level.kind==='cols'?'填满一列':level.kind==='palaces'?'点亮一个九宫':level.kind==='regions'?`完成 ${level.target} 次区域消除`:level.kind==='cross'?'一手消除行或列与九宫':level.kind==='ice'?`打破 ${level.target} 块薄冰`:level.kind==='area'?'清空虚线区域':level.kind==='flowers'?`让 ${level.target} 处花圃开花`:`清理 ${level.target} 个标记`; }
function detail(level) {
  if(level.gates && level.gates.length) return '消除钥匙开启同字母机关 · 关门的行列不能消除';
  if(level.kind==='flowers') return '上下左右消除浇灌 · 数字归零开花';
  if(level.kind==='cross') return '先补齐外围，让行或列与九宫一起填满';
  if(level.kind==='regions') return '行、列、九宫都计数，一手多消可以更快完成';
  if(level.kind==='ice') return '冰层破开就计数，不必再次清掉下面的方块';
  if(level.kind==='area') return '让虚线内不剩方块；圆石不可清除，不计目标';
  return level.kind==='stones'?(level.blocked&&level.blocked.length?'› 是目标 · 2 先破冰 · 圆石不可清除':level.ice&&level.ice.length?'清除 › 标记；2 表示先破冰再清除':'填满标记所在的行、列或九宫即可清除'):'拖动方块，补齐棋盘上的空缺';
}
module.exports={ KEY, LEVELS, CHAPTERS, chapterLevels, nextLevel, DAILY_LEVELS, level:getLevel, FREE_HINT_AFTER, freeHintReady, start, nextTray, completedRegions, play, preview, stars, unlocked, isUnlocked, checkpoint, restore, undo, load, goal, detail };
