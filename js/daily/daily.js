const Challenges = require('../challenge/challenges');
const Storage = require('../persistence/storage');
const KEY = 'fangcunDailyV1';
const DAY = 86400000;
// Keep this list stable: appending chapter levels must not change today's puzzle.
const POOL = [3, 4, 5, 6, 7, 12, 13, 17, 19, 22, 24, 28, 32, 36, 38, 40, 42, 44];
const DEDICATED_FROM = '2026-10-05';
const DEDICATED_PERIOD = 28; // New banks need a dated schedule; appending puzzles must not remap old dates.
const WEEKLY_FROM = '2026-10-13';
const LEGACY_WEEKLY_IDS = [-29,-30,-31,-32,-33,-34,-35];
const WEEKLY_IDS = [-36,-37,-38,-39,-40,-41,-42]; // Monday to Sunday; never reorder existing dates.
function dayNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = Date.parse(date + 'T00:00:00.000Z');
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date ? value / DAY : null;
}
function dateKey(now = Date.now()) {
  const value = now instanceof Date ? now.getTime() : now;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const shifted = new Date(value + 8 * 3600000);
  if (!Number.isFinite(shifted.getTime())) return null;
  const key = shifted.toISOString().slice(0, 10);
  return dayNumber(key) === null ? null : key;
}
function levelFor(date) {
  const day = dayNumber(date);
  if (day === null) return null;
  if (date >= WEEKLY_FROM) return WEEKLY_IDS[(day + 3) % 7];
  if (date >= DEDICATED_FROM) return -((day - dayNumber(DEDICATED_FROM)) % DEDICATED_PERIOD) - 1;
  return POOL[((day % POOL.length) + POOL.length) % POOL.length];
}
function matchesDate(date, level) {
  const day=dayNumber(date);
  if(day===null || !Number.isInteger(level))return false;
  if(levelFor(date)===level)return true;
  if(date>=WEEKLY_FROM && level===LEGACY_WEEKLY_IDS[(day+3)%7])return true;
  // Players can update after rollout. Accept only the old bank's exact dated
  // assignment, never arbitrary puzzle/date pairs from a save or share link.
  return date>=DEDICATED_FROM && level===-((day-dayNumber(DEDICATED_FROM))%DEDICATED_PERIOD)-1;
}
function restore(saved) {
  if (!saved || !matchesDate(saved.date,saved.level)
    || !Challenges.level(saved.level) || saved.rule !== Challenges.level(saved.level).rule) return null;
  const run = Challenges.restore(saved);
  if (run) {
    run.dailyDate = saved.date;
    if (Number.isInteger(saved.benchmarkSteps) && saved.benchmarkSteps > 0
      && saved.benchmarkSteps <= Challenges.level(run.level).limit) run.benchmarkSteps = saved.benchmarkSteps;
  }
  return run;
}
function checkpoint(run) {
  if (!run || !matchesDate(run.dailyDate,run.level)) return null;
  const saved = Challenges.checkpoint(run);
  if (!saved) return null;
  const benchmark = Number.isInteger(run.benchmarkSteps) && run.benchmarkSteps > 0
    && run.benchmarkSteps <= Challenges.level(run.level).limit && (run.rule === undefined || run.rule === saved.rule);
  return { date: run.dailyDate, ...saved, ...(benchmark ? { benchmarkSteps: run.benchmarkSteps } : {}) };
}
function normalize(stored) {
  const progress = { version: 1, active: null, records: [], marks: {} };
  if (!stored || stored.version !== 1) return progress;
  // One 31-bit month mask keeps lifetime stamps separate from the 30 detailed results.
  // Calendar months are limited to 2000–2099: at most 1,200 small integer entries.
  if (stored.marks && typeof stored.marks === 'object' && !Array.isArray(stored.marks)) {
    for (const [month, bits] of Object.entries(stored.marks)) {
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(bits) || bits < 0 || bits > 0x7fffffff) continue;
      const days = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).getUTCDate();
      const valid = bits & (2 ** days - 1);
      if (valid) progress.marks[month] = valid;
    }
  }
  const active = restore(stored.active);
  if (active) progress.active = checkpoint(active);
  const records = new Map();
  if (Array.isArray(stored.records)) for (const record of stored.records) {
    if (!record || !matchesDate(record.date,record.level)) continue;
    // A later puzzle revision must not erase an already-earned stamp or old best.
    if (!Number.isInteger(record.rule) || record.rule < 1 || record.rule > 9999 || !Number.isInteger(record.bestSteps)
      || record.bestSteps < 1 || record.bestSteps > 999) continue;
    const month=record.date.slice(0,7), bit=2 ** (Number(record.date.slice(-2))-1);
    if (/^20\d{2}/.test(record.date)) progress.marks[month]=(progress.marks[month]||0)|bit;
    const key=`${record.date}:${record.level}:${record.rule}`;
    const previous = records.get(key);
    if (!previous || record.bestSteps < previous.bestSteps) {
      records.set(key, { date: record.date, level: record.level, rule: record.rule, bestSteps: record.bestSteps });
    }
  }
  progress.records = [...records.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return progress;
}
function load(wx) {
  try { return normalize(Storage.read(wx, KEY, null)); }
  catch (_) { return normalize(null); }
}
function entryLevel(progress,date) {
  const active=progress && progress.active && progress.active.date===date && restore(progress.active);
  return active ? active.level : levelFor(date);
}
function start(progress, date = dateKey()) {
  const level = levelFor(date);
  if (level === null) return null;
  const active = progress && progress.active && progress.active.date === date ? restore(progress.active) : null;
  if (active) return active;
  const run = Challenges.start(level);
  run.dailyDate = date;
  return run;
}
function update(progress, run) {
  const next = normalize(progress);
  if (!run || !matchesDate(run.dailyDate,run.level)) return next;
  next.active = checkpoint(run);
  if (run.won) next.records.push({ date: run.dailyDate, level: run.level,
    rule: Challenges.level(run.level).rule, bestSteps: run.history.length });
  return normalize(next);
}
function completedOn(progress, date) {
  if (dayNumber(date) === null) return false;
  return Boolean((normalize(progress).marks[date.slice(0,7)] || 0) & 2 ** (Number(date.slice(-2))-1));
}
function completedCount(progress) {
  let count=0;
  for(let bits of Object.values(normalize(progress).marks)) while(bits){bits&=bits-1;count++;}
  return count;
}
module.exports = { KEY, DEDICATED_FROM, WEEKLY_FROM, WEEKLY_IDS, dateKey, levelFor, matchesDate, entryLevel, restore, checkpoint, normalize, load, start, update, completedOn, completedCount };
