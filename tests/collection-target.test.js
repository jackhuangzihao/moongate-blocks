const assert = require('assert');
const K = require('../js/progression/collection');
const clone = value => JSON.parse(JSON.stringify(value));

const old = { version: 1, clears: 20, seen: ['bamboo'], hidden: ['plum'], achievements: ['arbour'], dailyCompletions: 5 };
const migrated = K.normalize(old);
assert.deepStrictEqual(migrated, old, 'old saves retain progress and visibility without inventing a selection');
assert.equal(K.target(migrated, 12), null);
for (const bad of ['unknown', 'constructor', {}, ['bridge'], 1, null]) {
  assert.equal(K.target(K.normalize({ ...old, target: bad }), 12), null);
  const before = clone(migrated);
  assert.equal(K.setTarget(migrated, bad, 12), false);
  assert.deepStrictEqual(migrated, before, 'invalid selection does not overwrite an existing save');
}

// Selection never unlocks an item or changes its current visibility.
const owned = K.unlocked(migrated, 12), shown = K.displayed(migrated, 12);
assert.equal(K.setTarget(migrated, 'plum', 12), false, 'owned items remain display toggles in the UI');
assert.ok(K.setTarget(migrated, 'lotus', 12));
assert.equal(K.target(migrated, 12).missing, 60);
assert.ok(K.progressLine(migrated, 12, 'stars').includes('荷花缸'), 'a target takes priority across categories');
assert.equal(K.setTarget(migrated, 'unknown', 12), false);
assert.equal(migrated.target, 'lotus');
assert.ok(K.setTarget(migrated, 'lotus', 12));
assert.equal(K.target(migrated, 12), null, 'tapping the selected locked item cancels it');
assert.ok(K.setTarget(migrated, 'lantern', 12));
assert.equal(K.target(migrated, 12).missing, 24);
assert.ok(K.setTarget(migrated, 'bridge', 12), 'a different locked item replaces the target');
assert.equal(K.target(migrated, 12).missing, 16);
assert.deepStrictEqual(K.unlocked(migrated, 12), owned);
assert.deepStrictEqual(K.displayed(migrated, 12), shown);
assert.equal(K.normalize(clone(migrated)).target, 'bridge', 'target survives relaunch');
assert.ok(K.progressLine(migrated, 12, 'clears').includes('每日精选再完成 16 天'));

// Reaching a target is announced before clearing it; acknowledging never removes rewards.
assert.ok(K.syncProgress(migrated, { dailyCompletions: 21 }));
assert.deepStrictEqual(K.target(migrated, 12), { item: K.ITEMS.find(i => i.id === 'bridge'), missing: 0, complete: true });
assert.equal(K.progressLine(migrated, 12, 'clears'), '目标达成 · 已获得「小桥」');
const earned = K.unlocked(migrated, 12);
assert.ok(K.setTarget(migrated, null, 12));
assert.equal(K.setTarget(migrated, null, 12), false);
assert.deepStrictEqual(K.unlocked(migrated, 12), earned);
assert.equal(K.target(K.normalize(clone(migrated)), 12), null);

// Chapter expansion cannot revoke the original four-chapter memorial.
const memorial = K.normalize({ version: 1, achievements: ['plaque'], target: 'plaque' });
assert.equal(K.requirement(K.ITEMS.find(i => i.id === 'plaque'), K.normalize(null), 180), '前四章基础三星 0/48 关');
assert.equal(K.target(memorial, 0).complete, true);
assert.equal(K.syncProgress(memorial, { allStars: false }), false);
assert.ok(K.unlocked(memorial, 0).includes('plaque'));

// Existing progress copy remains unchanged when no target is chosen.
const defaults = K.normalize(null);
assert.equal(K.progressLine(defaults, 0, 'clears'), '再消除 1 次，庭院将添「修竹」');
assert.equal(K.progressLine(defaults, 0, 'stars'), '再得 12 颗星，庭院将添「石灯」');
defaults.clears = 1;
assert.equal(K.progressLine(defaults, 0, 'clears'), '庭院新添「修竹」· 回首页看看');
console.log('Collection targets: migration, validation, replace/cancel, cross-track progress and permanent rewards passed');
