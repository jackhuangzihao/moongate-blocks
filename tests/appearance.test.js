const assert = require('assert');
const A = require('../js/progression/appearance');
const themes = require('../js/views/themes');
const storage = require('../js/persistence/storage');
const { COLORS, MODES } = require('../js/config');
const { createLayout } = require('../js/views/layout');
const { getAppearanceActions } = require('../js/views/appearance-view');
const { getSettingsActions } = require('../js/views/panel-view');
const sharing = require('../js/platform/sharing');
const C = require('../js/challenge/challenges');
const { boot, clone, protectedStore } = require('./helpers/game-harness');

for (const saved of [null, false, [], 'ink', { version: 2, selected: 'neon', neonUnlocked: true },
  { version: 1, selected: 'unknown' }, { version: 1, selected: 'neon', neonUnlocked: 'true' }]) {
  assert.deepStrictEqual(A.normalize(saved), { version: 1, selected: 'classic', neonUnlocked: false });
}
assert.equal(A.completedLevels({ stars: [3, 0, NaN, -1, '3', 4, 1, 2] }), 3);
assert.equal(A.normalize({ version: 1, selected: 'ink' }).selected, 'ink');
assert.equal(A.normalize({ version: 1, selected: 'neon', neonUnlocked: true }).selected, 'neon');
assert.equal(A.normalize(null, { stars: [1, 3, 1] }).neonUnlocked, true);
assert.equal(A.unlocked('unknown', { neonUnlocked: true }), false);

const old = protectedStore(), oldProgress = clone(old[C.KEY]);
const migrated = boot(old);
assert.equal(migrated.run('state.appearance.neonUnlocked'), true);
assert.equal(old[A.KEY].neonUnlocked, true);
assert.deepStrictEqual(old[C.KEY], oldProgress, 'unlock does not rewrite old challenge data');
const permanent = boot({ [A.KEY]: { version: 1, selected: 'neon', neonUnlocked: true } });
assert.equal(permanent.run('state.appearance.selected'), 'neon', 'permanent unlock survives missing progress');

function openAppearance(app) {
  if (app.run('state.gameOver')) app.tap(app.run('getGameOverActions(layout,state).menu'));
  app.tap(app.run("state.screen==='menu'?getHomeActions(layout).settings:getSettingsButton(layout)"));
  app.tap(app.run('getSettingsActions(layout).appearance'));
  assert(app.run('state.appearancePreview'));
}
function actions(app) { return app.run('getAppearanceActions(layout)'); }
const app = boot({ fangcunTutorialSeen: true });
app.run('startChallenge(0);state.mechanicGuide=null');
const initial = clone(app.run('state.challenge')), saved = clone(app.store);
openAppearance(app);
app.tap(actions(app).rows.neon);
assert.equal(app.run('state.appearancePreview'), 'neon');
assert.equal(app.run('state.appearance.selected'), 'classic');
assert(!app.store[A.KEY]);
app.tap(actions(app).use);
assert.equal(app.run('state.appearancePreview'), 'neon', 'locked use cannot equip');
app.move([0, 0, 0]);
assert.deepStrictEqual(clone(app.run('state.challenge')), initial, 'appearance blocks placement');
app.tap(actions(app).close);
app.draw();
assert.equal(COLORS.background, themes.palette('classic', true).background, 'cancel restores chapter palette');
assert.deepStrictEqual(app.store, saved, 'preview/cancel never save');
app.tap(app.run('getSettingsActions(layout).appearance'));
app.tap(actions(app).rows.ink);
app.tap(actions(app).use);
assert.equal(app.run('state.appearancePreview'), null);
assert.equal(app.store[A.KEY].selected, 'ink');
assert.deepStrictEqual(clone(app.run('state.challenge')), initial);
assert.deepStrictEqual(app.store[C.KEY], saved[C.KEY]);
assert.equal(boot(app.store).run('state.appearance.selected'), 'ink');

// Interrupting a preview or press cannot equip a skin, or leave the modal blocking input.
app.tap(app.run('getSettingsActions(layout).appearance'));
app.tap(actions(app).rows.neon);
app.handlers.Hide(); app.handlers.Show({});
assert.equal(app.run('state.appearancePreview'), null);
assert.equal(app.run('state.appearance.selected'), 'ink');
app.tap(app.run('getSettingsActions(layout).close'));
assert.equal(app.run('state.settingsOpen'), false);
for (const query of [{ mode: 'gravity' }, { challenge: '1', level: '13', rule: String(C.level(12).rule) }]) {
  const routed = boot({ fangcunTutorialSeen: true }); openAppearance(routed);
  routed.tap(actions(routed).rows.neon);
  routed.handlers.Show({ query });
  assert.equal(routed.run('state.appearancePreview'), null, 'a new share route dismisses any uncommitted preview');
  assert.equal(routed.run('state.appearance.selected'), 'classic');
  assert.equal(routed.run('state.settingsOpen'), false);
}

// Only three distinct regular wins count. Replays, daily and invitations do not add unlocks.
const wins = boot({ fangcunTutorialSeen: true });
for (const id of [0, 0, 1]) {
  wins.run(`startChallenge(${id});state.mechanicGuide=null`); wins.complete();
  assert.equal(wins.run('state.appearance.neonUnlocked'), false);
}
wins.run('startChallenge(2);state.mechanicGuide=null'); wins.complete();
assert.equal(wins.run('state.appearance.neonUnlocked'), true);
assert.equal(wins.store[A.KEY].neonUnlocked, true);
openAppearance(wins); wins.tap(actions(wins).rows.neon); wins.tap(actions(wins).use);
assert.equal(wins.store[A.KEY].selected, 'neon');
for (const kind of ['daily', 'invitation']) {
  const isolated = boot({ fangcunTutorialSeen: true });
  isolated.run(`state.challengeProgress.stars[0]=1;state.challengeProgress.stars[1]=1;
    startChallenge(2);state.mechanicGuide=null;
    state.challenge.${kind === 'daily' ? "dailyDate='2026-10-03'" : 'invited=true'}`);
  isolated.complete();
  assert.equal(isolated.run('state.appearance.neonUnlocked'), false, kind);
}

// Failed cosmetic saves reuse the normal retry queue, preserving all gameplay storage.
const fault = { write: false }, retry = boot({}, { fault });
openAppearance(retry); retry.tap(actions(retry).rows.ink);
const protectedBefore = clone(retry.store);
fault.write = true; retry.tap(actions(retry).use);
assert.equal(retry.run('state.savePending'), true);
assert.equal(retry.run('state.appearance.selected'), 'ink');
assert.deepStrictEqual(retry.store, protectedBefore);
fault.write = false; retry.run('retrySaves()');
assert.equal(retry.store[A.KEY].selected, 'ink');
assert.equal(retry.run('state.savePending'), false);
const api = { getStorageSync: () => null, setStorageSync: () => { throw Error('full'); } };
assert.equal(A.load(api, { stars: [1, 1, 1] }).neonUnlocked, true);
assert(storage.hasPending(api), 'old-player unlock also retries on storage failure');

// All palettes use readable text and preserve the default appearance exactly.
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map(s => parseInt(s, 16) / 255)
    .map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a, b) { const [lo, hi] = [luminance(a), luminance(b)].sort((a, b) => a - b); return (hi + .05) / (lo + .05); }
for (const id of A.SKINS.map(s => s.id)) for (const blue of [false, true]) {
  const p = themes.palette(id, blue);
  for (const bg of [p.background, p.panel, p.trayBackground, p.traySelected])
    for (const fg of [p.text, p.secondaryText, p.accent]) assert(contrast(fg, bg) >= 4.5, `${id} ${fg} on ${bg}`);
  assert(contrast(p.onPrimary, p.primaryButton) >= 4.5);
  assert(contrast(p.alertText, p.trayBackground) >= 4.5);
  assert(contrast(p.block, p.emptyCell) >= 3 || id === 'classic', 'new skins distinguish occupied cells');
}
assert.equal(themes.palette('classic').background, '#EEEADD');
assert.equal(themes.palette('classic', true).primaryButton, '#354FBE');
assert.equal(themes.gravity('classic').bg, '#FAF9F2');

for (const [w, h, top, bottom] of [[320, 568, 20, 548], [375, 667, 20, 647], [390, 844, 44, 810], [430, 932, 47, 898]]) {
  const layout = createLayout(w, h, { top, bottom }, null, MODES.easy);
  const a = getAppearanceActions(layout), settings = getSettingsActions(layout);
  for (const r of [a.panel, a.close, a.use, ...Object.values(a.rows), ...Object.values(settings)]) {
    assert(r.x >= 0 && r.x + r.width <= w && r.y >= top && r.y + r.height <= bottom);
    assert(r.width >= 44 && r.height >= 44);
  }
  const rows = ['sound', 'music', 'vibration', 'guide', 'appearance', 'feedback', 'restart', 'menu'].map(k => settings[k]);
  rows.forEach((r, i) => { if (i) assert(rows[i - 1].y + rows[i - 1].height <= r.y); });
  assert(a.rows.neon.y + a.rows.neon.height < a.use.y - 24);
  const compact = boot({}, { size: { w, h } }); openAppearance(compact);
  for (const id of ['classic', 'ink', 'neon']) {
    compact.tap(actions(compact).rows[id]);
    for (const label of compact.draw()) assert(label.x >= 0 && label.x <= w && label.y >= 0 && label.y <= h);
  }
}

// Native feedback is removed under previews and rebuilt using the saved palette after cancel/use.
const native = [];
const feedbackApp = boot({}, { api: { createFeedbackButton(options) {
  const record = { options, destroyed: false }; native.push(record);
  return { onTap() {}, show() {}, destroy() { record.destroyed = true; } };
} } });
feedbackApp.tap(feedbackApp.run('getHomeActions(layout).settings')); feedbackApp.draw();
assert.equal(native.at(-1).destroyed, false);
feedbackApp.tap(feedbackApp.run('getSettingsActions(layout).appearance')); feedbackApp.draw();
assert.equal(native.at(-1).destroyed, true);
feedbackApp.tap(actions(feedbackApp).rows.ink); feedbackApp.tap(actions(feedbackApp).use); feedbackApp.draw();
assert.equal(native.at(-1).options.style.backgroundColor, themes.palette('ink').surfaceMuted);
assert.equal(native.at(-1).options.style.color, themes.palette('ink').text);

// Switching appearance is read-only in gravity; ordinary saves and the random stream are untouched.
const gravityApp = boot({ fangcunTutorialSeen: true }); gravityApp.run('openGravity()');
const gravityBefore = clone(gravityApp.run('gravityMode.model.run'));
openAppearance(gravityApp); gravityApp.tap(actions(gravityApp).rows.ink); gravityApp.tap(actions(gravityApp).use);
gravityApp.draw();
assert.deepStrictEqual(clone(gravityApp.run('gravityMode.model.run')), gravityBefore);
gravityApp.tap(gravityApp.run('getSettingsActions(layout).close'));
assert(gravityApp.draw().some(t => t.text === '落玉庭' && t.color === themes.gravity('ink').text));
const playResults = [];
for (const id of ['classic', 'ink', 'neon']) {
  const seeded = boot({ fangcunTutorialSeen: true, [A.KEY]: { version: 1, selected: id, neonUnlocked: true } });
  seeded.run('startChallenge(12);state.mechanicGuide=null');
  for (const move of C.level(12).solution) seeded.move(move);
  const result = clone(seeded.run('state.challenge'));
  delete result.undoBudget.attemptId; // Each fresh attempt has its own anti-replay identifier.
  playResults.push(result);
}
assert.deepStrictEqual(playResults[0], playResults[1]); assert.deepStrictEqual(playResults[1], playResults[2]);
themes.apply({ appearance: { selected: 'neon' } });
const beforeShare = { ...COLORS }, card = sharing.menuCard(gravityApp.run('currentShareState()'));
const context = new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) });
sharing.drawCard(context, card);
assert.deepStrictEqual(COLORS, beforeShare, 'sharing restores the active palette');
themes.apply({});
console.log('PASS: appearance preview/apply/cancel, permanent distinct-level unlock, isolated saves, retry, native feedback, four screen sizes, contrast and identical game results');
