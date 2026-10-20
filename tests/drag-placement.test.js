const assert = require('assert');
const { boot, clone } = require('./helpers/game-harness');
const feedback = require('../js/views/drag-placement');
const view = require('../js/gravity/gravity-view');
const boardView = require('../js/views/board-view');
const {COLORS} = require('../js/config');

function canvasRecorder() {
  const paints = [], stack = [];
  let rect;
  const ctx = new Proxy({ globalAlpha: 1,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); },
    roundRect(x, y, width, height) { rect = { x, y, width, height }; },
    fill() { paints.push({ ...rect, color: this.fillStyle, alpha: this.globalAlpha }); }
  }, { get: (object, key) => object[key] ?? (() => {}) });
  return { ctx, paints };
}
for (const size of [{ w: 320, h: 568 }, { w: 390, h: 844 }]) {
  const app = boot({}, { size });
  // Use known occupied/gap fixtures in free play; the guided demo intentionally
  // restricts its only piece to one destination and has a centered tray.
  app.run("openGravity();gravityMode.model.run=require('./js/gravity/gravity-engine').start(1);gravityMode.model.run.mode='free'");
  const layout = app.run('layout'), v = view.layoutFor(layout);
  const tray = v.trays[0];
  const from = { clientX: tray.x + tray.width / 2, clientY: tray.y + tray.height / 2, identifier: 31 };
  const before = clone(app.run('gravityMode.model.run'));
  app.handlers.TouchStart({ touches: [from], changedTouches: [from] });
  for (const point of [from,
    { ...from, clientX: v.board.x + v.cell / 2, clientY: v.board.y + 8.5 * v.cell + Math.min(86, v.cell * 2.2) },
    { ...from, clientX: v.board.x + 2.5 * v.cell, clientY: v.board.y + 8.5 * v.cell + Math.min(86, v.cell * 2.2) },
    { ...from, clientX: -100, clientY: 0 }]) {
    app.handlers.TouchMove({ touches: [point], changedTouches: [point] });
    const model = clone(app.run('gravityMode.model')), drag = model.drag;
    const expected = feedback.position({ x: point.clientX, y: point.clientY }, drag.bounds, v.placement);
    assert.deepStrictEqual({ x: drag.x, y: drag.y, target: drag.target }, expected);
    const { ctx, paints } = canvasRecorder();
    view.draw(ctx, layout, model, '');
    const held = paints.filter(paint => paint.alpha === .92);
    assert.equal(held.length, drag.shape.cells.length, 'piece follows the finger even outside or over occupied cells');
    assert.ok(Math.abs(held[0].x - (drag.x - v.cell / 2 + 2.5)) < 1e-8);
    assert.ok(Math.abs(held[0].y - (drag.y - v.cell / 2 + 2.5)) < 1e-8);
    assert.ok(!paints.some(paint => paint.color === held[0].color && paint.alpha === 1
      && paint.x >= tray.x && paint.x < tray.x + tray.width && paint.y >= tray.y && paint.y < tray.y + tray.height), 'picked-up tray piece is hidden');
    const landings = paints.filter(paint => paint.alpha === .8);
    assert.equal(landings.length, drag.preview ? drag.shape.cells.length : 0, 'only legal placements show a landing');
    assert.deepStrictEqual(clone(app.run('gravityMode.model.run')), before, 'moving never mutates the game');
    if (drag.preview) {
      const cached = app.run('gravityMode.model.drag.preview');
      app.handlers.TouchMove({ touches: [point], changedTouches: [point] });
      assert.strictEqual(app.run('gravityMode.model.drag.preview'), cached, 'same cell reuses the preview');
      assert.equal(paints.some(paint => paint.color === '#FFF3D6' && paint.alpha === .6), drag.preview.falls);
    }
  }
  app.handlers.TouchEnd({ touches: [], changedTouches: [{ ...from, clientX: -100, clientY: 0 }] });
  assert.equal(app.run('gravityMode.model.drag'), null);
  assert.deepStrictEqual(clone(app.run('gravityMode.model.run')), before, 'outside release costs no step or undo');
  app.handlers.TouchStart({ touches: [from], changedTouches: [from] });
  const blocked = { ...from, clientX: v.board.x + v.cell / 2, clientY: v.board.y + 8.5 * v.cell + Math.min(86, v.cell * 2.2) };
  app.handlers.TouchEnd({ touches: [], changedTouches: [blocked] });
  assert.deepStrictEqual(clone(app.run('gravityMode.model.run')), before, 'occupied release is rejected');
  assert.ok(app.run('gravityMode.model.message').includes('放不下'));
  app.run("gravityMode.model.run=require('./js/gravity/gravity-engine').start(0);gravityMode.model.run.mode='free'");
  app.handlers.TouchStart({ touches: [from], changedTouches: [from] });
  const clear = { ...blocked, clientX: v.board.x + 4.5 * v.cell };
  app.handlers.TouchMove({ touches: [clear], changedTouches: [clear] });
  const { ctx, paints } = canvasRecorder();
  view.draw(ctx, layout, clone(app.run('gravityMode.model')), '');
  assert.equal(paints.filter(paint => paint.alpha === .92).length, 3);
  assert.equal(paints.filter(paint => paint.color === '#FFF3D6' && paint.alpha === .6).length, 9, 'the full completed row lights up');
  app.handlers.TouchEnd({ touches: [], changedTouches: [clear] }); app.settle();
  assert.equal(app.run('gravityMode.model.run.clears'), 1, 'release commits the previewed placement');
}
// Preserve the established half-cell snapping boundary and board-edge guard.
const layout = { boardX: 20, boardY: 100, boardWidth: 270, boardHeight: 270, cellSize: 30 };
const bounds = { width: 3, height: 2 };
assert.deepStrictEqual(feedback.position({ x: 65, y: 196 }, bounds, layout).target, { col: 0, row: 0 });
assert.equal(feedback.position({ x: 79.9, y: 196 }, bounds, layout).target.col, 0);
assert.equal(feedback.position({ x: 80.1, y: 196 }, bounds, layout).target.col, 1);
assert.equal(feedback.position({ x: 500, y: 196 }, bounds, layout).target, null);
// The selected tray is visual only: picking up/cancelling preserves the board and hit areas.
for(const size of [{w:320,h:568},{w:390,h:844}])for(const chapter of [false,true]){
  const app=boot({fangcunTutorialSeen:true},{size});
  app.run(chapter?'startChallenge(12);state.mechanicGuide=null':'restartGame()');app.draw();
  const l=app.run('layout'),board=clone(app.run('state.board'));
  const slot=chapter?app.run('challenges.level(12).solution[0][0]'):0;
  const point={clientX:l.horizontalPadding+l.traySlotWidth*(slot+.5),clientY:l.trayY,identifier:13};
  app.handlers.TouchStart({touches:[point],changedTouches:[point]});
  assert.equal(app.run('state.drag.trayIndex'),slot);
  const selected=canvasRecorder();boardView.drawTray(selected.ctx,l,app.run('state'));
  const pads=selected.paints.filter(p=>p.color===COLORS.traySelected);
  assert.equal(pads.length,1);assert.ok(point.clientX>pads[0].x && point.clientX<pads[0].x+pads[0].width);
  assert.deepStrictEqual(clone(app.run('state.board')),board);
  app.handlers.TouchCancel({touches:[],changedTouches:[point]});
  assert.equal(app.run('state.drag'),null);
  const restored=canvasRecorder();boardView.drawTray(restored.ctx,l,app.run('state'));
  assert.equal(restored.paints.filter(p=>p.color===COLORS.traySelected).length,0);
  assert.equal(restored.paints.filter(p=>p.color===COLORS.trayBackground).length,3);
  assert.deepStrictEqual(clone(app.run('state.board')),board);
}
console.log('PASS: shared drag anchoring, floating piece outside/inside board, tray removal, legal-only previews, highlights, cache and rejected releases');
