// 自定义分析上报。事件和字段要先在小游戏后台「数据分析 → 自定义分析 → 事件管理」里建好，
// 名称与下面完全一致；没建或客户端不支持时，上报会被静默忽略，不影响游戏。
function report(wxApi, event, data) {
  try { if (wxApi && typeof wxApi.reportEvent === 'function') wxApi.reportEvent(event, data); }
  catch (_) { /* 统计失败不能打断对局。 */ }
}
module.exports = { report };
