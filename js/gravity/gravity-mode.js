const gravity = require('./gravity-engine');
const view = require('./gravity-view');
const storage = require('../persistence/storage');
const analytics = require('../platform/analytics');
const dragPlacement = require('../views/drag-placement');
const { hasAnyPlacement } = require('../rules/board');
const KEY = 'fangcunGravityV1';
const DEMO_MODE = 2; // One move demonstrates clearing, falling and a chain.
const inside = (point, rect) => rect && point.x >= rect.x && point.x <= rect.x + rect.width
  && point.y >= rect.y && point.y <= rect.y + rect.height;

// Platform input and persistence stay separate from the pure rules and Canvas view.
function create({ wx, invalidate, press, persist, feedback, leave, share }) {
  const model = {
    run: null, drag: null, animation: null, completed: [], best: 0, unavailableTray: [],
    message: '', confirmRestart: false, rulesOpen: false, guideSeen: false, savePending: false, resultProgress: 1
  };
  let resultStarted = null;
  let startingBest = 0; // Session-only feedback baseline; persisted records keep their existing timing.
  const stored = storage.read(wx, KEY), runs = {};
  if (stored && stored.version === 1) {
    for (const mode of gravity.PUZZLES.map(puzzle => puzzle.id).concat('free')) {
      const data = stored.runs && stored.runs[mode], run = gravity.restore(data);
      if (run && run.mode === mode) runs[mode] = run;
      else if (data) analytics.report(wx, 'gravity_invalid_save', { mode: String(mode) });
    }
    if (Array.isArray(stored.completed)) {
      model.completed = gravity.PUZZLES.filter(puzzle => stored.completed.includes(puzzle.id)).map(puzzle => puzzle.id);
    }
    model.guideSeen = stored.guideSeen === true || model.completed.length > 0;
    if (Number.isSafeInteger(stored.best) && stored.best >= 0) model.best = stored.best;
  }

  // Derived UI state is refreshed only when the stable run changes, never saved.
  function updateTrayAvailability() {
    model.unavailableTray = model.run.tray.map(id => Boolean(id)
      && !hasAnyPlacement(model.run.board, gravity.shape(id)));
  }

  function save() {
    const run = model.run;
    if (run) {
      runs[run.mode] = gravity.save(run);
      if (run.won && !model.completed.includes(run.mode)) model.completed.push(run.mode);
      if (run.mode === 'free') model.best = Math.max(model.best, run.score);
    }
    persist(KEY, { version: 1, runs, completed: model.completed, best: model.best, guideSeen: model.guideSeen });
  }

  function cancel() {
    if (model.drag) { model.drag = null; invalidate(); }
  }

  function hide() {
    resultStarted=null;model.resultProgress=1;
    cancel();
    if (model.animation) { model.animation = null; invalidate(); }
    model.confirmRestart = false;
    model.rulesOpen = false;
    save();
  }

  function open(mode = 'free', reset = false) {
    resultStarted=null;model.resultProgress=1;
    cancel();
    model.animation = null;
    model.message = '';
    model.confirmRestart = false;
    model.rulesOpen = false;
    startingBest = model.best;
    model.run = (!reset && gravity.restore(runs[mode]))
      || gravity.start(mode, mode === 'free' ? Math.floor(Math.random() * 4294967296) : 271828);
    if (model.run) {
      updateTrayAvailability();
      save();
      analytics.report(wx, 'gravity_start', { mode: String(mode), resumed: Number(!reset && model.run.steps > 0) });
    }
    invalidate();
  }

  function enter() {
    // Old free saves and completed lessons bypass the first-entry demonstration.
    if (model.guideSeen || runs.free && runs.free.steps > 0) open('free');
    else open(DEMO_MODE, true);
  }

  function finishDemo() {
    model.guideSeen = true;
    save();
    open('free');
  }

  function resultSound() {
    const run = model.run;
    if(run && (run.won || run.over) && (run.won || run.score>startingBest)){
      resultStarted=Date.now();model.resultProgress=0;
    }
    if (run && (run.won || run.over) && feedback.result) {
      feedback.result(run.won || (run.mode === 'free' && run.score > startingBest));
    }
  }

  function step(now) {
    if(resultStarted!==null){
      model.resultProgress=Math.min(1,Math.max(0,(now-resultStarted)/750));
      if(model.resultProgress===1)resultStarted=null;
      invalidate();
    }
    const animation = model.animation;
    if (!animation) return;
    while (animation.index < animation.frames.length) {
      const duration = animation.frames[animation.index].kind === 'clear' ? 160 : 240;
      if (now - animation.start < duration) {
        animation.progress = Math.max(0, (now - animation.start) / duration);
        break;
      }
      animation.start += duration;
      animation.index++;
    }
    if (animation.index === animation.frames.length) {
      model.animation = null;
      resultSound();
    } else if (animation.frames[animation.index].kind === 'clear' && animation.sounded !== animation.index) {
      animation.sounded = animation.index;
      if (feedback.elimination) feedback.elimination(animation.frames[animation.index].wave, false, 1);
    }
    invalidate();
  }

  function updateDrag(point, layout) {
    const drag = model.drag;
    if (!drag) return;
    const geometry = view.layoutFor(layout, model.run.mode !== 'free');
    Object.assign(drag, dragPlacement.position(point, drag.bounds, geometry.placement));
    const target = drag.target;
    const previewKey = target ? `${target.col},${target.row}` : 'outside';
    if (drag.lastPreviewKey !== previewKey) {
      drag.lastPreviewKey = previewKey;
      drag.preview = target ? gravity.preview(model.run, drag.slot, target.col, target.row) : null;
      if (model.run.mode !== 'free' && target) {
        const [slot, col, row] = gravity.PUZZLES[model.run.mode].solution[0];
        if (drag.slot !== slot || target.col !== col || target.row !== row) drag.preview = null;
      }
    }
    invalidate();
  }

  function start(point, id, layout) {
    const geometry = view.layoutFor(layout, model.run.mode !== 'free'), run = model.run;
    const button = (rect, name, action) => {
      if (!inside(point, rect)) return false;
      press('gravity-' + name, action, rect, id);
      return true;
    };
    if (model.confirmRestart) {
      button(geometry.cancel, 'cancel', () => { model.confirmRestart = false; invalidate(); })
        || button(geometry.accept, 'accept', () => open(run.mode, true));
      return;
    }
    if (model.rulesOpen) {
      button(geometry.rulesDemo, 'demo', () => { save(); open(DEMO_MODE, true); })
        || button(geometry.rulesClose, 'rules-close', () => { model.rulesOpen = false; invalidate(); });
      return;
    }
    if (button(geometry.buttons.back, 'back', () => {
      if (run.mode !== 'free') finishDemo(); else { hide(); leave(); }
    })) return;
    if (button(geometry.buttons.next, 'next', () => {
      if (run.mode !== 'free') finishDemo();
      else if(run.over && share)share();
      else { cancel(); model.rulesOpen = true; invalidate(); }
    })) return;
    if (run.mode !== 'free' && button(geometry.buttons.retry, 'retry', () => open(DEMO_MODE, true))) return;
    if (run.mode === 'free') {
      if (button(geometry.buttons.retry, 'retry', () => {
        if (run.steps && !run.over) { model.confirmRestart = true; invalidate(); }
        else open('free', true);
      })) return;
      if (model.animation) return;
      if (button(geometry.buttons.undo, 'undo', () => {
        const restored = gravity.undo(model.run);
        if (!restored) {
          model.message = run.over ? '本局结束，请重新开始'
            : run.undoUsed ? '本局撤回已用完' : '先放一块，再撤回';
          invalidate();
          return;
        }
        model.run = restored;
        updateTrayAvailability();
        save();
        if (feedback.undoMove) feedback.undoMove();
        model.message = '已撤回 · 剩余 0 次';
        invalidate();
      })) return;
    }
    if (model.animation || run.won || run.over) return;
    const slot = geometry.trays.findIndex(rect => inside(point, rect));
    if (slot < 0 || !run.tray[slot]) return;
    model.message = model.unavailableTray[slot] ? '暂时无处可放，先试试其他方块' : '';
    const shape = gravity.shape(run.tray[slot]);
    const bounds = {
      width: Math.max(...shape.cells.map(cell => cell[0])) + 1,
      height: Math.max(...shape.cells.map(cell => cell[1])) + 1
    };
    model.drag = { touchId: id, slot, shape, bounds, target: null, preview: null };
    updateDrag(point, layout);
  }

  function end(point, layout) {
    if (!model.drag) return;
    updateDrag(point, layout);
    const drag = model.drag;
    model.drag = null;
    if (model.run.mode !== 'free' && drag.target) {
      const [slot, col, row] = gravity.PUZZLES[model.run.mode].solution[0];
      if (drag.slot !== slot || drag.target.col !== col || drag.target.row !== row) {
        model.message = '把横条拖到下方框出的空位';
        invalidate();
        return;
      }
    }
    const result = drag.target && gravity.play(model.run, drag.slot, drag.target.col, drag.target.row);
    if (!result) {
      model.message = drag.target ? '这里放不下，请换一处完整空位' : ''; 
      invalidate();
      return;
    }
    // Commit the stable board before animation; interrupted frames never replay rewards.
    model.run = result.state;
    updateTrayAvailability();
    if (model.run.mode !== 'free' && model.run.won) model.guideSeen = true;
    save();
    model.message = '';
    if (result.frames.length) {
      model.animation = { frames: result.frames, index: 0, start: Date.now(), progress: 0, sounded: 0 };
      if (feedback.elimination) feedback.elimination(1, false, 1);
    } else {
      if (feedback.placement) feedback.placement();
      resultSound();
    }
    analytics.report(wx, 'gravity_move', {
      mode: String(model.run.mode), steps: model.run.steps, chain: model.run.chain,
      result: model.run.won ? 'win' : model.run.over ? 'over' : 'playing'
    });
    invalidate();
  }

  return {
    enter, open, save, hide, cancel, start, move: updateDrag, end, step, model,
    draw(ctx, layout, pressed, appearanceId = 'classic') {
      model.savePending = storage.hasPending(wx);
      view.draw(ctx, layout, model, pressed, appearanceId);
    },
    get touchId() { return model.drag ? model.drag.touchId : null; }
  };
}
module.exports = { KEY, create };
