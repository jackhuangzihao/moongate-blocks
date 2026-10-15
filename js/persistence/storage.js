// Keep the latest failed value for each key, including after leaving a game.
const queues = new WeakMap();
function queue(api) {
  if (!queues.has(api)) queues.set(api, new Map());
  return queues.get(api);
}
function read(api, key, fallback) {
  if (queue(api).has(key)) return JSON.parse(JSON.stringify(queue(api).get(key)));
  try { const value = api.getStorageSync(key); return value === undefined || value === '' ? fallback : value; }
  catch (_) { return fallback; }
}
function write(api, key, value) {
  const pending = queue(api);
  // The caller may keep editing its board/progress after this write fails.
  pending.set(key, JSON.parse(JSON.stringify(value)));
  try { api.setStorageSync(key, pending.get(key)); pending.delete(key); return true; }
  catch (_) { return false; }
}
function retry(api) {
  for (const [key, value] of queue(api)) write(api, key, value);
  return !hasPending(api);
}
function hasPending(api) { return queue(api).size > 0; }
module.exports = { read, write, retry, hasPending };
