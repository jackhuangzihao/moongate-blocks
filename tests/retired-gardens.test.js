const assert = require('assert');
const { boot, clone, protectedStore, protectedState } = require('./helpers/game-harness');
const { MODE_ORDER, MODES } = require('../js/config');
const saves = require('../js/persistence/saves');
assert.deepStrictEqual(MODE_ORDER, ['easy', 'medium', 'hard']);
const messages = [];
for (const mode of ['long', 'courtyard']) {
  // Build an old genuine save, then relaunch as an upgraded user with that selected map.
  const legacy = boot({ ...protectedStore(), fangcunTutorialSeen: true });
  legacy.run(`state.mode='${mode}';continueOrStartGame();state.score=73;saveCurrentGame()`);
  legacy.store.fangcunGameModeV2 = mode;
  legacy.store.fangcunGameMode = 'hard'; // Oldest legacy setting must not override the new default.
  legacy.store[MODES[mode].bestKey] = 888;
  const oldSave = clone(legacy.store[saves.keyFor(mode)]), before = protectedState(legacy.store);
  messages.length = 0;
  const app = boot(legacy.store, { api: {
    getOpenDataContext: () => ({ canvas: {}, postMessage: message => messages.push(message) }),
    getSetting: options => options.success({ authSetting: { 'scope.WxFriendInteraction': true } }),
    authorize: options => options.success()
  } });
  assert.equal(app.run('state.mode'), 'easy');
  assert.equal(app.run('state.freeMode'), 'easy');
  assert.equal(app.run(`state.savedGames.${mode}`), undefined);
  app.tap(app.run('getHomeActions(layout).choose'));
  assert.deepStrictEqual(Object.keys(app.run('getMenuActions(layout)')), MODE_ORDER);
  const labels = app.draw().map(item => item.text);
  assert.ok(!labels.some(text => text.includes('长庭') || text.includes('曲院')));
  // Even a stale ranking caller falls back to an available tab.
  app.run(`leaderboard.open(wx,layout,'${mode}',state.bestScores)`);
  assert.equal(messages.filter(message => message.type === 'show').at(-1).key, MODES.easy.bestKey);
  app.run('leaderboard.close()');
  app.tap(app.run('getMenuActions(layout).easy'));
  assert.equal(app.run('state.board.length'), 9);
  assert.equal(app.run('state.board[0].length'), 9);
  app.handlers.Hide();
  assert.deepStrictEqual(app.store[saves.keyFor(mode)], oldSave);
  assert.equal(app.store[MODES[mode].bestKey], 888);
  assert.deepStrictEqual(protectedState(app.store), before);
  for (const message of messages.filter(message => message.type === 'sync')) {
    assert.ok(!Object.hasOwn(message.scores, MODES[mode].bestKey));
  }
}
console.log('PASS: retired garden selection fallback, hidden entries/ranking, old saves preserved, other progression untouched');
