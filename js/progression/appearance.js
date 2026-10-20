const storage = require('../persistence/storage');

const KEY = 'fangcunAppearanceV1';
const SKINS = Object.freeze([
  Object.freeze({ id: 'classic', name: '清雅原色', detail: '温润青绿 · 原有外观' }),
  Object.freeze({ id: 'ink', name: '水墨黑白', detail: '素纸墨色 · 免费使用' }),
  Object.freeze({ id: 'neon', name: '暗色霓虹', detail: '深蓝夜色 · 青玉微光' })
]);

function validId(id) { return SKINS.some(skin => skin.id === id); }
function completedLevels(progress) {
  return progress && Array.isArray(progress.stars)
    ? progress.stars.filter(stars => Number.isInteger(stars) && stars >= 1 && stars <= 3).length : 0;
}
function unlocked(id, preference) {
  return validId(id) && (id !== 'neon' || Boolean(preference && preference.neonUnlocked));
}
function normalize(value, progress) {
  const saved = value && value.version === 1 ? value : {};
  const preference = { version: 1, selected: 'classic',
    neonUnlocked: saved.neonUnlocked === true || completedLevels(progress) >= 3 };
  if (unlocked(saved.selected, preference)) preference.selected = saved.selected;
  return preference;
}
function load(api, progress) {
  const saved = storage.read(api, KEY);
  const preference = normalize(saved, progress);
  // Old players receive the permanent unlock from existing progress, once.
  if (preference.neonUnlocked && !(saved && saved.version === 1 && saved.neonUnlocked === true))
    storage.write(api, KEY, preference);
  return preference;
}
function unlockFromProgress(preference, progress) {
  if (preference.neonUnlocked || completedLevels(progress) < 3) return false;
  preference.neonUnlocked = true;
  return true;
}

module.exports = { KEY, SKINS, validId, completedLevels, unlocked, normalize, load, unlockFromProgress };
