// Attempt-wide budget: board rollback must never refund a spent opportunity.
const MAX_GRANTS = 2;
let sequence = 0;
function create() {
  return { version: 1, attemptId: `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,10)}`, spent: 0, grants: 0 };
}
function valid(value) {
  return Boolean(value && value.version === 1 && typeof value.attemptId === 'string'
    && /^[a-z0-9-]{1,80}$/.test(value.attemptId)
    && Number.isInteger(value.grants) && value.grants >= 0 && value.grants <= MAX_GRANTS
    && Number.isInteger(value.spent) && value.spent >= 0 && value.spent <= 1 + value.grants);
}
function normalize(value) {
  if (value === undefined) return create(); // Legacy save, persisted at its next checkpoint.
  if (valid(value)) {
    return { version: 1, attemptId: value.attemptId, spent: value.spent, grants: value.grants };
  }
  // Damaged metadata must not erase a valid board or grant extra opportunities.
  return { ...create(), spent: 3, grants: MAX_GRANTS };
}
function remaining(budget) { return budget === undefined ? 1 : valid(budget) ? 1 + budget.grants - budget.spent : 0; }
function current(state) { return state.challenge ? state.challenge.undoBudget : state.undoBudget; }
function hasHistory(state) {
  return state.screen === 'playing' && !state.gardenIntro && (state.challenge
    ? !state.challenge.won && state.challenge.history.length > 0
    : !state.gameOver && Boolean(state.gardenUndo));
}
function canSupplement(state) {
  const budget = current(state);
  return Boolean(hasHistory(state) && state.videoToolsEnabled && !(state.challenge && state.challenge.dailyDate)
    && budget && remaining(budget) === 0 && budget.grants < MAX_GRANTS);
}
function spend(budget) { return valid(budget) && remaining(budget) > 0 ? { ...budget, spent: budget.spent + 1 } : null; }
function grant(budget) {
  return valid(budget) && remaining(budget) === 0 && budget.grants < MAX_GRANTS ? { ...budget, grants: budget.grants + 1 } : null;
}
module.exports = { MAX_GRANTS, create, normalize, remaining, current, hasHistory, canSupplement, spend, grant };
