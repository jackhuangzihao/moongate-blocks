const { COLORS } = require('../config');

// 微信要求玩家直接点击原生按钮；不能用 Canvas 点击模拟打开反馈页。
function createPlayerFeedback(wxApi, onTap) {
  let button = null;
  let attempted = false;
  function sync(rect) {
    if (!rect) {
      if (button) { button.destroy(); button = null; }
      attempted = false;
      return;
    }
    if (attempted) return;
    attempted = true;
    if (typeof wxApi.createFeedbackButton !== 'function') return;
    try {
      button = wxApi.createFeedbackButton({
        type: 'text', text: '意见反馈  ›',
        style: {
          left: rect.x, top: rect.y, width: rect.width, height: rect.height,
          backgroundColor: '#F4EFE5', borderColor: '#F4EFE5', borderWidth: 0,
          borderRadius: 12, color: COLORS.text, fontSize: 16,
          textAlign: 'center', lineHeight: rect.height
        }
      });
      if (button) { button.onTap(onTap); button.show(); }
    } catch (_) {
      if (button) button.destroy();
      button = null;
    }
  }
  return { sync, get available() { return !!button; } };
}

module.exports = { createPlayerFeedback };
