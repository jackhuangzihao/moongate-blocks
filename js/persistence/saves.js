const { MODES, MODE_ORDER } = require('../config');
const { SHAPES } = require('../rules/shapes');
const undoBudget = require('../rules/undo-budget');
const { createBoard, energyPalacePool, findCompletedRegions, hasAnyPlacement } = require('../rules/board');

const FIELDS = ['score', 'startingBest', 'piecesPlaced', 'maxCombo', 'combo', 'energy',
  'luckyPendingCount', 'safetyGuaranteesRemaining'];
const keyFor = mode => `fangcunSaveV1:${MODES[mode].bestKey}`;

// Keep at most three preceding turns; no unbounded recursive save payloads.
function history(save, depth = 3) {
  if (!save || depth <= 0) return null;
  const previous = { ...save, previous: history(save.previous, depth - 1) };
  delete previous.undoBudget;
  return previous;
}

function snapshot(state) {
  const save = { version: 1, mode: state.mode, rule: MODES[state.mode].bestKey,
    welcomeEnergy: Boolean(state.welcomeEnergy),
    gardenIntro: Boolean(state.gardenIntro), sessionClears:state.sessionClears || 0,
    reviveUsed: Boolean(state.reviveUsed),
    previous: history(state.gardenUndo), undoBudget: undoBudget.normalize(state.undoBudget),
    randomState: state.randomState >>> 0,
    board: state.board.map(row => row.slice()),
    energyPalaces: state.energyPalaces.slice(), recentShapeIds: state.recentShapeIds.slice(),
    tray: state.tray.map(shape => shape ? { id: shape.id, lucky: Boolean(shape.lucky) } : null) };
  FIELDS.forEach(key => { save[key] = state[key]; });
  return save;
}

// Local storage may be stale or damaged. Only restore validated, settled turns.
function decode(save, modeId, previousDepth = 3) {
  const mode = MODES[modeId];
  if (!save || save.version !== 1 || save.mode !== modeId || save.rule !== mode.bestKey) return null;
  if (!FIELDS.every(key => Number.isSafeInteger(save[key]) && save[key] >= 0)) return null;
  if (save.energy > 2 || save.safetyGuaranteesRemaining > mode.rescues
    || save.combo > save.maxCombo || save.maxCombo > save.piecesPlaced) return null;
  if (save.randomState !== undefined && (!Number.isInteger(save.randomState) || save.randomState<0 || save.randomState>4294967295)) return null;
  // Old saves acquire a stable seed; reopening the same legacy save cannot reroll it.
  let randomState = save.randomState;
  if (randomState === undefined) {
    randomState = 2166136261;
    for (const ch of JSON.stringify([save.mode,save.board,save.tray,save.piecesPlaced])) randomState = Math.imul(randomState ^ ch.charCodeAt(0),16777619) >>> 0;
  }
  const base = createBoard(modeId);
  if (!Array.isArray(save.board) || save.board.length !== mode.rows
    || !save.board.every((row, r) => Array.isArray(row) && row.length === mode.cols
      && row.every((v, c) => base[r][c] === 0 ? v === 0 || v === 1 : v === base[r][c]))) return null;
  const done = findCompletedRegions(save.board);
  if (done.rows.length || done.cols.length || done.palaces.length) return null;
  if (!Array.isArray(save.tray) || save.tray.length !== 3) return null;
  const tray = [];
  for (const piece of save.tray) {
    if (piece === null) { tray.push(null); continue; }
    if (!piece || typeof piece.lucky !== 'boolean') return null;
    const shape = SHAPES.find(shape => shape.id === piece.id);
    if (!shape || (piece.lucky && shape.cells.length > 2)) return null;
    tray.push({ ...shape, lucky: piece.lucky });
  }
  if (!tray.some(shape => shape && hasAnyPlacement(save.board, shape))) return null;
  if (!Array.isArray(save.recentShapeIds) || save.recentShapeIds.length > 6
    || !save.recentShapeIds.every(id => SHAPES.some(shape => shape.id === id))) return null;
  const palaces = save.energyPalaces, pool = energyPalacePool(modeId);
  // Targets refill when exhausted; energy carries across refills until it reaches three.
  if (!Array.isArray(palaces) || palaces.length > Math.min(3, pool.length)
    || (pool.length ? palaces.length === 0 : save.energy !== 0)
    || new Set(palaces).size !== palaces.length
    || !palaces.every(index => Number.isInteger(index) && pool.includes(index))) return null;
  if (save.gardenIntro===true) {
    if (save.energy!==2 || palaces.length!==1 || save.score!==0 || save.piecesPlaced!==0
      || tray[0] || tray[2] || !tray[1] || tray[1].id!=='line3H' || tray[1].lucky) return null;
    const pc=palaces[0]%(mode.cols/3)*3,pr=Math.floor(palaces[0]/(mode.cols/3))*3;
    if (!save.board.every((row,r)=>row.every((v,c)=>v===(base[r][c]===0 && r>=pr&&r<pr+2&&c>=pc&&c<pc+3?1:base[r][c])))) return null;
  }
  if (save.sessionClears!==undefined && (!Number.isSafeInteger(save.sessionClears)||save.sessionClears<0)) return null;
  const restored = { undoBudget: undoBudget.normalize(save.undoBudget), gardenIntro:save.gardenIntro===true, sessionClears:save.sessionClears || 0, randomState, reviveUsed: save.reviveUsed === true, gardenUndo: null, welcomeEnergy: save.welcomeEnergy === true, board: save.board.map(row => row.slice()), tray,
    energyPalaces: palaces.slice(), recentShapeIds: save.recentShapeIds.slice() };
  FIELDS.forEach(key => { restored[key] = save[key]; });
  if (previousDepth > 0 && save.previous && save.previous.piecesPlaced === save.piecesPlaced-1
    && Boolean(save.previous.reviveUsed) === restored.reviveUsed) {
    const previous = decode(save.previous, modeId, previousDepth - 1);
    if (previous) restored.gardenUndo = { ...history(save.previous, 1), previous: previous.gardenUndo };
  }
  return restored;
}

function loadAll(storage) {
  const saves = {};
  MODE_ORDER.forEach(id => {
    try {
      const save = storage.getStorageSync(keyFor(id));
      if (decode(save, id)) saves[id] = save;
    } catch (error) { /* An unreadable save must not block starting a new game. */ }
  });
  return saves;
}

module.exports = { keyFor, snapshot, decode, loadAll, history };
