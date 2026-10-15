const storage = require('../persistence/storage');
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  musicEnabled: true,
  vibrationEnabled: true
};

// 原创 112 BPM 循环：短钩子旋律、轻鼓点与低音形成持续节奏感，
// 音量保持在反馈音效之下，避免长时间游玩产生听觉疲劳。
const BGM_SRC = 'assets/audio/bgm-v2.wav';
const BGM_VOLUME = 0.3;

function loadBoolean(key, fallback) {
  const value = storage.read(wx, key);
  return typeof value === 'boolean' ? value : fallback;
}

const settings = {
  soundEnabled: loadBoolean('fangcunSoundEnabled', DEFAULT_SETTINGS.soundEnabled),
  musicEnabled: loadBoolean('fangcunMusicEnabled', DEFAULT_SETTINGS.musicEnabled),
  vibrationEnabled: loadBoolean('fangcunVibrationEnabled', DEFAULT_SETTINGS.vibrationEnabled)
};

// 不抢占用户自己正在放的音乐；同时整体遵守系统静音键。
if (wx.setInnerAudioOption) {
  try {
    wx.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: true, fail() {} });
  } catch (error) {
    // 旧基础库不支持时保持默认行为。
  }
}

function createAudio(src, volume, useWebAudio) {
  if (!wx.createInnerAudioContext) return null;
  // useWebAudioImplement 走 WebAudio，整段解码进内存，短音效的首次播放延迟明显更低。
  // 但它只适合短音效：循环背景音乐整段解码会占用大量内存，
  // 因此背景音乐走默认的流式实现。
  let audio;
  try {
    audio = useWebAudio
      ? wx.createInnerAudioContext({ useWebAudioImplement: true })
      : wx.createInnerAudioContext();
  } catch (error) {
    try { audio = wx.createInnerAudioContext(); } catch (_) { return null; }
  }
  audio.src = src;
  audio.volume = volume;
  audio.loop = false;
  audio.autoplay = false;
  audio.obeyMuteSwitch = true;
  if (audio.onError) audio.onError(() => {});
  return audio;
}

function createEffect(src, volume) {
  return createAudio(src, volume, true);
}

// 统一为柔和木音与短磬声：常用操作起音轻，奖励逐级清晰。
// 连消仅用 D 的基音与八度，升调仍落在 D 大调内；破冰收住高频噪声。
// 通关、结束旋律和背景音乐保持不变。
const sounds = {
  tap: createEffect('assets/audio/tap.wav', 0.34),
  place: createEffect('assets/audio/place.wav', 0.32),
  undo: createEffect('assets/audio/undo.wav', 0.26),
  over: createEffect('assets/audio/over.wav', 0.26),
  clear: createEffect('assets/audio/clear.wav', 0.502),
  ice: createEffect('assets/audio/ice.wav', 0.48),
  bloom: createEffect('assets/audio/bloom.wav', 0.32),
  combo: createEffect('assets/audio/combo.wav', 0.38),
  energy: createEffect('assets/audio/energy.wav', 0.543),
  win: createEffect('assets/audio/win.wav', 0.35)
};

// D 大调调内阶梯（升 0 / 2 / 4 / 7 个半音）。800 局模拟显示只有约 3% 的消除能爬到
// 第二级以上，所以间距拉宽，让罕见的高连消听得见，同时不与背景音乐打架。
// playbackRate 同时改变速度和音高，短音效上正是想要的效果。
const PITCH_STEPS = [1, 1.122, 1.26, 1.498];

let suspended = false;

function play(name, step) {
  if (suspended || !settings.soundEnabled) return;
  const audio = sounds[name];
  if (!audio) return;
  const rate = PITCH_STEPS[Math.min(PITCH_STEPS.length - 1, Math.max(0, step || 0))];
  try {
    // stop() 已经把播放位置复位，再调 seek(0) 在部分机型上会抛错并吞掉这次播放。
    audio.stop();
    audio.playbackRate = rate;
    audio.play();
  } catch (error) {
    // 模拟器或静音环境不支持音频时，不影响游戏继续运行。
  }
}

function vibrate(type) {
  if (suspended || !settings.vibrationEnabled || !wx.vibrateShort) return;
  try { wx.vibrateShort({ type, fail() {} }); } catch (_) { /* Device feedback is optional. */ }
}

function buttonTap() {
  play('tap', 0);
}

function placement() {
  // 一局要听 25～50 次，落子音刻意保持无音高变化、存在感最低。
  play('place', 0);
}

// 撤销：短促的下行木音，读作"退回一步"。
function undoMove() {
  play('undo', 0);
  vibrate('light');
}

// 破冰：比普通消除更亮更短，让"冰碎了"和"消掉一行"区分开。
function iceBreak() {
  play('ice', 0);
  vibrate('medium');
}

// 花苞真正开放时的一小段上行木音，轻于通关，不随连消升调。
function bloom() {
  play('bloom', 0);
  vibrate('light');
}

// 一局或一关的结果。通关和刷新纪录用同一个最有分量的声音；
// 普通结束和闯关失败都用柔和的收束音，不做成惩罚。
function result(success) {
  play(success ? 'win' : 'over', 0);
  vibrate(success ? 'heavy' : 'light');
}

function elimination(combo, energyCharged, regionCount) {
  if (energyCharged) {
    play('energy', 0);
    vibrate('heavy');
    return;
  }
  // 阶梯同时吃"连消手数"和"一手消掉几个区域"。只按连消的话，
  // 平均最大 Combo 只有 1.4，阶梯几乎永远停在第一级。
  const regions = regionCount || 1;
  const level = Math.min(4, Math.max(0, (combo - 1) + (regions - 1)));
  if (level > 0) {
    play('combo', level - 1);
    vibrate('medium');
  } else {
    play('clear', 0);
    vibrate('medium');
  }
}

let bgm = null;

function ensureMusic() {
  if (bgm) return bgm;
  bgm = createAudio(BGM_SRC, BGM_VOLUME, false);
  if (bgm) bgm.loop = true;
  return bgm;
}

function playMusic() {
  if (suspended || !settings.musicEnabled) return;
  const audio = ensureMusic();
  if (!audio) return;
  try {
    audio.play();
  } catch (error) {
    // 音频文件缺失或解码失败时静默忽略，不影响游戏。
  }
}

function pauseMusic() {
  if (!bgm) return;
  try {
    bgm.pause();
  } catch (error) {
    // 同上。
  }
}

// 切后台必须暂停，否则音乐会在微信之外继续响。
function suspend() {
  suspended = true;
  for (const audio of Object.values(sounds)) { try { if (audio) audio.stop(); } catch (_) {} }
  pauseMusic();
}

function resume() {
  suspended = false;
  playMusic();
}

function setSoundEnabled(enabled) {
  settings.soundEnabled = Boolean(enabled);
  if (!settings.soundEnabled) for (const audio of Object.values(sounds)) { try { if (audio) audio.stop(); } catch (_) {} }
  storage.write(wx, 'fangcunSoundEnabled', settings.soundEnabled);
}

function setMusicEnabled(enabled) {
  settings.musicEnabled = Boolean(enabled);
  if (settings.musicEnabled) playMusic();
  else pauseMusic();
  storage.write(wx, 'fangcunMusicEnabled', settings.musicEnabled);
}

function setVibrationEnabled(enabled) {
  settings.vibrationEnabled = Boolean(enabled);
  storage.write(wx, 'fangcunVibrationEnabled', settings.vibrationEnabled);
}

module.exports = {
  settings,
  placement,
  buttonTap,
  undoMove,
  iceBreak,
  bloom,
  result,
  elimination,
  playMusic,
  pauseMusic,
  suspend,
  resume,
  setSoundEnabled,
  setMusicEnabled,
  setVibrationEnabled
};
