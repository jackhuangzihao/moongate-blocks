const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const { createRequire } = require('module');
const C = require('../../js/challenge/challenges'), D = require('../../js/daily/daily'), K = require('../../js/progression/collection'), B = require('../../js/rules/board');
const clone = value => JSON.parse(JSON.stringify(value));
const game = path.resolve(__dirname, '../../game.js'), req = createRequire(game), INVITE = 'fangcunInvitationV1';
function boot(store = {}, options = {}) {
  const handlers = {}, notices = [], events = [], labels = [], clock = options.clock || { value: Date.parse('2026-10-03T04:00:00Z') };
  const size = options.size || { w: 390, h: 844 };
  const fault = options.fault || {}, ctx = new Proxy({}, { get: (o, k) => k === 'fillText'
    ? (value, x, y) => labels.push({ text: String(value), x, y, font: o.font, align: o.textAlign, color: o.fillStyle, alpha: o.globalAlpha === undefined ? 1 : o.globalAlpha })
    : o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) });
  const wx = { getWindowInfo: () => ({ windowWidth: size.w, windowHeight: size.h }), createCanvas: () => ({ getContext: () => ctx }),
    getStorageSync: key => store[key] === undefined ? undefined : clone(store[key]),
    setStorageSync: (key, value) => { if (fault.write) throw Error('full'); store[key] = clone(value); },
    getLaunchOptionsSync: () => ({ query: options.query || {} }), showToast: data => notices.push(data.title),
    reportEvent: (event, data) => events.push([event, clone(data)]) };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show']) wx['on' + name] = f => handlers[name] = f;
  Object.assign(wx,options.api || {});
  let feedback = { settings: {}, playMusic() {}, placement() {}, elimination() {}, resume() {}, suspend() {}, undoMove() {}, iceBreak() {}, result() {} };
  if (options.realFeedback) {
    const file = path.resolve(__dirname, '../../js/platform/feedback.js'), module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { wx, module, require: createRequire(file) });
    feedback = module.exports;
  }
  const math = Object.create(Math);
  if (options.random) math.random = options.random;
  const sandbox = vm.createContext({ wx, Math: math, requestAnimationFrame() {}, require: name => name === './js/platform/feedback' ? feedback
    : name === './js/config' && options.adUnitId !== undefined ? {...req(name),REWARDED_AD_UNIT_ID:options.adUnitId}
    : name === './js/daily/daily' ? { ...D, dateKey: (now = clock.value) => D.dateKey(now) } : req(name) });
  vm.runInContext(fs.readFileSync(game, 'utf8'), sandbox);
  const run = source => vm.runInContext(source, sandbox);
  const settle = () => run('stepAnimations(Date.now()+1000);stepAnimations(Date.now()+2000)');
  const draw = () => { labels.length = 0; run('invalidateScene();present()'); return labels.slice(); };
  function tap(rect) {
    const point = { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, identifier: 8 };
    handlers.TouchStart({ touches: [point], changedTouches: [point] });
    handlers.TouchEnd({ touches: [], changedTouches: [point] }); settle();
  }
  function move([slot, c, r]) {
    const from = run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:3})`);
    const to = run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:3}})()`);
    handlers.TouchStart({ touches: [from], changedTouches: [from] });
    handlers.TouchEnd({ touches: [], changedTouches: [to] }); settle();
  }
  const complete = () => {
    const current = run('state.challenge');
    for (const next of C.level(current.level).solution.slice(current.history.length)) move(next);
    assert.equal(run('state.challenge.won'), true);
  };
  return { store, handlers, notices, events, clock, run, move, complete, settle, tap, draw };
}
function protectedStore() {
  const normal = C.load({ getStorageSync: () => null });
  normal.stars.splice(0, 4, 3, 3, 3, 2);
  normal.fails[17] = 3; normal.freeHints[4] = 1;
  const run = C.start(4); run.undoBudget=require('../../js/rules/undo-budget').create(); C.play(run, ...C.LEVELS[4].solution[0]);
  normal.runs[0] = normal.active = C.checkpoint(run);
  return { [C.KEY]: normal, [K.KEY]: { version: 1, clears: 19, seen: ['bamboo'], hidden: [], chapterCounts: { arbour: 0, plaque: 3, keyCharm: 0 } }, fangcunBestV2Easy: 321 };
}
function protectedState(store) { const decor=clone(store[K.KEY]); delete decor.dailyCompletions; return clone([store[C.KEY], decor, store.fangcunBestV2Easy]); }
function queryFor(id, date, steps) { return { challenge: '1', level: String(id < 0 ? id : id + 1), rule: String(C.level(id).rule), ...(date ? { daily: date } : {}), ...(steps !== undefined ? { steps: String(steps) } : {}) }; }

module.exports = { boot, clone, protectedStore, protectedState, queryFor, INVITE };
