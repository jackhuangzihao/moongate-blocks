// 好友资料只在开放数据域读取和绘制，不传回主域。
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext('2d');
let view = null, rows = [], page = 0, request = 0, message = '';
let pending = {}, syncing = false, syncFailed = false, afterSync = null;
function scoreOf(value) {
  try { const score = JSON.parse(value).wxgame.score; return Number.isSafeInteger(score) && score >= 0 ? score : null; }
  catch (_) { return null; }
}
function sync() {
  if (syncing) return;
  const batch = pending, keys = Object.keys(batch);
  if (!keys.length) { if (afterSync) { const next = afterSync; afterSync = null; next(); } return; }
  pending = {}; syncing = true;
  function finish(failed) {
    syncing = false; syncFailed = failed;
    if (failed) {
      keys.forEach(key => { pending[key] = Math.max(pending[key] || 0, batch[key]); });
      if (afterSync) { const next = afterSync; afterSync = null; next(); }
    } else sync();
  }
  wx.getUserCloudStorage({ keyList: keys, success(result) {
    const old = {};
    (result.KVDataList || []).forEach(item => { old[item.key] = scoreOf(item.value) || 0; });
    const KVDataList = keys.filter(key => batch[key] > (old[key] || 0)).map(key => ({ key,
      value: JSON.stringify({ wxgame: { score: batch[key], update_time: Math.floor(Date.now() / 1000) } }) }));
    if (!KVDataList.length) { finish(false); return; }
    wx.setUserCloudStorage({ KVDataList, success: () => finish(false), fail: () => finish(true) });
  }, fail: () => finish(true) });
}
function pageSize() { return Math.max(1, Math.floor((view.height - 76) / 44)); }
function draw() {
  if (!view) return;
  const { width, height, colors } = view;
  ctx.fillStyle = colors.panel; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.secondaryText; ctx.textAlign = 'center'; ctx.font = '12px sans-serif';
  ctx.fillText(syncFailed ? '成绩同步失败，刷新后重试' : '同地图最高分 · 同分并列', width / 2, 24);
  ctx.font = '14px sans-serif';
  if (message) { ctx.fillText(message, width / 2, 76, width - 20); return; }
  if (!rows.length) { ctx.fillText('还没有好友的本地图成绩', width / 2, 76); return; }
  const size = pageSize();
  page = Math.max(0, Math.min(page, Math.ceil(rows.length / size) - 1));
  rows.slice(page * size, (page + 1) * size).forEach((row, index) => {
    const y = 64 + index * 44;
    ctx.fillStyle = colors.text; ctx.textAlign = 'left';
    ctx.fillText(String(row.rank), 12, y);
    const name = Array.from(row.nickname || '微信玩家').slice(0, 10).join('');
    ctx.save(); ctx.beginPath(); ctx.rect(46, y - 20, width - 130, 36); ctx.clip();
    ctx.fillText(name, 46, y); ctx.restore();
    ctx.textAlign = 'right'; ctx.fillText(String(row.score), width - 12, y, 70);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = colors.secondaryText; ctx.font = '12px sans-serif';
  ctx.fillText(`${page + 1} / ${Math.ceil(rows.length / size)} 页`, width / 2, height - 16);
}
function load(token) {
  if (!view || token !== request) return;
  const key = view.key;
  wx.getFriendCloudStorage({ keyList: [key], success(result) {
    if (!view || token !== request) return;
    rows = (result.data || []).map(user => {
      const value = (user.KVDataList || []).find(item => item.key === key);
      return { nickname: user.nickname, score: value ? scoreOf(value.value) : null };
    }).filter(user => user.score !== null).sort((a, b) => b.score - a.score);
    rows.forEach((row, i) => { row.rank = i && row.score === rows[i - 1].score ? rows[i - 1].rank : i + 1; });
    message = ''; draw();
  }, fail() { if (view && token === request) { message = '加载失败，请点下方重试 / 刷新'; draw(); } } });
}
wx.onMessage(data => {
  if (data.type === 'sync') {
    Object.entries(data.scores || {}).forEach(([key, score]) => {
      if (/^fangcunBest[\w]+$/.test(key) && Number.isSafeInteger(score) && score > 0)
        pending[key] = Math.max(pending[key] || 0, score);
    });
    sync();
  } else if (data.type === 'show') {
    view = data; page = 0; rows = []; message = '正在加载…'; const token = ++request;
    canvas.width = Math.round(data.width * 2); canvas.height = Math.round(data.height * 2);
    ctx.setTransform(2, 0, 0, 2, 0, 0); draw();
    afterSync = () => load(token); sync();
  } else if (data.type === 'page' && view) { page += data.delta === 1 ? 1 : -1; draw(); }
  else if (data.type === 'hide') { view = null; request++; afterSync = null; }
});
