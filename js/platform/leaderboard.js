const { MODES, MODE_ORDER, COLORS } = require('../config');
const { roundedRect } = require('../views/canvas-ui');
let api, context, opened = false, modeIndex = 0, status = '', generation = 0;
let authorized = false;

function post(message) { context.postMessage(message); }
function connect(wx) {
  api = wx;
  try {
    if (!context && wx.getOpenDataContext) context = wx.getOpenDataContext();
    return Boolean(context);
  } catch (_) { return false; }
}
function sync(wx, scores) {
  if (!connect(wx)) return;
  const values = {};
  MODE_ORDER.forEach(id => {
    if (Number.isSafeInteger(scores[id]) && scores[id] > 0) values[MODES[id].bestKey] = scores[id];
  });
  try { post({ type: 'sync', scores: values }); } catch (_) { /* 下次结算、回前台或打开榜单再同步。 */ }
}
function actions(layout) {
  const x = 24, width = layout.width - 48;
  const top = Math.max(layout.safeTop + 100, layout.settingsY + 52);
  const bottom = layout.height - layout.safeBottom - 68;
  return {
    previousMap: { x, y: top, width: 48, height: 48 },
    nextMap: { x: layout.width - 72, y: top, width: 48, height: 48 },
    list: { x, y: top + 64, width, height: Math.max(100, bottom - top - 128) },
    previousPage: { x, y: bottom - 48, width: 76, height: 44 },
    refresh: { x: layout.width / 2 - 40, y: bottom - 48, width: 80, height: 44 },
    nextPage: { x: layout.width - 100, y: bottom - 48, width: 76, height: 44 },
    close: { x: layout.width / 2 - 80, y: bottom + 4, width: 160, height: 48 }
  };
}
function show(layout) {
  if (!opened || !authorized) return;
  status = '';
  const list = actions(layout).list;
  try { post({ type: 'show', key: MODES[MODE_ORDER[modeIndex]].bestKey,
    width: list.width, height: list.height, colors: COLORS }); }
  catch (_) { status = '暂时无法加载，请点击重试'; }
}
function authorize(layout) {
  const token = ++generation;
  status = '正在请求好友排行权限…';
  const success = () => { if (opened && token === generation) { authorized = true; show(layout); } };
  const fail = () => { if (opened && token === generation) status = '需要好友权限，请点击重试开启'; };
  if (!api.getSetting || !api.authorize) { status = '请在微信中查看好友排行'; return; }
  api.getSetting({ success(result) {
    if (!opened || token !== generation) return;
    const granted = result.authSetting['scope.WxFriendInteraction'];
    if (granted === true) success();
    else if (granted === false && api.openSetting) {
      api.openSetting({ success: result => result.authSetting['scope.WxFriendInteraction'] ? success() : fail(), fail });
    } else api.authorize({ scope: 'scope.WxFriendInteraction', success, fail });
  }, fail });
}
function open(wx, layout, mode, scores) {
  if (!connect(wx)) { if (wx.showToast) wx.showToast({ title: '请在微信中查看好友排行', icon: 'none' }); return; }
  opened = true; authorized = false; modeIndex = Math.max(0, MODE_ORDER.indexOf(mode));
  sync(wx, scores);
  authorize(layout);
}
function close() {
  opened = false; authorized = false; status = ''; generation++;
  try { if (context) post({ type: 'hide' }); } catch (_) {}
}
function hit(point, layout) {
  for (const [name, rect] of Object.entries(actions(layout))) {
    if (name === 'list' || point.x < rect.x || point.x > rect.x + rect.width || point.y < rect.y || point.y > rect.y + rect.height) continue;
    return { rect, action() {
      if (name === 'close') close();
      else if (name === 'previousMap' || name === 'nextMap') {
        modeIndex = (modeIndex + (name === 'nextMap' ? 1 : MODE_ORDER.length - 1)) % MODE_ORDER.length; show(layout);
      } else if (name === 'refresh') { if (authorized) show(layout); else authorize(layout); }
      else if (authorized && !status) { try { post({ type: 'page', delta: name === 'nextPage' ? 1 : -1 }); } catch (_) { status = '暂时无法加载，请点击重试'; } }
    } };
  }
  return null;
}
function draw(ctx, layout) {
  const a = actions(layout);
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.text; ctx.font = '600 24px sans-serif';
  ctx.fillText('好友排行', layout.width / 2, a.previousMap.y - 24);
  ctx.font = '600 18px sans-serif'; ctx.fillText(MODES[MODE_ORDER[modeIndex]].title, layout.width / 2, a.previousMap.y + 30);
  const labels = { previousMap: '‹', nextMap: '›', previousPage: '上一页', nextPage: '下一页', refresh: '重试 / 刷新', close: '返回' };
  for (const [name, label] of Object.entries(labels)) {
    const r = a[name]; ctx.fillStyle = COLORS.panel; roundedRect(ctx, r.x, r.y, r.width, r.height, 18); ctx.fill();
    ctx.fillStyle = COLORS.text; ctx.font = '15px sans-serif'; ctx.fillText(label, r.x + r.width / 2, r.y + r.height / 2 + 5);
  }
  if (status) { ctx.font = '14px sans-serif'; ctx.fillText(status, layout.width / 2, a.list.y + 70, a.list.width); }
  else ctx.drawImage(context.canvas, a.list.x, a.list.y, a.list.width, a.list.height);
}
module.exports = { open, close, sync, actions, hit, draw, isOpen: () => opened };
