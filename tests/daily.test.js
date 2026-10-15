const assert = require('assert');
const { execFileSync } = require('child_process');
const Daily = require('../js/daily/daily');
const Challenges = require('../js/challenge/challenges');
const Storage = require('../js/persistence/storage');
const clone = value => JSON.parse(JSON.stringify(value));
const beforeMidnight = Date.parse('2026-10-03T15:59:59.999Z');
assert.equal(Daily.dateKey(beforeMidnight), '2026-10-03');
assert.equal(Daily.dateKey(beforeMidnight + 1), '2026-10-04');
assert.equal(Daily.dateKey(new Date(beforeMidnight)), '2026-10-03');
for (const value of [null, undefined, NaN, Infinity, '2026-10-03', {}, new Date(NaN)]) {
  if (value !== undefined) assert.equal(Daily.dateKey(value), null);
}
for (const date of ['2026-02-29', '2026-13-01', '2026-10-00', '2026-2-01', null, {}, 1]) {
  assert.equal(Daily.levelFor(date), null);
  assert.equal(Daily.start(null, date), null);
}
assert.ok(Number.isInteger(Daily.levelFor('2028-02-29')));
for (const timezone of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland']) {
  const script = `const d=require('./js/daily/daily');console.log(d.dateKey(${beforeMidnight}),d.levelFor(d.dateKey(${beforeMidnight})))`;
  assert.equal(execFileSync(process.execPath, ['-e', script], { cwd: require('path').resolve(__dirname, '..'),
    env: { ...process.env, TZ: timezone }, encoding: 'utf8' }).trim(),
    `2026-10-03 ${Daily.levelFor('2026-10-03')}`);
}

// Daily saves and wins never write chapter progression. Every selected puzzle is authored and winnable.
const normal = Challenges.load({ getStorageSync: () => null }), normalBefore = clone(normal);
let progress = Daily.normalize(null);
for (let day = 1; day <= 45; day++) {
  const date = Daily.dateKey(Date.UTC(2026, 9, day));
  let run = Daily.start(progress, date), level = Challenges.level(run.level);
  assert.deepStrictEqual(run.tray, Challenges.start(run.level).tray);
  assert.ok(Challenges.play(run, ...level.solution[0]));
  run.failedOnce = true;
  progress = Daily.update(progress, run);
  assert.equal(progress.active.failedOnce, true);
  assert.deepStrictEqual(Daily.start(progress, date), run);
  run = Daily.restore(progress.active);
  for (const move of level.solution.slice(1)) assert.ok(Challenges.play(run, ...move));
  assert.ok(run.won);
  progress = Daily.update(progress, run);
  assert.equal(progress.active, null);
  assert.equal(progress.records[0].date, date);
  assert.equal(progress.records[0].bestSteps, run.history.length);
  assert.deepStrictEqual(Daily.update(progress, run), progress, 'One completion stamp per date');
  assert.equal(Daily.start(progress, date).history.length, 0, 'Completed daily can be replayed');
}
assert.equal(progress.records.length, 30);
assert.equal(Daily.completedCount(progress), 45);
assert.equal(Daily.completedOn(progress,'2026-10-01'),true);
assert.deepStrictEqual(normal, normalBefore);
const today = '2026-11-16', yesterday = '2026-11-15';
let oldRun = Daily.start(progress, yesterday);
Challenges.play(oldRun, ...Challenges.level(oldRun.level).solution[0]);
progress = Daily.update(progress, oldRun);
assert.deepStrictEqual(Daily.start(progress, yesterday), oldRun);
const newRun = Daily.start(progress, today);
assert.equal(newRun.dailyDate, today);
assert.equal(newRun.history.length, 0, 'Yesterday unfinished is not restored as today');
for (const move of Challenges.level(oldRun.level).solution.slice(1)) Challenges.play(oldRun, ...move);
progress = Daily.update(progress, oldRun);
assert.ok(progress.records.some(record => record.date === yesterday), 'Running yesterday may finish after midnight');
assert.ok(!progress.records.some(record => record.date === today));

const date = '2026-10-03', run = Daily.start(null, date), level = Challenges.level(run.level);
Challenges.play(run, ...level.solution[0]);
const saved = Daily.checkpoint(run);
for (const corrupt of [null, { ...saved, date: 'not-a-date' }, { ...saved, level: String(saved.level) },
  { ...saved, level: 0 }, { ...saved, rule: 0 }, { ...saved, history: [[0, -99, 0]] },
  { ...saved, history: [null] }, { ...saved, history: {} }]) assert.equal(Daily.restore(corrupt), null);
assert.equal(Daily.checkpoint({ ...run, dailyDate: null }), null);
assert.equal(Daily.normalize({ version: 99, active: saved }).active, null);
const record = { date, level: run.level, rule: level.rule, bestSteps: level.par };
const records = Daily.normalize({ version: 1, active: { ...saved, rule: 0 }, records: [record,
  { ...record, bestSteps: level.par + 1 }, { ...record, bestSteps: 0 }, { ...record, bestSteps: 1000 },
  { ...record, rule: 0 }, { ...record, level: 0 }, { ...record, date: 'bad' }, null] });
assert.deepStrictEqual(records.records, [record]); assert.equal(records.active, null); assert.equal(Daily.completedCount(records), 1);
const slower = Daily.normalize({ version: 1, records: [{ ...record, bestSteps: level.limit }] });
const replay = Daily.start(slower, date);
for (const move of level.solution) Challenges.play(replay, ...move);
assert.equal(Daily.update(slower, replay).records[0].bestSteps, level.solution.length);
assert.equal(slower.records[0].bestSteps, level.limit, 'Helpers do not mutate the caller state');

const memory = { [Challenges.KEY]: normalBefore };
let failing = true;
const wx = { getStorageSync: key => memory[key], setStorageSync: (key, value) => {
  if (failing) throw Error('full'); memory[key] = clone(value);
} };
const active = Daily.update(null, run);
assert.equal(Storage.write(wx, Daily.KEY, active), false);
assert.deepStrictEqual(Daily.load(wx), active, 'Pending daily write remains available before retry');
failing = false; assert.equal(Storage.retry(wx), true);
assert.deepStrictEqual(Daily.load(wx), active);
assert.deepStrictEqual(memory[Challenges.KEY], normalBefore);
assert.deepStrictEqual(Daily.load({ getStorageSync: () => { throw Error('unavailable'); } }), Daily.normalize(null));
console.log('PASS: Beijing midnight/timezone stability, fixed authored daily puzzles, separate resume/stamps, 30-day history, corruption guards and storage retry');

// Updating a puzzle never erases historical results or lifetime completion stamps.
const oldDate='2026-10-03',oldId=Daily.levelFor(oldDate),oldLevel=Challenges.level(oldId);
const oldRecord={date:oldDate,level:oldId,rule:oldLevel.rule+1,bestSteps:oldLevel.limit+5};
const migrated=Daily.normalize({version:1,records:[oldRecord]});
assert.deepStrictEqual(migrated.records,[oldRecord]);
assert.equal(Daily.completedCount(migrated),1);assert.equal(Daily.completedOn(migrated,oldDate),true);
assert.equal(Daily.completedOn(migrated,'invalid'),false);
const malformed=Daily.normalize({version:1,marks:{'2026-02':0x7fffffff,'2028-02':0x7fffffff,
  '2026-13':1,'2026-10':-1,'2026-11':3.5,'__proto__':999,'3026-12':1}});
assert.equal(Daily.completedCount(malformed),57,'February masks exclude nonexistent days, including leap years');
assert.equal(Daily.completedOn(malformed,'2026-02-28'),true);
assert.equal(Daily.completedOn(malformed,'2026-02-29'),false);
assert.equal(Daily.completedOn(malformed,'2028-02-29'),true);
assert.equal(Daily.completedCount(Daily.normalize(progress)),Daily.completedCount(progress),'Reopening does not recount records');
assert.ok(JSON.stringify(Daily.normalize(progress)).length<8000,'Detailed history remains bounded');
console.log('PASS: old-rule best scores retained, permanent month stamps, calendar masks and repeated migration');

// A daily invitation benchmark survives background recovery only with its exact puzzle/date/rule.
for (const benchmarkDate of ['2026-10-03', '2026-10-05']) {
  const invited = Daily.start(null, benchmarkDate), puzzle = Challenges.level(invited.level);
  Challenges.play(invited, ...puzzle.solution[0]);
  const legacy = Daily.checkpoint(invited);
  invited.benchmarkSteps = puzzle.limit;
  const checkpoint = Daily.checkpoint(invited);
  assert.equal(checkpoint.benchmarkSteps, puzzle.limit);
  assert.deepStrictEqual(Daily.restore(checkpoint), invited);
  assert.deepStrictEqual(Daily.start(Daily.update(null, invited), benchmarkDate), invited);
  assert.equal(Daily.start(Daily.update(null, invited), '2026-10-07').benchmarkSteps, undefined, 'another day never inherits the challenge score');
  assert.equal(Daily.restore(legacy).benchmarkSteps, undefined, 'old saves have no fabricated benchmark');
  for (const benchmarkSteps of [null, 0, -1, '2', [], {}, 1.5, Infinity, NaN, puzzle.limit + 1]) {
    assert.deepStrictEqual(Daily.checkpoint({ ...invited, benchmarkSteps }), legacy);
    assert.deepStrictEqual(Daily.checkpoint(Daily.restore({ ...checkpoint, benchmarkSteps })), legacy, 'bad optional comparison does not discard a good save');
  }
  assert.equal(Daily.restore({ ...checkpoint, rule: puzzle.rule + 1 }), null);
  assert.equal(Daily.restore({ ...checkpoint, date: '2026-10-07' }), null);
  assert.equal(Daily.checkpoint({ ...invited, dailyDate: '2026-10-07' }), null);
  assert.deepStrictEqual(Daily.checkpoint({ ...invited, rule: puzzle.rule + 1 }), legacy, 'an obsolete rule cannot attach a comparison to a new puzzle');
  assert.equal(Daily.checkpoint({ ...invited, rule: puzzle.rule }).benchmarkSteps, puzzle.limit);
}
console.log('PASS: daily benchmark save/resume, date/rule binding, invalid optional values and legacy saves');
