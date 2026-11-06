const assert = require('assert');
const { boot, clone } = require('./helpers/game-harness');
const rotation = require('../js/rules/rotation');
const { SHAPES } = require('../js/rules/shapes');
const saves = require('../js/persistence/saves');
const board = require('../js/rules/board');

for (const original of SHAPES) {
  const lucky = { ...original, lucky: true };
  let shape = lucky;
  for (let i = 0; i < 4; i += 1) {
    shape = rotation.turn(shape, lucky);
    assert.equal(shape.id, original.id);
    assert.equal(shape.lucky, true);
    assert.equal(shape.cells.length, original.cells.length);
  }
  assert.strictEqual(shape, lucky, `${original.id} must return to its original orientation`);
}

const key = saves.keyFor('easy');
const rankMessages = [];
const app = boot({}, { api: { getOpenDataContext: () => ({ postMessage: message => rankMessages.push(message) }) } });
app.run(`restartGame();
  state.tray = ['line3H', 'square2', 'dot'].map(id => SHAPES.find(shape => shape.id === id));
  updateTrayAvailability(); saveCurrentGame();`);

function slotPoint(game, slot) {
  return game.run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:3})`);
}
function select(game, slot) {
  const point = slotPoint(game, slot);
  game.handlers.TouchStart({ touches: [point], changedTouches: [point] });
  game.handlers.TouchEnd({ touches: [], changedTouches: [point] });
}
function rotate(game) {
  game.tap(game.run('getRotationAction(layout,state)'));
}
function drop(game, slot, col, row) {
  const from = slotPoint(game, slot);
  game.handlers.TouchStart({ touches: [from], changedTouches: [from] });
  const to = game.run(`(()=>{
    const {width,height}=state.drag.bounds;
    return {clientX:layout.boardX+(${col}+width/2)*layout.cellSize,
      clientY:layout.boardY+(${row}+height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:3};
  })()`);
  game.handlers.TouchMove({ touches: [to], changedTouches: [to] });
  const valid = game.run('state.drag.valid');
  game.handlers.TouchEnd({ touches: [], changedTouches: [to] });
  game.settle();
  return valid;
}

const originalSave = clone(app.store[key]);
select(app, 0);
assert.equal(app.run('state.drag'), null);
rotate(app);
assert.deepEqual(clone(app.run('shapeBounds(state.rotationPreview.shape)')), { width: 1, height: 3 });
assert.deepEqual(app.store[key], originalSave, 'Rotating in the tray is only a preview');
assert.equal(drop(app, 0, 3, 7), false);
assert.equal(app.run('state.rotationUsed'), false);
app.handlers.Hide();
app.handlers.Show();
assert.deepEqual(app.store[key], originalSave, 'Background save must exclude preview orientation');
select(app, 1);
rotate(app);
assert.equal(app.run('state.rotationPreview'), null, 'Symmetric squares keep the original shape');
select(app, 0);
rotate(app);
rotate(app);
assert.equal(app.run('state.rotationPreview'), null, 'Returning to the original orientation is free');
rotate(app);
assert.equal(drop(app, 0, 4, 3), true);
assert.deepEqual(clone(app.run('state.board.slice(3,6).map(row=>row.slice(4,7))')), [[1,0,0],[1,0,0],[1,0,0]]);
assert.deepEqual(app.store[key], originalSave, 'An old client can resume the pre-rotation checkpoint');
assert.equal(saves.loadAll({ getStorageSync: k => app.store[k] }).easy.rotationUsed, true);
assert.equal(app.store.fangcunPersonalBestRotationV1, 3);
assert.equal(app.store.fangcunBestV2Easy, undefined);
assert.ok(app.draw().some(label => label.text === '本局已用'));
app.handlers.Hide();
assert.ok(rankMessages.every(message => message.type !== 'sync' || !message.scores.fangcunBestV2Easy));
const resumed = boot(clone(app.store));
resumed.run('continueOrStartGame()');
assert.equal(resumed.run('state.rotationUsed'), true);
resumed.run('undoMove()');
assert.equal(resumed.run('state.rotationUsed'), false);
assert.deepEqual(clone(resumed.run('state.board')), originalSave.board);
assert.equal(drop(resumed, 2, 0, 0), true);
assert.equal(resumed.run('state.best'), 3, 'The higher personal rotation record is retained');
resumed.handlers.Hide();
assert.ok(rankMessages.some(message => message.type === 'sync' && message.scores.fangcunBestV2Easy === 1));

const rescueBoard = ['001111100','010011000','000001110','011111111','001110101','010011100','011110100','011101011','010101111']
  .map(row => Array.from(row, Number));
const zig = SHAPES.find(shape => shape.id === 'zig4V');
assert.equal(board.hasAnyPlacement(rescueBoard, zig), false);
assert.equal(rotation.canRescue(rescueBoard, [null, null, zig]), true);
const rescue = boot();
rescue.run(`restartGame(); state.board=${JSON.stringify(rescueBoard)}; state.board[0][2]=0;
  state.tray = ['dot', 'rect6H', 'zig4V'].map(id=>SHAPES.find(shape=>shape.id===id)||null);
  updateTrayAvailability(); saveCurrentGame();`);
const legacyCheckpoint = clone(rescue.store[key]);
assert.equal(drop(rescue, 0, 2, 0), true);
assert.equal(rescue.run('state.gameOver'), false);
assert.ok(rescue.draw().some(label => label.text.includes('点选方块试试旋转')));
const rescueCheckpoint = saves.loadAll({ getStorageSync: k => rescue.store[k] }).easy;
assert.ok(saves.decode(rescueCheckpoint, 'easy'), 'A position saved with rotation as its only move can resume');
assert.equal(saves.decode({ ...rescueCheckpoint, rotationUsed: true }, 'easy'), null);
assert.deepEqual(rescue.store[key], legacyCheckpoint);
select(rescue, 1);
assert.equal(rescue.run('state.feedback'), '这块转了也放不下，请试试其他方块');
select(rescue, 2);
assert.equal(rescue.run('state.feedback'), '这个方向放不下，可以试试另一个朝向');
rescue.run('state.videoToolsEnabled=true; requestVideoTool("hint")');
assert.equal(rescue.run('state.feedback'), '点选第 3 块，旋转后可以继续落子');
const oldProgress = { ...clone(rescue.store), [key]: { ...legacyCheckpoint, score: legacyCheckpoint.score + 1 } };
assert.equal(saves.loadAll({ getStorageSync: k => oldProgress[k] }).easy.score, oldProgress[key].score);
const reopened = boot(clone(rescue.store));
reopened.run('continueOrStartGame()');
select(reopened, 2);
rotate(reopened);
const [col, row] = reopened.run(`(()=>{
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(canPlace(state.board,state.rotationPreview.shape,c,r))return [c,r];
})()`);
assert.equal(drop(reopened, 2, col, row), true);
assert.equal(reopened.run('state.rotationUsed'), true);
assert.deepEqual(reopened.store[key], legacyCheckpoint);

// Failed replacement writes cannot remove a readable recovery checkpoint.
const fault = { write: false };
const failing = boot(clone(rescue.store), { fault });
failing.run('continueOrStartGame()');
fault.write = true;
failing.run('restartGame()');
assert.deepEqual(saves.loadAll({ getStorageSync: k => failing.store[k] }).easy, rescueCheckpoint);
fault.write = false;
failing.handlers.Hide();
assert.equal(saves.loadAll({ getStorageSync: k => failing.store[k] }).easy.piecesPlaced, 0);

// The drag hint on a rotating board is shown once, then stays quiet.
{
  const hinted = boot({ fangcunTutorialSeen: true });
  hinted.run('restartGame()');
  const point = slotPoint(hinted, 0);
  const missDrag = () => {
    const away = { ...point, clientY: point.clientY + 200 };
    hinted.handlers.TouchStart({ touches: [point], changedTouches: [point] });
    hinted.handlers.TouchMove({ touches: [away], changedTouches: [away] });
    hinted.handlers.TouchEnd({ touches: [], changedTouches: [away] });
  };
  missDrag();
  assert.equal(hinted.run('state.feedback'), '按住方块，拖到棋盘空位');
  assert.equal(hinted.store.fangcunDragHintSeen, true);
  assert.equal(hinted.store.fangcunFixedDirectionSeen, undefined);
  hinted.run('clearFeedback()');
  missDrag();
  assert.equal(hinted.run('state.feedback'), '');
}

for (const size of [{w:320,h:568},{w:375,h:667},{w:390,h:844},{w:430,h:932}]) {
  const game = boot({}, { size });
  game.run('restartGame()');
  const action = game.run('getRotationAction(layout,state)');
  assert.ok(action.y + action.height < game.run('layout.trayY-layout.trayHitHalfHeight'));
  assert.ok(game.draw().some(label => label.text === '先点选方块'));
  game.run('state.gardenIntro=true');
  assert.equal(game.run('getRotationAction(layout,state)'), null);
  game.run("state.mode='medium'; restartGame()");
  assert.equal(game.run('getRotationAction(layout,state)'), null);
  game.run('startChallenge(0)');
  assert.equal(game.run('getRotationAction(layout,state)'), null);
}
console.log('PASS: rotation touch flow, four layouts, symmetric pieces, failed drops, save/undo, last-move rescue and mode isolation');
