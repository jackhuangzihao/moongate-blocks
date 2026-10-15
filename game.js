const { MODES, MODE_ORDER, REWARDED_AD_UNIT_ID } = require('./js/config');
const gardenRules = require('./js/rules/garden-rules');
const { createTray, SHAPES } = require('./js/rules/shapes');
const { createLayout } = require('./js/views/layout');
const {
  renderScene,
  drawDynamicLayer,
  getGameOverActions,
  getMenuActions,
  getGravityEntry,
  getHomeActions,
  getBasicsActions,
  getSpecialActions,
  getCollectionActions,
  getCollectionTabs,
  getChallengeActions,
  getLevelActions,
  getLevelViewport,
  levelScrollFor,
  getChapterActions,
  getBackButton,
  getRankingButton,
  getSettingsButton,
  getSettingsActions,
  getHelpActions,
  getGoalAction,
  getPlayPanelActions,
  getConfirmActions
} = require('./js/renderer');
const feedback = require('./js/platform/feedback');
const playerFeedback = require('./js/platform/player-feedback').createPlayerFeedback(wx, () => {
  releaseStaleTouches();
  saveCurrentGame();
  if (feedback.buttonTap) feedback.buttonTap();
});
const saves = require('./js/persistence/saves');
const storage = require('./js/persistence/storage');
const challenges = require('./js/challenge/challenges');
const daily = require('./js/daily/daily');
const mechanicGuide = require('./js/progression/mechanic-guide');
const basics = require('./js/progression/basics');
const INVITATION_SAVE_KEY = 'fangcunInvitationV1';
const collection = require('./js/progression/collection');
const analytics = require('./js/platform/analytics');
const leaderboard = require('./js/platform/leaderboard');
const sharing = require('./js/platform/sharing');
const gameTools = require('./js/rules/tools');
const undoBudget = require('./js/rules/undo-budget');
const dragPlacement = require('./js/views/drag-placement');
const rewardedAds = require('./js/platform/rewarded-ad').createRewardedAds(wx, REWARDED_AD_UNIT_ID);
let foreground = true;
const {
  createBoard,
  energyPalacePool,
  canPlace,
  placeShape,
  findCompletedRegions,
  clearCompletedRegions,
  hasAnyPlacement
} = require('./js/rules/board');

const windowInfo = wx.getWindowInfo
  ? wx.getWindowInfo()
  : wx.getSystemInfoSync();
if (wx.setPreferredFramesPerSecond) wx.setPreferredFramesPerSecond(60);
// 统一使用最高 2 倍画布：1.25 倍在 Retina 屏上会明显发糊。
const pixelRatio = Math.min(windowInfo.pixelRatio || 1, 2);
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

canvas.width = Math.round(windowInfo.windowWidth * pixelRatio);
canvas.height = Math.round(windowInfo.windowHeight * pixelRatio);

// 场景缓存画布。所有静态界面直接画进它，永远不从主画布回读像素——
// 从上屏画布 drawImage 取回内容在部分机型上不可靠，是之前重影的来源之一。
const sceneCanvas = wx.createOffscreenCanvas
  ? wx.createOffscreenCanvas({ type: '2d', width: canvas.width, height: canvas.height })
  : wx.createCanvas();
sceneCanvas.width = canvas.width;
sceneCanvas.height = canvas.height;
const sceneCtx = sceneCanvas.getContext('2d');
sceneCtx.scale(pixelRatio, pixelRatio);

// 微信小游戏提供的是全局 requestAnimationFrame，canvas 上没有这个方法。
// 之前的写法一路回落到 setTimeout(16)，既不跟随垂直同步也会累积漂移。
const raf = typeof requestAnimationFrame === 'function'
  ? callback => requestAnimationFrame(callback)
  : (canvas.requestAnimationFrame
    ? callback => canvas.requestAnimationFrame(callback)
    : callback => setTimeout(callback, 16));

// 旧版只有两个模式。无禁区的"普通"就是现在的简单，中央 3×3 的"困难"就是现在的中等，
// 新的困难（星位禁区）没有历史成绩。旧的 fangcunGameMode 里 'hard' 含义已经变了，
// 所以模式和最高分都改用新 key，只做一次单向迁移。
function loadMode() {
  const stored = storage.read(wx, 'fangcunGameModeV2');
  if (MODE_ORDER.includes(stored)) return stored;
  if (stored === 'long' || stored === 'courtyard') return 'easy';
  return storage.read(wx, 'fangcunGameMode') === 'hard' ? 'medium' : 'easy';
}

function storedScore(key) {
  const score = Number(storage.read(wx, key));
  return Number.isSafeInteger(score) && score >= 0 ? score : 0;
}
function loadBest(modeId) {
  const stored = storedScore(MODES[modeId].bestKey);
  if (stored) return stored;
  if (modeId === 'easy') {
    return storedScore('fangcunBestScoreNormal') || storedScore('fangcunBestScore');
  }
  if (modeId === 'medium') return storedScore('fangcunBestScoreHard');
  return 0;
}

const initialMode = loadMode();
const initialTray = createTray({ occupancy: 0 });
const initialBestScores = {};
MODE_ORDER.forEach(id => { initialBestScores[id] = loadBest(id); });
const state = {
  screen: 'menu',
  homeMode: 'garden',
  freeMode: initialMode,
  challenge: null,
  levelChapter: 0,
  levelScroll: 0,
  challengeProgress: challenges.load(wx),
  dailyProgress: daily.load(wx),
  today: daily.dateKey(),
  invitation: null,
  collectionReveal: null,
  board: createBoard(initialMode),
  mode: initialMode,
  score: 0,
  best: initialBestScores[initialMode],
  startingBest: initialBestScores[initialMode],
  bestScores: initialBestScores,
  savedGames: saves.loadAll(wx),
  piecesPlaced: 0,
  maxCombo: 0,
  combo: 0,
  energy: 0,
  energyPalaces: createEnergyPalaces(initialMode),
  luckyPendingCount: 0,
  luckyHighlightUntil: 0,
  welcomeEnergy: false,
  gardenIntro: false,
  basics: null,
  basicsReturn: null,
  homeDemoProgress: 0,
  homeDemoStart: Date.now(),
  sessionClears: 0,
  savePending: false,
  gardenUndo: null,
  undoBudget: undoBudget.create(),
  playPanel: null,
  undoSteps: 1,
  randomState: 0,
  videoToolsEnabled: Boolean(REWARDED_AD_UNIT_ID && wx.createRewardedVideoAd),
  reviveUsed: false,
  suggestion: null,
  mechanicGuide: null,
  guideSeen: storage.read(wx,'fangcunMechanicsSeenV1',{}),
  collectionTab: 'clears',
  rewardBusy: false,
  unavailableHintSeen: Boolean(storage.read(wx, 'fangcunUnavailableHintSeen')),
  tray: initialTray,
  recentShapeIds: initialTray.map(shape => shape.id),
  safetyGuaranteesRemaining: MODES[initialMode].rescues,
  trayAppearProgress: 1,
  unavailableTray: [false, false, false],
  drag: null,
  gameOver: false,
  gameOverProgress: 0,
  inputLocked: false,
  clearingCells: [],
  breakingIce: [],
  openingGates: [],
  clearProgress: 0,
  feedback: '',
  feedbackUntil: 0,
  settingsOpen: false,
  helpOpen: false,
  confirmAction: null,
  pressedButton: '',
  pressedRect: null,
  transitionAlpha: 0,
  soundEnabled: feedback.settings.soundEnabled,
  musicEnabled: feedback.settings.musicEnabled,
  vibrationEnabled: feedback.settings.vibrationEnabled,
  tutorialVisible: !storage.read(wx, 'fangcunTutorialSeen'),
  energyGuideVisible: !storage.read(wx, 'fangcunEnergyGuideSeen'),
  collection: collection.normalize(storage.read(wx, collection.KEY)),
  ownedDecor: [],
  decor: []
};
syncCollectionProgress();
state.ownedDecor = collection.unlocked(state.collection, collection.totalStars(state.challengeProgress));
state.decor = collection.displayed(state.collection, collection.totalStars(state.challengeProgress));
sharing.enableMenuShare(wx, () => state);

const menuButtonRect = wx.getMenuButtonBoundingClientRect
  ? wx.getMenuButtonBoundingClientRect()
  : null;
let layout = createLayout(windowInfo.windowWidth, windowInfo.windowHeight,
  windowInfo.safeArea, menuButtonRect, MODES[initialMode]);

// —— 单一渲染循环 ——
// sceneDirty：场景缓存需要重画。pendingPresents：还需要上屏几帧。
// pendingPresents 归零后整帧直接跳过，待机时不消耗 GPU。
let sceneDirty = true;
// 部分机型的上屏画布是双缓冲的，只画一帧会让另一个缓冲区留着旧画面来回闪。
// 每次变化连续上屏两帧，两个缓冲区都写到，静止时再彻底停下来。
let pendingPresents = 2;
let lastRankingPresent = -Infinity;
let dragTouchId = null;
let clearAnimation = null;
let trayAnimation = null;
let gameOverAnimation = null;
let pressAnimation = null;
let levelScrollGesture = null;
let gravityMode = null;
let sceneTransition = null;
let saveFailureNotified = false;
let lastSaveRetry = 0;
let lastInvitationSignature = '';
let pendingInvitation = null;

function invalidateScene() {
  sceneDirty = true;
  pendingPresents = 2;
}

function invalidateOverlay() {
  pendingPresents = 2;
}

const CLEAR_DURATION = 130;
const TRAY_DURATION = 180;
const GAME_OVER_DURATION = 750;
const PRESS_DURATION = 110;
const TRANSITION_DURATION = 220;

function startPress(id, action, rect, touchId) {
  if (pressAnimation || sceneTransition) return;
  state.pressedButton = id;
  state.pressedRect = { ...rect };
  pressAnimation = { start: Date.now(), action, rect, touchId, released: false };
  invalidateScene();
}

function cancelPress() {
  if (!pressAnimation) return;
  pressAnimation = null;
  state.pressedButton = '';
  state.pressedRect = null;
  invalidateScene();
}

function finishPress() {
  if (!pressAnimation) return;
  const action = pressAnimation.action;
  cancelPress();
  if (feedback.buttonTap) feedback.buttonTap();
  action();
}

// 切后台、来电、系统手势时，系统不一定补发 touchend / touchcancel。
// 按住的按钮或拖着的方块若不释放，onTouchStart 会一直认为"上一根手指还在"，
// 之后所有点击都被忽略，只能杀掉小游戏重进。
function releaseStaleTouches() {
  levelScrollGesture = null;
  if(gravityMode)gravityMode.cancel();
  cancelPress();
  if (state.drag) {
    state.drag = null;
    dragTouchId = null;
    invalidateScene();
  }
}

function startSceneTransition(action) {
  if (sceneTransition) return;
  sceneTransition = { start: Date.now(), action, switched: false };
  state.transitionAlpha = 0;
  invalidateOverlay();
}

function stepAnimations(now) {
  if (foreground && state.screen==='menu' && state.homeMode==='garden' && basics.isNew(state)
    && !state.settingsOpen && !state.helpOpen && state.homeDemoProgress<1) {
    const progress=Math.min(1,Math.max(0,Math.floor((now-state.homeDemoStart)/150)/20));
    if(progress!==state.homeDemoProgress){state.homeDemoProgress=progress;invalidateScene();}
  }
  if(state.screen==='gravity' && gravityMode && foreground)gravityMode.step(now);
  if (state.mechanicGuide && state.mechanicGuide.progress<1 && foreground
    && state.screen==='playing' && !state.settingsOpen && !state.helpOpen && !state.playPanel) {
    state.mechanicGuide.progress=Math.min(1,Math.max(0,(now-state.mechanicGuide.start)/2400));
    invalidateOverlay();
  }
  if (state.collectionReveal) {
    if (state.screen !== 'collection') state.collectionReveal = null;
    else {
      state.collectionReveal.progress = Math.min(1, (now-state.collectionReveal.start)/1000);
      if (state.collectionReveal.progress >= 1) state.collectionReveal = null;
      invalidateScene();
    }
  }
  if (state.luckyHighlightUntil && now >= state.luckyHighlightUntil) {
    state.luckyHighlightUntil = 0;
    invalidateScene();
  }
  if (pressAnimation && pressAnimation.released
    && now - pressAnimation.start >= PRESS_DURATION) {
    finishPress();
  }

  if (sceneTransition) {
    const progress = Math.min(1, (now - sceneTransition.start) / TRANSITION_DURATION);
    if (progress >= 0.5 && !sceneTransition.switched) {
      sceneTransition.switched = true;
      sceneTransition.action();
      invalidateScene();
    }
    const half = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    state.transitionAlpha = 1 - Math.pow(1 - Math.max(0, half), 2);
    invalidateOverlay();
    if (progress >= 1) {
      sceneTransition = null;
      state.transitionAlpha = 0;
      invalidateScene();
    }
  }

  if (state.feedbackUntil && now >= state.feedbackUntil) {
    state.feedback = '';
    state.feedbackUntil = 0;
    invalidateScene();
  }

  if (clearAnimation) {
    const progress = Math.min(1, (now - clearAnimation.start) / CLEAR_DURATION);
    state.clearProgress = progress;
    invalidateOverlay();
    if (progress >= 1) {
      const finished = clearAnimation;
      clearAnimation = null;
      finishClear(finished);
    }
  }

  if (trayAnimation) {
    const linear = Math.min(1, (now - trayAnimation.start) / TRAY_DURATION);
    state.trayAppearProgress = 1 - Math.pow(1 - linear, 3);
    invalidateScene();
    if (linear >= 1) {
      trayAnimation = null;
      state.trayAppearProgress = 1;
      state.inputLocked = false;
      invalidateScene();
    }
  }

  if (gameOverAnimation) {
    const progress = Math.min(1, (now - gameOverAnimation.start) / GAME_OVER_DURATION);
    state.gameOverProgress = progress;
    invalidateScene();
    if (progress >= 1) {
      gameOverAnimation = null;
      state.gameOverProgress = 1;
      invalidateScene();
    }
  }
}

function present() {
  syncPlayerFeedback();
  if (sceneDirty) {
    if(state.screen==='gravity')gravityMode.draw(sceneCtx,layout,state.pressedButton);
    else renderScene(sceneCtx, layout, state);
    sceneDirty = false;
  }
  // 整屏一次性贴回缓存，再画动态层。没有局部恢复，就没有边缘残留。
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(sceneCanvas, 0, 0);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (leaderboard.isOpen()) leaderboard.draw(ctx, layout);
  drawDynamicLayer(ctx, layout, state);
}

function syncPlayerFeedback() {
  const visible = foreground && state.settingsOpen && !state.helpOpen
    && !state.confirmAction && !sceneTransition && !leaderboard.isOpen();
  playerFeedback.sync(visible ? getSettingsActions(layout).feedback : null);
}

function loop() {
  raf(loop);
  const now = Date.now();
  stepAnimations(now);
  if (storage.hasPending(wx) && now - lastSaveRetry >= 5000) retrySaves(now);
  // Poll the shared canvas at 10 Hz; explicit input invalidations remain immediate.
  if (leaderboard.isOpen() && now - lastRankingPresent >= 100) {
    pendingPresents = Math.max(pendingPresents, 1);
    lastRankingPresent = now;
  }
  if (pendingPresents <= 0) return;
  pendingPresents -= 1;
  present();
}

updateTrayAvailability();
raf(loop);

if (wx.onShow) {
  wx.onShow(options => {
    state.today = daily.dateKey();
    invalidateScene();
    retrySaves();
    foreground = true;
    if (!state.rewardBusy) feedback.resume();
    leaderboard.sync(wx, state.bestScores);
    receiveInvitation(options && options.query);
  });
}
// 切后台不暂停的话，背景音乐会在微信之外继续响。
if (wx.onHide) {
  wx.onHide(() => {
    if(foreground && state.screen==='playing' && !state.gameOver && !state.rewardBusy)reportPlay('session_pause',{reason:'background'});
    foreground = false;
    playerFeedback.sync(null);
    releaseStaleTouches();
    saveCurrentGame();
    retrySaves();
    leaderboard.sync(wx, state.bestScores);
    feedback.suspend();
  });
}
feedback.playMusic();

function shapeBounds(shape) {
  return shape.cells.reduce((bounds, [x, y]) => ({
    width: Math.max(bounds.width, x + 1),
    height: Math.max(bounds.height, y + 1)
  }), { width: 0, height: 0 });
}

function touchById(list, identifier) {
  if (!list) return null;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].identifier === identifier) return list[i];
  }
  return null;
}

function pointOf(touch) {
  return { x: touch.clientX, y: touch.clientY };
}

function trayIndexAt(x, y) {
  if (Math.abs(y - layout.trayY) > layout.trayHitHalfHeight) return -1;
  const localX = x - layout.horizontalPadding;
  const index = Math.floor(localX / layout.traySlotWidth);
  const slotX = localX - index * layout.traySlotWidth;
  if (slotX < 4 || slotX > layout.traySlotWidth - 4) return -1;
  return index >= 0 && index < 3 ? index : -1;
}

function pointInRect(point, rect) {
  return Boolean(rect) && point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function gardenRandom() {
  state.randomState = (Math.imul(state.randomState, 1664525) + 1013904223) >>> 0;
  return state.randomState / 4294967296;
}

function createEnergyPalaces(mode, random = Math.random) {
  return gardenRules.createEnergyPalaces(mode, random);
}

function collectPalaceEnergy(completed) {
  const clearedEnergyPalaces = [];
  completed.palaces.forEach(([palaceCol, palaceRow]) => {
    const clearedIndex = palaceRow * (MODES[state.mode].cols / 3) + palaceCol;
    if (state.energyPalaces.indexOf(clearedIndex) < 0) return;
    clearedEnergyPalaces.push(clearedIndex);
  });

  const gained = clearedEnergyPalaces.length;
  let charges = 0;
  if (gained > 0) {
    state.energy += gained;
    state.welcomeEnergy = false;
    if (state.energy >= 3) {
      charges = Math.floor(state.energy / 3);
      state.energy %= 3;
      state.luckyPendingCount += charges;
    }
  }
  return { gained, charges, clearedEnergyPalaces };
}

function moveClearedEnergyPalaces(clearedEnergyPalaces) {
  state.energyPalaces = state.energyPalaces.filter(
    palaceIndex => clearedEnergyPalaces.indexOf(palaceIndex) < 0
  );
  if (state.energyPalaces.length === 0) state.energyPalaces = createEnergyPalaces(state.mode, gardenRandom);
}

function completedCells(completed) {
  return gardenRules.completedCells(state.board, completed);
}

function saveBestScore() {
  if (state.challenge || state.basics) return;
  if (state.score <= state.best) return;
  state.best = state.score;
  state.bestScores[state.mode] = state.best;
  persist(MODES[state.mode].bestKey, state.best);
}

function updateTrayAvailability() {
  state.unavailableTray = state.tray.map(shape => Boolean(shape)
    && !hasAnyPlacement(state.board, shape));
}

function boardOccupancy() {
  return gardenRules.boardOccupancy(state.board);
}

function createBalancedTray(includeLucky) {
  const tray = createTray({
    includeLucky,
    random: gardenRandom,
    occupancy: boardOccupancy(),
    recentIds: state.recentShapeIds,
    canUseShape: state.safetyGuaranteesRemaining > 0
      ? shape => hasAnyPlacement(state.board, shape)
      : null,
    onSafetyUsed: () => { state.safetyGuaranteesRemaining -= 1; }
  });
  state.recentShapeIds = state.recentShapeIds
    .concat(tray.map(shape => shape.id))
    .slice(-6);
  return tray;
}

function showFeedback(message, duration) {
  state.feedback = message;
  state.feedbackUntil = Date.now() + (duration || 680);
  invalidateScene();
}

function clearFeedback() {
  state.feedback = '';
  state.feedbackUntil = 0;
}

function notifySaveFailure() {
  if (!saveFailureNotified && wx.showToast) {
    wx.showToast({ title: '存档失败，请稍后重试', icon: 'none' });
  }
  saveFailureNotified = true;
}

function updateSaveStatus() {
  const pending = storage.hasPending(wx);
  if (state.savePending !== pending) { state.savePending = pending; invalidateScene(); }
  if (pending) notifySaveFailure();
  else saveFailureNotified = false;
}
function persist(key, value) {
  storage.write(wx, key, value);
  updateSaveStatus();
}
function retrySaves(now = Date.now()) {
  lastSaveRetry = now;
  storage.retry(wx);
  updateSaveStatus();
}
function saveHintSeen(key) { persist(key, true); }
function reportPlay(event, extra = {}) {
  analytics.report(wx, event, { mode: state.challenge?(state.challenge.invited?'invite':state.challenge.dailyDate?'daily':'challenge'):state.mode,
    level_id: state.challenge&&state.challenge.level>=0?state.challenge.level+1:0, pieces:state.piecesPlaced,
    cleared:Number(state.sessionClears>0),
    ...(state.challenge&&state.challenge.dailyDate?{date:state.challenge.dailyDate,puzzle_id:String(state.challenge.level)}:{}),...extra });
}
function reportFirst(event) {
  const key='fangcunFirst:'+event;
  if (!storage.read(wx,key)) { persist(key,true); reportPlay(event); }
}
function recordFirstClear() {
  if (state.tutorialVisible) { state.tutorialVisible=false; saveHintSeen('fangcunTutorialSeen'); }
  reportFirst('first_clear');
}
function dismissMechanicGuide(action) {
  if(!state.mechanicGuide)return;
  const id=state.mechanicGuide.id;
  state.guideSeen={...(state.guideSeen && typeof state.guideSeen==='object'?state.guideSeen:{}),[id]:true};
  persist('fangcunMechanicsSeenV1',state.guideSeen);
  state.mechanicGuide=null;
  reportPlay('mechanic_guide',{mechanic:id,action});
  invalidateScene();
}

// 重新计算已解锁的庭院物件；新添的物件用一条轻提示告诉玩家，不打断对局。
function refreshDecor(announce = true) {
  syncCollectionProgress();
  const unlocked = collection.unlocked(state.collection, collection.totalStars(state.challengeProgress));
  const added = unlocked.filter(id => !state.ownedDecor.includes(id));
  state.ownedDecor = unlocked;
  state.decor = collection.displayed(state.collection, collection.totalStars(state.challengeProgress));
  if (announce && added.length && wx.showToast) {
    wx.showToast({ title: `庭院新添：${added.map(collection.named).join('、')}`, icon: 'none', duration: 2200 });
  }
  return added;
}
function syncCollectionProgress() {
  const stars=state.challengeProgress.stars;
  if(collection.syncProgress(state.collection,{
    chapterFiveComplete:stars.slice(48,60).length===12 && stars.slice(48,60).every(n=>n>0),
    chapterFourComplete:stars.slice(36,48).length===12 && stars.slice(36,48).every(n=>n>0),
    // 既有纪念品只看前四章，扩关不能提高已经公布的领取门槛。
    allStars:stars.slice(0,48).length===48 && stars.slice(0,48).every(n=>n===3),
    chapterCounts:{arbour:stars.slice(36,48).filter(n=>n>0).length,
      plaque:stars.slice(0,48).filter(n=>n===3).length,keyCharm:stars.slice(48,60).filter(n=>n>0).length},
    dailyCompletions:daily.completedCount(state.dailyProgress)
  })) storage.write(wx,collection.KEY,state.collection);
}
function addGardenClears(count) {
  state.collection.clears = Math.max(0, state.collection.clears + count);
  persist(collection.KEY, state.collection);
  // 对局中不弹窗挡棋盘，新添的物件由调用方写进目标卡片那一行。
  return refreshDecor(false);
}
function openCollection() {
  const target=collection.target(state.collection,collection.totalStars(state.challengeProgress));
  if(target && target.complete)collection.setTarget(state.collection,null,0);
  const fresh = state.decor.filter(id => !state.collection.seen.includes(id));
  state.collectionReveal = fresh.length ? { ids:fresh, progress:0, start:Date.now() } : null;
  if(fresh.length)state.collectionTab=collection.ITEMS.find(item=>item.id===fresh[0]).track;
  state.collection.seen = state.ownedDecor.slice();
  persist(collection.KEY, state.collection);
  state.screen = 'collection';
  invalidateScene();
}

function openCollectionTarget() {
  const target=collection.target(state.collection,collection.totalStars(state.challengeProgress));
  if(!target || target.complete){openCollection();return;}
  const item=target.item;
  if(item.track==='clears'){state.mode=state.freeMode;continueOrStartGame();return;}
  if(item.id==='chime' || item.id==='bridge'){openDaily();return;}
  state.homeMode='challenge';state.screen='levels';state.levelScroll=0;
  const next=state.challengeProgress.stars.findIndex((stars,id)=>stars<3 && (item.id!=='plaque' || id<48));
  state.levelChapter=item.id==='keyCharm'?4:item.id==='arbour'?3:challenges.LEVELS[Math.max(0,next)].chapter;
  invalidateScene();
}

function saveCurrentGame() {
  // Practice never overwrites a scored run, even when opened from its settings.
  if(state.basics){retrySaves();return;}
  if(state.screen==='gravity' && gravityMode){gravityMode.hide();return;}
  if (state.screen !== 'playing') { retrySaves(); return; }
  if (state.challenge) {
    if (state.challenge.dailyDate && !state.challenge.invited) {
      state.dailyProgress = daily.update(state.dailyProgress, state.challenge);
      persist(daily.KEY, state.dailyProgress);
      if(state.challenge.won)refreshDecor();
      return;
    }
    if (state.challenge.invited) {
      const saved=challenges.checkpoint(state.challenge);
      if(saved && sharing.benchmarkText(state.challenge))saved.benchmarkSteps=state.challenge.benchmarkSteps;
      persist(INVITATION_SAVE_KEY,saved);
      return;
    }
    state.challengeProgress.chapter = challenges.level(state.challenge.level).chapter;
    state.challengeProgress.active = challenges.checkpoint(state.challenge);
    state.challengeProgress.runs[state.challengeProgress.chapter] = state.challengeProgress.active;
    if (state.challenge.won) {
      const id=state.challenge.level, steps=state.challenge.history.length;
      state.challengeProgress.stars[id] = Math.max(state.challengeProgress.stars[id], challenges.stars(state.challenge));
      state.challengeProgress.bestSteps[id]=Math.min(state.challengeProgress.bestSteps[id] || Infinity,steps);
      state.challengeProgress.bestRules[id]=challenges.level(id).rule;
    }
    persist(challenges.KEY, state.challengeProgress);
    if (state.challenge.won) refreshDecor();
    return;
  }
  const saved = state.gameOver ? null : saves.snapshot(state);
  if (saved) state.savedGames[state.mode] = saved;
  else delete state.savedGames[state.mode];
  persist(saves.keyFor(state.mode), saved);
}

function finishTurn(trayIndex, deferAnimations = false) {
  state.tray[trayIndex] = null;
  let createdNewTray = false;
  if (state.tray.every(shape => shape === null)) {
    const includeLucky = state.luckyPendingCount > 0;
    state.tray = createBalancedTray(includeLucky);
    if (includeLucky) {
      state.luckyPendingCount -= 1;
      state.luckyHighlightUntil = Date.now() + 2400;
      state.energyGuideVisible = false;
      saveHintSeen('fangcunEnergyGuideSeen');
      reportFirst('first_lucky');
    } else state.luckyHighlightUntil = 0;
    state.trayAppearProgress = 0;
    createdNewTray = true;
  }
  updateTrayAvailability();
  const wasGameOver = state.gameOver;
  state.gameOver = state.tray.every((shape, index) => !shape || state.unavailableTray[index]);
  if (state.gameOver && !wasGameOver) {
    state.gameOverProgress = 0;
    analytics.report(wx, 'garden_result', { map: state.mode, score: state.score, pieces: state.piecesPlaced });
  }
  saveBestScore();
  if (state.gameOver) leaderboard.sync(wx, state.bestScores);
  if (!createdNewTray) state.trayAppearProgress = 1;
  if (deferAnimations) state.inputLocked = true;
  else startTurnAnimations();
  saveCurrentGame();
  invalidateScene();
}

function startTurnAnimations() {
  if (state.gameOver) {
    gameOverAnimation = { start: Date.now() };
    // 结果音跟着结算面板出现，而不是跟着最后一次落子。
    if (feedback.result) feedback.result(state.challenge ? state.challenge.won : state.score > state.startingBest);
  }
  if (state.trayAppearProgress === 0 && !state.gameOver) {
    state.inputLocked = true;
    trayAnimation = { start: Date.now() };
  } else {
    state.trayAppearProgress = 1;
    state.inputLocked = false;
    trayAnimation = null;
  }
  invalidateScene();
}

function restartGame(restored = null, challengeRun = null, guided = false) {
  const newAttempt = !restored && !challengeRun;
  if (newAttempt && !guided && state.screen==='playing' && !state.gameOver) reportPlay('session_exit',{reason:'restart'});
  guided = guided || Boolean(newAttempt && state.gardenIntro && !state.challenge);
  state.basics=null;
  if (!challengeRun && state.challenge) challengeRun = withRunContext(state.challenge, challenges.start(state.challenge.level));
  state.board = createBoard(state.mode);
  layout = createLayout(windowInfo.windowWidth, windowInfo.windowHeight,
    windowInfo.safeArea, menuButtonRect, { ...MODES[state.mode], challenge: Boolean(challengeRun) });
  state.score = 0;
  state.best = state.bestScores[state.mode];
  state.startingBest = state.best;
  state.piecesPlaced = 0;
  state.maxCombo = 0;
  state.combo = 0;
  state.energy = 0;
  state.welcomeEnergy = false;
  state.gardenIntro = false;
  state.sessionClears = 0;
  state.gardenUndo = null;
  state.undoBudget = undoBudget.create();
  state.playPanel = null;
  state.randomState = restored ? restored.randomState : Math.floor(Math.random() * 4294967296);
  state.reviveUsed = false;
  state.suggestion = null;
  state.mechanicGuide = null;
  state.energyPalaces = createEnergyPalaces(state.mode, gardenRandom);
  state.luckyPendingCount = 0;
  state.luckyHighlightUntil = 0;
  state.recentShapeIds = [];
  state.safetyGuaranteesRemaining = MODES[state.mode].rescues;
  state.tray = createBalancedTray(false);
  state.trayAppearProgress = 1;
  state.unavailableTray = [false, false, false];
  state.drag = null;
  dragTouchId = null;
  state.gameOver = false;
  state.gameOverProgress = 0;
  gameOverAnimation = null;
  state.inputLocked = false;
  state.clearingCells = [];
  state.breakingIce = [];
  state.openingGates = [];
  state.clearProgress = 0;
  clearFeedback();
  clearAnimation = null;
  trayAnimation = null;
  state.settingsOpen = false;
  state.helpOpen = false;
  state.confirmAction = null;
  state.screen = 'playing';
  if (restored) Object.assign(state, restored);
  else if (!guided && !challengeRun && state.energyPalaces.length && !storage.read(wx, 'fangcunLuckyWelcomeUsed')) {
    state.energy = 2;
    state.welcomeEnergy = true;
    saveHintSeen('fangcunLuckyWelcomeUsed');
  }
  if (challengeRun) {
    challengeRun.undoBudget=undoBudget.normalize(challengeRun.undoBudget);
    applyChallenge(challengeRun);
    state.resultPreviousBest=challengeRun.dailyDate||challengeRun.invited?null:state.challengeProgress.bestSteps[challengeRun.level];
    state.mechanicGuide=mechanicGuide.create(challengeRun,state.guideSeen,Date.now());
    if(state.mechanicGuide)reportPlay('mechanic_guide',{mechanic:state.mechanicGuide.id,action:'show'});
  }
  if (state.gardenIntro) {
    const index=state.energyPalaces[0], cols=state.board[0].length/3;
    state.suggestion={slot:1,c:index%cols*3,r:Math.floor(index/cols)*3+2};
  }
  if (guided) applyBasicsStep(0);
  if (newAttempt && !state.basics) reportPlay('session_start',{entry:'new'});
  updateTrayAvailability();
  saveBestScore();
  saveCurrentGame();
  if (state.gameOver) startTurnAnimations();
  invalidateScene();
}

function continueOrStartGame() {
  state.challenge = null;
  state.homeMode = 'garden';
  state.freeMode = state.mode;
  const restored = saves.decode(state.savedGames[state.mode], state.mode);
  if (!restored && basics.isNew(state)) {startBasics(false);return;}
  restartGame(restored);
  if (restored) reportPlay('session_start',{entry:'resume'});
}

function applyBasicsStep(step) {
  state.basics=basics.create(step);
  state.board=state.basics.board;state.tray=state.basics.tray;
  state.energyPalaces=[];state.energy=0;state.welcomeEnergy=false;
  state.suggestion=basics.LESSONS[state.basics.step].move;
  state.gardenUndo=null;state.score=0;state.piecesPlaced=0;
  state.clearingCells=[];clearAnimation=null;clearFeedback();
  updateTrayAvailability();invalidateScene();
  if(!state.basicsReturn)persist(basics.KEY,state.basics.step);
}
function startBasics(replay = true) {
  saveCurrentGame();
  state.basicsReturn=replay?{screen:state.screen,mode:state.mode,homeMode:state.homeMode,challenge:state.challenge}:null;
  const step=replay?0:storage.read(wx,basics.KEY,0);
  state.challenge=null;state.mode='easy';state.homeMode='garden';
  restartGame(null,null,true);
  applyBasicsStep(step);
  analytics.report(wx,'basics_guide',{action:replay?'replay':'start',step:state.basics.step});
}
function finishBasics(action) {
  const previous=state.basicsReturn;
  analytics.report(wx,'basics_guide',{action,step:state.basics.step});
  if(!previous && action!=='home'){state.tutorialVisible=false;saveHintSeen('fangcunTutorialSeen');persist(basics.KEY,0);}
  state.basics=null;state.basicsReturn=null;clearAnimation=null;state.clearingCells=[];
  state.screen='menu';
  if(previous){
    state.mode=previous.mode;state.homeMode=previous.homeMode;state.challenge=previous.challenge;
    if(previous.screen==='playing')restartGame(previous.challenge?null:saves.decode(state.savedGames[state.mode],state.mode),previous.challenge);
    else {state.screen='menu';state.settingsOpen=false;state.helpOpen=false;}
  } else if(action==='home'){state.screen='menu';state.settingsOpen=false;state.helpOpen=false;}
  else {state.mode=state.freeMode;restartGame();showFeedback('现在开始正式挑战 · 不限时，挑战更高分',4500);}
  invalidateScene();
}
function playBasics(drag) {
  const before=state.board.map(row=>row.slice());
  const piece=state.tray[drag.trayIndex];
  const result=basics.play(state.basics,drag.trayIndex,drag.target.col,drag.target.row);
  if(!result)return;
  if(result.guided){showFeedback(basics.LESSONS[state.basics.step].detail,2400);return;}
  state.suggestion=null;
  if(result.cleared){
    feedback.elimination(1,false,result.cleared);
    // Include the newly placed cells in the same clear animation.
    placeShape(before,piece,drag.target.col,drag.target.row);
    state.clearingCells=[];
    before.forEach((row,r)=>row.forEach((v,c)=>{if(v && !state.board[r][c])state.clearingCells.push([c,r]);}));
    state.clearProgress=0;clearAnimation={start:Date.now()};
    analytics.report(wx,'basics_guide',{action:'learned',step:state.basics.step});
    if(state.basics.done && !state.basicsReturn){
      state.tutorialVisible=false;saveHintSeen('fangcunTutorialSeen');persist(basics.KEY,0);
      // One-time floor reward; replaying practice cannot farm decorations or points.
      if(!state.collection.clears)addGardenClears(1);
    }
  } else if(result.stuck){applyBasicsStep(2);showFeedback('换个位置再试试 · 练习不扣分',2600);}
  else feedback.placement();
  updateTrayAvailability();invalidateScene();
}

function applyChallenge(run) {
  state.challenge = run;
  state.board = run.board; state.tray = run.tray; state.score = run.score;
  state.piecesPlaced = run.history.length; state.combo = run.combo; state.maxCombo = run.maxCombo;
  state.sessionClears = run.totalClears;
  state.gameOver = run.ended; state.energyPalaces = []; state.energy = 0;
  state.luckyPendingCount = 0; state.safetyGuaranteesRemaining = 0;
  state.best = 0; state.startingBest = 0;
}
function withRunContext(source, run) {
  if (run && source) {
    if (source.dailyDate) run.dailyDate=source.dailyDate;
    if (source.invited) run.invited=true;
    if (sharing.benchmarkText(source))run.benchmarkSteps=source.benchmarkSteps;
  }
  return run;
}
function openDaily() {
  saveCurrentGame();
  state.today=daily.dateKey();
  state.screen='daily'; state.homeMode='challenge'; state.gameOver=false;
  invalidateScene();
}
function startDaily() {
  state.today=daily.dateKey();
  const resumed=state.dailyProgress.active && state.dailyProgress.active.date===state.today;
  const run=daily.start(state.dailyProgress,state.today);
  if (!run) return;
  if(state.invitation && state.invitation.dailyDate){
    delete run.benchmarkSteps;
    if(state.invitation.dailyDate===state.today && state.invitation.level===run.level && sharing.benchmarkText(state.invitation))run.benchmarkSteps=state.invitation.benchmarkSteps;
  }
  state.mode='easy'; state.homeMode='challenge';
  restartGame(null,run);
  reportPlay('session_start',{entry:resumed?'resume':'new'});
}
function receiveInvitation(query) {
  const invitation=sharing.parseInvitation(query);
  if (!invitation) return;
  if(state.rewardBusy){pendingInvitation=query;return;}
  const signature=JSON.stringify(invitation);
  const routedDate=invitation.dailyDate?daily.dateKey():null;
  const routedLevel=routedDate?daily.entryLevel(state.dailyProgress,routedDate):invitation.level;
  const legacyDaily=invitation.dailyDate===routedDate && invitation.level!==routedLevel;
  const trial=!invitation.dailyDate || invitation.help || legacyDaily;
  const expectedLevel=trial?invitation.level:routedLevel,expectedDate=trial?invitation.dailyDate:routedDate;
  const matchingPage=trial?state.screen==='invitation' && state.invitation && state.invitation.level===expectedLevel
    :state.screen==='daily' && expectedDate===state.today;
  const matchingRun=state.screen==='playing' && state.challenge && state.challenge.level===expectedLevel
    && (!trial || state.challenge.invited) && (!expectedDate || state.challenge.dailyDate===expectedDate);
  if (signature===lastInvitationSignature && (matchingPage || matchingRun)) return;
  lastInvitationSignature=signature;
  saveCurrentGame(); releaseStaleTouches();
  state.basics=null;state.basicsReturn=null;
  leaderboard.close(wx);
  clearAnimation=trayAnimation=gameOverAnimation=sceneTransition=null;
  state.transitionAlpha=0; state.gameOver=false; state.inputLocked=false;
  state.clearingCells=[]; state.breakingIce=[]; state.openingGates=[]; state.settingsOpen=false;state.helpOpen=false;state.confirmAction=null;state.playPanel=null;
  state.invitation=invitation;
  // A same-day link from the old bank opens as a separate trial when today's
  // active/new puzzle differs. Never apply its benchmark to the new puzzle.
  if (!trial) {
    state.today=daily.dateKey(); state.screen='daily';
    if(invitation.dailyDate!==state.today)delete state.invitation.benchmarkSteps;
    if ((invitation.dailyDate!==state.today || routedLevel!==invitation.level) && wx.showToast)
      wx.showToast({title:'精选已更新，为你打开今日题目',icon:'none'});
  } else { state.invitation=invitation; state.screen='invitation'; }
  state.homeMode='challenge';invalidateScene();
}
function startInvitation() {
  if (!state.invitation) return;
  const saved=storage.read(wx,INVITATION_SAVE_KEY);
  const resumed=!state.invitation.help && saved && saved.level===state.invitation.level && challenges.restore(saved);
  const run=resumed || challenges.start(state.invitation.level);
  if (!run) return;
  // 新邀请即使是同一关，也以新分享中的成绩为准；旧链接不沿用他人的目标。
  delete run.benchmarkSteps;
  if(sharing.benchmarkText(state.invitation))run.benchmarkSteps=state.invitation.benchmarkSteps;
  run.invited=true;state.mode='easy';state.homeMode='challenge';
  if(state.invitation.dailyDate)run.dailyDate=state.invitation.dailyDate;
  restartGame(null,run);
  reportPlay('session_start',{entry:resumed?'resume':'new'});
}
function startChallenge(id, resume = false) {
  if (!challenges.isUnlocked(state.challengeProgress, id)) {
    if (wx.showToast) wx.showToast({ title: `先完成本章前面的关卡即可解锁`, icon: 'none' });
    return;
  }
  const saved = state.challengeProgress.runs[challenges.level(id).chapter];
  const run = resume && saved && saved.level === id ? challenges.restore(saved) : challenges.start(id);
  if (!run) return;
  state.mode = 'easy'; state.homeMode = 'challenge'; state.challenge = run;
  state.levelChapter = challenges.level(id).chapter;
  state.levelScroll = levelScrollFor(layout,challenges.level(id));
  state.challengeProgress.chapter = state.levelChapter;
  if (state.challengeProgress.updatedLayout) {
    if (wx.showToast) wx.showToast({ title: '关卡已更新，已获星级保留', icon: 'none' });
    delete state.challengeProgress.updatedLayout;
  }
  restartGame(null, run);
  reportPlay('session_start',{entry:resume && saved && saved.level===id?'resume':'new'});
}
function undoMove(steps) {
  if (state.rewardBusy || state.inputLocked || state.drag) return;
  const notice = title => { if (wx.showToast) wx.showToast({title,icon:'none'}); };
  if (!undoBudget.hasHistory(state)) { notice('当前没有可撤回的落子'); return; }
  const budget = undoBudget.current(state);
  if (!undoBudget.remaining(budget)) {
    if (undoBudget.canSupplement(state)) {
      state.playPanel='undo'; state.undoSteps=1; invalidateScene();
    } else notice('本局撤回机会已用完，仍可免费重新开始');
    return;
  }
  const failed = state.challenge && state.challenge.ended;
  if (failed && steps === undefined) {
    state.playPanel='undo'; state.undoSteps=Math.min(3,state.challenge.history.length); invalidateScene(); return;
  }
  const count = steps === undefined ? 1 : steps;
  if (!Number.isInteger(count) || count < 1 || count > (failed ? Math.min(3,state.challenge.history.length) : 1)) return;
  const spent = undoBudget.spend(budget);
  if (state.challenge) {
    let run = state.challenge;
    for (let i=0;i<count && run;i++) run=challenges.undo(run);
    if (!run || run.ended) { notice('当前无法回退，请重新挑战'); return; }
    run.undoBudget=spent;
    restartGame(null,withRunContext(state.challenge,run));
  } else {
    const restored=saves.decode(state.gardenUndo,state.mode);
    if (!restored) { notice('这一步无法恢复，请继续游戏'); return; }
    const clearGain=Math.max(0,state.sessionClears-restored.sessionClears);
    restored.undoBudget=spent;
    restartGame(restored);
    if (clearGain) addGardenClears(-clearGain);
  }
  reportPlay('undo_used',{steps:count,remaining:undoBudget.remaining(spent),from_failure:Boolean(failed)});
  if (feedback.undoMove) feedback.undoMove();
  showFeedback(`已退回 ${count} 步 · 剩余 ${undoBudget.remaining(spent)} 次撤回`,2400);
}
async function requestVideoTool(kind) {
  try { return await performVideoTool(kind); }
  finally {
    if(!state.rewardBusy && pendingInvitation){
      const query=pendingInvitation;pendingInvitation=null;receiveInvitation(query);
    }
  }
}
async function performVideoTool(kind) {
  if (state.rewardBusy || state.inputLocked || state.drag || !['undo','hint','revive'].includes(kind)) return;
  const notice = title => { if(wx.showToast)wx.showToast({title,icon:'none'}); };
  const free = kind==='hint' && state.challenge && !state.challenge.dailyDate && !state.challenge.invited
    && challenges.freeHintReady(state.challengeProgress, state.challenge.level);
  if (!state.videoToolsEnabled && !free) { notice('视频奖励暂不可用'); return; }
  if (kind==='undo' && !undoBudget.canSupplement(state)) { notice('当前不能补充撤回机会'); return; }
  if (kind==='revive' && (state.challenge || !state.gameOver || state.reviveUsed)) {
    notice(state.reviveUsed?'本局复活已使用':'复活仅在庭院结束后可用'); return;
  }
  if (kind==='hint' && state.gameOver) { notice('当前已结束，可以撤回或重试'); return; }
  const reward = kind==='undo' ? { budget: undoBudget.current(state) }
    : kind==='hint' ? gameTools.suggest(state) : gameTools.revivalCells(state);
  if (!reward) { notice(state.challenge?'暂未找到可靠提示，可以撤回再试':'当前没有可用落点'); return; }
  const board = state.board;
  if (reward.undo) {
    // Explain the rollback before either consuming the gift or opening a video.
    if (!wx.showModal) { notice(`需撤回 ${reward.undo} 步后再试提示`); return; }
    state.rewardBusy=true; invalidateScene();
    const approved=await new Promise(resolve=>{
      try { wx.showModal({title:'调整后再提示',content:`这次提示需要先撤回 ${reward.undo} 步，再显示可通关的落点。${free?'确认后使用本关的免费提示。':'确认后观看视频，完整观看才执行。'}`,
        confirmText:'继续',cancelText:'保留棋盘',success:r=>resolve(Boolean(r.confirm)),fail:()=>resolve(false)}); }
      catch (_) { resolve(false); }
    });
    state.rewardBusy=false; invalidateScene();
    if(!approved || state.board!==board || state.screen!=='playing')return;
  }
  if (!free) {
    saveCurrentGame();
    state.rewardBusy = true; invalidateScene(); feedback.suspend();
    reportPlay('tool_video',{tool:kind,result:'requested'});
    let result;
    try { result = await rewardedAds.show(); }
    catch (_) { result = 'failed'; }
    state.rewardBusy = false;
    if(foreground)feedback.resume();
    reportPlay('tool_video',{tool:kind,result});
    if (result !== 'rewarded') {
      notice(result==='unavailable'?'视频奖励暂不可用，稍后再来':result==='cancelled'?'未完整观看，本次未获得道具':'视频加载失败，请稍后重试');
      invalidateScene(); return;
    }
    if (state.board !== board || state.screen!=='playing') { invalidateScene(); return; }
  }
  if (kind==='undo') {
    const current=undoBudget.current(state);
    if (current.attemptId !== reward.budget.attemptId || current.spent !== reward.budget.spent
      || current.grants !== reward.budget.grants || !undoBudget.canSupplement(state)) return;
    const granted=undoBudget.grant(current);
    if (!granted) return;
    if (state.challenge) state.challenge.undoBudget=granted;
    else state.undoBudget=granted;
    state.playPanel=null;
    saveCurrentGame();
    reportPlay('undo_granted',{grants:granted.grants,remaining:undoBudget.remaining(granted)});
    notice('已获得 1 次撤回机会');
    if (state.challenge && state.challenge.ended) {
      state.playPanel='undo'; state.undoSteps=Math.min(3,state.challenge.history.length);
    } else showFeedback('已获得 1 次撤回 · 点击撤回使用',3000);
  } else if (kind==='hint') {
    if (free) state.challengeProgress.freeHints[state.challenge.level] = 1;
    if (state.challenge) reportPlay('hint_used', {
      source: free ? 'free' : 'video', undo_steps: reward.undo || 0 });
    // 当前局面已无法验证通关时，先替玩家退回到最近一个仍能赢的局面。
    if (reward.undo) {
      reward.run.undoBudget=state.challenge.undoBudget;
      restartGame(null, withRunContext(state.challenge,reward.run));
      if (feedback.undoMove) feedback.undoMove();
    }
    state.suggestion = { slot: reward.slot, c: reward.c, r: reward.r };
    saveCurrentGame();
    showFeedback(reward.undo?`已退回 ${reward.undo} 步 · 从这里按虚线落子可通关`
      :state.challenge?'此步已验证可通关 · 按虚线落子':'虚线框是建议落点，仅供参考',5000);
  } else {
    reward.forEach(([c,r])=>{state.board[r][c]=0;});
    state.reviveUsed = true; state.gardenUndo = null; state.suggestion = null;
    state.gameOver = false; state.gameOverProgress = 0; gameOverAnimation = null;
    updateTrayAvailability();
    showFeedback('已腾出一处空间 · 本局复活已用',3000);
    saveCurrentGame();
  }
  invalidateScene();
}
function openGravity() {
  saveCurrentGame();
  releaseStaleTouches();
  // Load gravity only when opened; ordinary garden rules/saves stay independent.
  if (!gravityMode) {
    gravityMode = require('./js/gravity/gravity-mode').create({
      wx, invalidate: invalidateScene, press: startPress, persist, feedback,
      leave: () => { state.screen = 'maps'; invalidateScene(); }
    });
  }
  state.screen = 'gravity';
  state.homeMode = 'garden';
  state.playPanel = null;
  state.settingsOpen = false;
  state.helpOpen = false;
  gravityMode.enter();
  invalidateScene();
}

function returnHome() {
  if(state.basics){finishBasics('home');return;}
  if(state.screen==='playing' && !state.gameOver)reportPlay('session_exit',{reason:'home'});
  saveCurrentGame();
  state.screen = 'menu'; state.settingsOpen = false; state.helpOpen = false; state.playPanel = null;
  state.gameOver = false; invalidateScene();
}
function playChallenge(drag) {
  const oldProgress=state.challenge.progress;
  const result = challenges.play(state.challenge, drag.trayIndex, drag.target.col, drag.target.row);
  if (!result) return;
  if(mechanicGuide.experienced(state.mechanicGuide,state.challenge,result,oldProgress))dismissMechanicGuide('experienced');
  else if(state.challenge.ended)state.mechanicGuide=null;
  const run = state.challenge;
  const firstFailure=run.ended && !run.won && !run.failedOnce;
  if (firstFailure) {
    run.failedOnce=true;
    if (!run.dailyDate && !run.invited) {
      const fails = state.challengeProgress.fails;
      fails[run.level] = Math.min(999, fails[run.level] + 1);
    }
  }
  if (run.won || firstFailure) analytics.report(wx, run.invited?'invite_result':run.dailyDate?'daily_result':'level_result', { level_id: run.level>=0?run.level+1:0, result: run.won ? 'win' : 'fail',
    steps: run.history.length, stars: challenges.stars(run), fails: run.dailyDate||run.invited?Number(Boolean(run.failedOnce)):state.challengeProgress.fails[run.level],
    ...(run.dailyDate?{date:run.dailyDate,puzzle_id:String(run.level)}:{}) });
  applyChallenge(state.challenge); updateTrayAvailability();
  state.trayAppearProgress = result.dealt ? 0 : 1;
  state.breakingIce = result.brokenIce;
  state.openingGates = result.openedGates;
  state.clearingCells = result.cells.filter(([c,r]) => !result.brokenIce.some(p => p[0]===c && p[1]===r));
  state.clearProgress = 0;
  reportFirst('first_place');
  if (result.count) {
    recordFirstClear();
    // 通关音由结算面板统一播放，这里只表达"消掉了什么"。
    if (!run.won && result.wateredFlowers.some(flower=>flower[2]===0) && feedback.bloom) feedback.bloom();
    else if (result.brokenIce.length) { if (feedback.iceBreak) feedback.iceBreak(); }
    else feedback.elimination(state.combo, false, result.count);
    const watered=result.wateredFlowers || [];
    showFeedback(state.challenge.won ? '目标完成 · 小径打通了' : result.openedGates.length ? `机关 ${[...new Set(result.openedGates.map(p=>p[2]))].join('、')} 已开启 · 新空间可以落子` : watered.length ? (watered.some(p=>p[2]===0)?'花开了 · 继续照料其他花圃':'花圃已浇灌 · 再在旁边消除一次') : result.brokenIce.length ? (challenges.level(run.level).kind==='ice' ? '薄冰已破 · 目标进度增加' : '薄冰已破 · 再消一次清除方块') : state.challenge.progress>oldProgress ? '漂亮，离目标更近了' : '腾出空间了 · 再看本关目标', 1800);
    state.inputLocked = true; clearAnimation = { start: Date.now() };
  } else { feedback.placement(); clearFeedback(); startTurnAnimations(); }
  saveCurrentGame(); invalidateScene();
}

function updateDrag(point) {
  if (!state.drag) return;
  const { bounds, shape } = state.drag;
  Object.assign(state.drag, dragPlacement.position(point, bounds, layout));
  const target = state.drag.target;
  const { col, row } = target || {};
  state.drag.valid = Boolean(target && canPlace(state.board, shape, col, row));
  const previewKey = `${col},${row},${state.drag.valid ? 1 : 0}`;
  if (state.drag.lastPreviewKey !== previewKey) {
    state.drag.lastPreviewKey = previewKey;
    state.drag.previewClearingCells = [];
    state.drag.previewBreakingIce = [];
    state.drag.challengePreview = null;
    if (state.drag.valid) {
      if(state.challenge){
        const preview=challenges.preview(state.challenge,state.drag.trayIndex,col,row);
        state.drag.challengePreview=preview;
        if(preview){
          state.drag.previewBreakingIce=preview.brokenIce;
          state.drag.previewClearingCells=preview.cells.filter(([c,r])=>!preview.brokenIce.some(p=>p[0]===c&&p[1]===r));
        }
      } else {
        const previewBoard = state.board.map(boardRow => boardRow.slice());
        placeShape(previewBoard, shape, col, row);
        state.drag.previewClearingCells = completedCells(findCompletedRegions(previewBoard));
      }
    }
  }
  invalidateOverlay();
}

function simultaneousClearScore(regionCount) {
  return gardenRules.simultaneousClearScore(regionCount);
}

function finishClear() {
  state.clearingCells = [];
  state.breakingIce = [];
  state.openingGates = [];
  state.clearProgress = 0;
  if(state.basics && state.basics.needsNext && !state.basics.done){
    applyBasicsStep(state.basics.step+1);
    return;
  }
  startTurnAnimations();
}

wx.onTouchStart(event => {
  const started = event.changedTouches && event.changedTouches[0];
  if (!started) return;
  // touches 是屏幕上仍按着的全部手指。记录中的那根手指已经不在了，
  // 说明它的抬起事件被系统吞掉，旧的拖动 / 按压状态作废。
  if (event.touches && event.touches.length) {
    if (gravityMode && gravityMode.touchId!==null && !touchById(event.touches,gravityMode.touchId))gravityMode.cancel();
    if (levelScrollGesture && !touchById(event.touches,levelScrollGesture.touchId)) releaseStaleTouches();
    if (state.drag && !touchById(event.touches, dragTouchId)) releaseStaleTouches();
    if (pressAnimation && !touchById(event.touches, pressAnimation.touchId)) cancelPress();
  }
  // 拖动中出现的第二根手指一律忽略，避免误触发按钮或抢走当前拖动。
  if (state.drag || levelScrollGesture || state.rewardBusy || gravityMode && gravityMode.touchId!==null) return;
  if (pressAnimation || sceneTransition) return;
  const point = pointOf(started);
  if(state.screen==='gravity'){gravityMode.start(point,started.identifier,layout);return;}

  if (state.playPanel) {
    const actions=getPlayPanelActions(layout,state);
    if (pointInRect(point,actions.close) || !pointInRect(point,actions.panel)) {
      startPress('play-panel-close',()=>{state.playPanel=null;invalidateScene();},actions.close,started.identifier);
    } else if (pointInRect(point,actions.confirm)) {
      startPress('play-panel-confirm',()=>{
        if(state.playPanel==='goal'){state.playPanel=null;invalidateScene();}
        else if(undoBudget.canSupplement(state))requestVideoTool('undo');
        else undoMove(state.undoSteps);
      },actions.confirm,started.identifier);
    } else for (const [steps,rect] of Object.entries(actions.steps)) if(pointInRect(point,rect)) {
      startPress('undo-step-'+steps,()=>{state.undoSteps=Number(steps);invalidateScene();},rect,started.identifier);break;
    }
    return;
  }

  if (leaderboard.isOpen()) {
    const hit = leaderboard.hit(point, layout);
    if (hit) startPress('ranking', () => { hit.action(); invalidateScene(); }, hit.rect, started.identifier);
    return;
  }

  if (state.confirmAction) {
    const confirmActions = getConfirmActions(layout);
    if (pointInRect(point, confirmActions.cancel)) {
      startPress('confirm-cancel', () => {
        state.confirmAction = null;
        invalidateScene();
      }, confirmActions.cancel, started.identifier);
    } else if (pointInRect(point, confirmActions.confirm)) {
      const action = state.confirmAction;
      startPress('confirm-confirm', () => startSceneTransition(() => {
        state.confirmAction = null;
        if (action === 'restart') restartGame();
        else returnHome();
      }), confirmActions.confirm, started.identifier);
    }
    return;
  }
  if (state.helpOpen) {
    const actions = getHelpActions(layout);
    if (pointInRect(point,actions.practice)) {
      startPress('help-practice',()=>startSceneTransition(()=>startBasics(true)),actions.practice,started.identifier);return;
    }
    if (pointInRect(point, actions.confirm)) {
      startPress('help-confirm', () => {
        state.helpOpen = false;
        invalidateScene();
      }, actions.confirm, started.identifier);
    } else if (!pointInRect(point, actions.panel)) {
      state.helpOpen = false;
      invalidateScene();
    }
    return;
  }
  if (state.settingsOpen) {
    const actions = getSettingsActions(layout);
    if (pointInRect(point, actions.sound)) {
      startPress('settings-sound', () => {
        state.soundEnabled = !state.soundEnabled;
        feedback.setSoundEnabled(state.soundEnabled);
        updateSaveStatus();
        invalidateScene();
      }, actions.sound, started.identifier);
    } else if (pointInRect(point, actions.music)) {
      startPress('settings-music', () => {
        state.musicEnabled = !state.musicEnabled;
        feedback.setMusicEnabled(state.musicEnabled);
        updateSaveStatus();
        invalidateScene();
      }, actions.music, started.identifier);
    } else if (pointInRect(point, actions.vibration)) {
      startPress('settings-vibration', () => {
        state.vibrationEnabled = !state.vibrationEnabled;
        feedback.setVibrationEnabled(state.vibrationEnabled);
        updateSaveStatus();
        invalidateScene();
      }, actions.vibration, started.identifier);
    } else if (pointInRect(point, actions.guide)) {
      startPress('settings-guide', () => {
        state.helpOpen = true;
        invalidateScene();
      }, actions.guide, started.identifier);
    } else if (pointInRect(point, actions.feedback)) {
      // 原生按钮负责跳转；旧客户端和浏览器预览提供可执行的替代路径。
      if (!playerFeedback.available) startPress('settings-feedback', () => {
        if (wx.showModal) wx.showModal({ title: '意见反馈',
          content: '请在微信中点击右上角“…” → 反馈与投诉。描述遇到的问题，并注明模式或关卡；附上截图更方便定位。',
          showCancel: false, confirmText: '知道了' });
        else if (wx.showToast) wx.showToast({ title: '请在微信右上角“…”中选择反馈与投诉', icon: 'none' });
      }, actions.feedback, started.identifier);
    } else if (state.screen !== 'menu' && pointInRect(point, actions.restart)) {
      startPress('settings-restart', () => {
        state.confirmAction = 'restart';
        invalidateScene();
      }, actions.restart, started.identifier);
    } else if (state.screen !== 'menu' && pointInRect(point, actions.menu)) {
      startPress('settings-menu', () => {
        state.confirmAction = 'menu';
        invalidateScene();
      }, actions.menu, started.identifier);
    } else if (pointInRect(point, actions.close)) {
      startPress('settings-close', () => {
        state.settingsOpen = false;
        invalidateScene();
      }, actions.close, started.identifier);
    }
    return;
  }
  if (state.screen === 'daily' || state.screen === 'invitation') {
    const actions=getSpecialActions(layout);
    if (pointInRect(point,getBackButton(layout))) {
      startPress('special-back',()=>startSceneTransition(()=>{state.screen='menu';invalidateScene();}),getBackButton(layout),started.identifier);
    } else if (pointInRect(point,actions.start)) {
      startPress('special-start',()=>startSceneTransition(state.screen==='daily'?startDaily:startInvitation),actions.start,started.identifier);
    }
    return;
  }
  if (state.screen === 'menu') {
    const actions = getHomeActions(layout);
    for (const name of ['garden','challenge','start','choose','daily','ranking','settings','collection','target']) {
      if (!pointInRect(point, actions[name]) || (name === 'ranking' && state.homeMode === 'challenge')
        || (name === 'collection' && state.homeMode !== 'garden')
        || (name === 'target' && (state.homeMode!=='garden' || !collection.target(state.collection,collection.totalStars(state.challengeProgress))))) continue;
      const action = () => {
        if (name === 'garden' || name === 'challenge') state.homeMode = name;
        else if (name === 'settings') state.settingsOpen = true;
        else if (name === 'ranking') leaderboard.open(wx,layout,state.freeMode,state.bestScores);
        else if (name === 'collection') {if(basics.isNew(state))startBasics(false);else openCollection();}
        else if (name === 'target') openCollectionTarget();
        else if (name === 'daily') openDaily();
        else if (name === 'choose') {
          state.screen = state.homeMode === 'challenge' ? 'levels' : 'maps';
          const level=challenges.level(state.challengeProgress.active ? state.challengeProgress.active.level : challenges.unlocked(state.challengeProgress));
          state.levelChapter=level.chapter;state.levelScroll=levelScrollFor(layout,level);
        }
        else if (state.homeMode === 'challenge') {
          const active = state.challengeProgress.active;
          const chapter = state.challengeProgress.chapter || 0;
          if (!active && challenges.chapterLevels(chapter).every(level=>state.challengeProgress.stars[level.id])) {
            state.screen='levels';state.levelChapter=chapter;state.levelScroll=0;
          } else startChallenge(active ? active.level : challenges.unlocked(state.challengeProgress), Boolean(active));
        } else { state.mode = state.freeMode; continueOrStartGame(); }
        invalidateScene();
      };
      startPress(`home-${name}`, () => {
        if (name === 'settings' || name === 'ranking' || name === state.homeMode) action();
        else startSceneTransition(action);
      },actions[name],started.identifier);
      return;
    }
    return;
  }
  if (state.screen === 'maps' || state.screen === 'levels' || state.screen === 'collection') {
    const back = getBackButton(layout);
    if (pointInRect(point,back)) {
      startPress('picker-back', () => startSceneTransition(() => { state.screen='menu'; invalidateScene(); }), back,started.identifier);
      return;
    }
    if(state.screen==='maps' && pointInRect(point,getGravityEntry(layout))){
      startPress('gravity-entry',()=>startSceneTransition(openGravity),getGravityEntry(layout),started.identifier);return;
    }
    if (state.screen === 'collection') {
      const tabs=getCollectionTabs(layout);
      for(const [id,rect] of Object.entries(tabs))if(pointInRect(point,rect)){
        startPress('collection-tab-'+id,()=>{state.collectionTab=id;invalidateScene();},rect,started.identifier);return;
      }
      const actions=getCollectionActions(layout,state.collectionTab);
      for(const [id,rect] of Object.entries(actions))if(pointInRect(point,rect)){
        startPress('decor-'+id,()=>{
          if(!state.ownedDecor.includes(id)) {
            const item=collection.ITEMS.find(item=>item.id===id);
            collection.setTarget(state.collection,id,collection.totalStars(state.challengeProgress));
            persist(collection.KEY,state.collection);invalidateScene();
            if(wx.showToast)wx.showToast({title:state.collection.target===id?`已选目标：${item.name}，回首页前往`:'已取消收藏目标',icon:'none'});
            return;
          }
          const hidden=state.collection.hidden;
          state.collection.hidden=hidden.includes(id)?hidden.filter(value=>value!==id):hidden.concat(id);
          persist(collection.KEY,state.collection);refreshDecor(false);invalidateScene();
        },rect,started.identifier);return;
      }
      return;
    }
    if (state.screen === 'levels') {
      const chapters = getChapterActions(layout);
      for (const [index, rect] of Object.entries(chapters)) if (pointInRect(point, rect)) {
        startPress(`chapter-${index}`, () => startSceneTransition(() => { state.levelChapter = Number(index); state.levelScroll=0; invalidateScene(); }), rect, started.identifier);
        return;
      }
    }
    if(state.screen==='levels') {
      const view=getLevelViewport(layout,state.levelChapter);
      if(!pointInRect(point,view))return;
      state.levelScroll=Math.max(0,Math.min(view.maxScroll,state.levelScroll));
      levelScrollGesture={touchId:started.identifier,x:point.x,y:point.y,offset:state.levelScroll,moved:false};
    }
    const actions = state.screen === 'maps' ? getMenuActions(layout) : getLevelActions(layout, state.levelChapter, state.levelScroll);
    for (const [id,rect] of Object.entries(actions)) {
      if (!pointInRect(point,rect)) continue;
      const maps = state.screen === 'maps';
      if (!maps && !challenges.isUnlocked(state.challengeProgress, Number(id))) {
        startPress(`pick-${id}`, () => startChallenge(Number(id)), rect, started.identifier);
        return;
      }
      startPress(`pick-${id}`, () => startSceneTransition(() => {
        if (maps) {
          state.mode = id;
          persist('fangcunGameModeV2', id);
          continueOrStartGame();
        } else startChallenge(Number(id),true);
      }),rect,started.identifier);
      return;
    }
    return;
  }
  if (state.gameOver) {
    if (state.gameOverProgress < .25) return;
    // 结算遮罩盖住了设置入口，此时必须先判定结算按钮，
    // 否则玩家会点到遮罩下面看不见的齿轮。
    const gameOverActions = getGameOverActions(layout,state);
    if (state.challenge && !state.challenge.won && pointInRect(point, gameOverActions.undo)) {
      startPress('challenge-undo', undoMove, gameOverActions.undo, started.identifier);
    } else if (!state.challenge && gameOverActions.revive && pointInRect(point, gameOverActions.revive)) {
      startPress('tool-revive', () => requestVideoTool('revive'), gameOverActions.revive, started.identifier);
    } else if (gameOverActions.retry && pointInRect(point, gameOverActions.retry)) {
      startPress('gameover-retry', () => startSceneTransition(() => {
        reportPlay('result_action',{action:'retry',stars:challenges.stars(state.challenge)});restartGame();
      }), gameOverActions.retry, started.identifier);
    } else if (pointInRect(point, gameOverActions.share)) {
      startPress('result-share', () => {
        reportPlay('result_action',{action:state.challenge&&!state.challenge.won?'help_share':'share'});
        sharing.share(wx,state);
      }, gameOverActions.share, started.identifier);
    } else if (pointInRect(point, gameOverActions.restart)) {
      startPress('gameover-restart', () => startSceneTransition(() => {
        reportPlay('result_action',{action:state.challenge&&state.challenge.won&&!state.challenge.invited?'continue':'retry',stars:state.challenge?challenges.stars(state.challenge):0});
        if (state.challenge && state.challenge.won) {
          if (state.challenge.invited) restartGame();
          else if (state.challenge.dailyDate) openDaily();
          else if (challenges.nextLevel(state.challenge.level)!==null) startChallenge(challenges.nextLevel(state.challenge.level), true);
          else { state.screen = 'levels'; state.gameOver = false; invalidateScene(); }
        } else restartGame();
      }),
        gameOverActions.restart, started.identifier);
    }
    else if (pointInRect(point, gameOverActions.menu)) {
      startPress('gameover-menu', () => startSceneTransition(()=>{
        reportPlay('result_action',{action:'home',stars:state.challenge?challenges.stars(state.challenge):0});returnHome();
      }), gameOverActions.menu, started.identifier);
    }
    return;
  }
  if(state.mechanicGuide && pointInRect(point,mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip)) {
    startPress('mechanic-skip',()=>dismissMechanicGuide('skip'),mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip,started.identifier);return;
  }
  const backButton = getBackButton(layout);
  if (pointInRect(point, backButton)) {
    startPress('game-home', () => startSceneTransition(returnHome), backButton, started.identifier); return;
  }
  const settingsButton = getSettingsButton(layout);
  if (!state.basics && pointInRect(point, settingsButton)) {
    startPress('game-settings', () => {
      state.settingsOpen = true;
      state.drag = null;
      dragTouchId = null;
      invalidateScene();
    }, settingsButton, started.identifier);
    return;
  }
  if(state.basics){
    const actions=getBasicsActions(layout);
    if(pointInRect(point,actions.skip)){
      startPress('basics-skip',()=>finishBasics('skip'),actions.skip,started.identifier);return;
    }
    if(state.basics.needsNext){
      if(state.clearingCells.length)return;
      if(pointInRect(point,actions.next))startPress('basics-next',()=>{
        if(state.basics.done)finishBasics('complete');else applyBasicsStep(state.basics.step+1);
      },actions.next,started.identifier);
      return;
    }
  }
  if (state.inputLocked) return;
  if (!state.basics && pointInRect(point,getGoalAction(layout))) {
    startPress('play-goal',()=>{state.playPanel='goal';reportPlay('goal_open',{});invalidateScene();},getGoalAction(layout),started.identifier);return;
  }
  const tools = getChallengeActions(layout, state);
  if (!state.basics && pointInRect(point, tools.undo)) {
    startPress('challenge-undo', undoMove, tools.undo, started.identifier); return;
  }
  if (tools.hint && pointInRect(point, tools.hint)) {
    startPress('tool-hint', () => requestVideoTool('hint'), tools.hint, started.identifier); return;
  }
  const trayIndex = trayIndexAt(point.x, point.y);
  if (trayIndex < 0) return;
  const shape = state.tray[trayIndex];
  if (!shape) return;
  if (state.unavailableTray[trayIndex]) {
    if (!state.unavailableHintSeen) {
      showFeedback('暂时无处可放，先试试其他方块', 2600);
      state.unavailableHintSeen = true;
      saveHintSeen('fangcunUnavailableHintSeen');
    }
    return;
  }

  dragTouchId = started.identifier;
  state.drag = {
    trayIndex,
    shape,
    bounds: shapeBounds(shape),
    x: point.x,
    y: point.y,
    target: null,
    valid: false,
    previewClearingCells: [],
    lastPreviewKey: ''
  };
  // 托盘里少了这一块，场景层必须重画一次；之后整段拖动都不再重画场景。
  invalidateScene();
  updateDrag(point);
});

// Once a finger drags, lifting it must never activate the card underneath.
function moveLevelScroll(touch) {
  const gesture=levelScrollGesture,point=pointOf(touch);
  if(Math.hypot(point.x-gesture.x,point.y-gesture.y)>=8)gesture.moved=true;
  if(!gesture.moved)return;
  cancelPress();
  const max=getLevelViewport(layout,state.levelChapter).maxScroll;
  const offset=Math.max(0,Math.min(max,gesture.offset+gesture.y-point.y));
  if(offset!==state.levelScroll){state.levelScroll=offset;invalidateScene();}
}

wx.onTouchMove(event => {
  if(levelScrollGesture){
    const touch=touchById(event.touches,levelScrollGesture.touchId)||touchById(event.changedTouches,levelScrollGesture.touchId);
    if(touch)moveLevelScroll(touch);
    return;
  }
  if (pressAnimation) {
    const touch = touchById(event.touches, pressAnimation.touchId)
      || touchById(event.changedTouches, pressAnimation.touchId);
    if (touch && !pointInRect(pointOf(touch), pressAnimation.rect)) cancelPress();
    return;
  }
  if(state.screen==='gravity'){
    const touch=touchById(event.touches,gravityMode.touchId)||touchById(event.changedTouches,gravityMode.touchId);
    if(touch)gravityMode.move(pointOf(touch),layout);return;
  }
  if (!state.drag) return;
  const touch = touchById(event.touches, dragTouchId)
    || touchById(event.changedTouches, dragTouchId);
  if (!touch) return;
  // 同一帧内的多个 move 事件只保留最后一个位置，渲染循环负责合帧。
  updateDrag(pointOf(touch));
});

wx.onTouchEnd(event => {
  if(levelScrollGesture){
    const touch=touchById(event.changedTouches,levelScrollGesture.touchId);
    if(!touch)return;
    moveLevelScroll(touch);
    const moved=levelScrollGesture.moved;
    if(!pointInRect(pointOf(touch),getLevelViewport(layout,state.levelChapter)))cancelPress();
    levelScrollGesture=null;
    if(moved)return;
  }
  if (pressAnimation) {
    const touch = touchById(event.changedTouches, pressAnimation.touchId);
    if (!touch) return;
    if (!pointInRect(pointOf(touch), pressAnimation.rect)) cancelPress();
    else {
      pressAnimation.released = true;
      if (Date.now() - pressAnimation.start >= PRESS_DURATION) finishPress();
    }
    return;
  }
  if(state.screen==='gravity'){
    const touch=touchById(event.changedTouches,gravityMode.touchId);
    if(touch)gravityMode.end(pointOf(touch),layout);return;
  }
  if (!state.drag) return;
  const touch = touchById(event.changedTouches, dragTouchId);
  if (!touch) return;
  updateDrag(pointOf(touch));
  const drag = state.drag;
  state.drag = null;
  dragTouchId = null;

  if (!drag.valid || !drag.target) {
    if(!drag.target && !storage.read(wx,'fangcunFixedDirectionSeen')){
      showFeedback('方块方向固定，按住并拖到棋盘空位',2600);saveHintSeen('fangcunFixedDirectionSeen');
    }
    if(drag.target){
      const cells=drag.shape.cells.map(([dx,dy])=>[drag.target.col+dx,drag.target.row+dy]);
      const covers=points=>points.some(([c,r])=>cells.some(p=>p[0]===c&&p[1]===r));
      const run=state.challenge;
      const outside=cells.some(([c,r])=>!state.board[r] || c<0 || c>=state.board[r].length || state.board[r][c]===-1);
      showFeedback(outside?'方块要完整放在棋盘内':run && covers(run.flowers)?'花圃不能放方块，消除相邻格子来浇灌':run && run.gates.some(g=>covers(g.cells))?'机关还没打开，先消除同字母的钥匙':cells.some(([c,r])=>state.board[r][c]===2)?'石障不能放方块，请换一处空位':'这里已有方块，请找能完整放下的空位',2400);
    }
    invalidateScene();
    return;
  }

  if(state.basics){playBasics(drag);return;}
  if (state.gardenIntro && (drag.trayIndex!==state.suggestion.slot || drag.target.col!==state.suggestion.c || drag.target.row!==state.suggestion.r)) {
    showFeedback('把这块拖到虚线处，补齐九宫就能消除',3000);return;
  }
  state.suggestion = null;
  if (state.challenge) { playChallenge(drag); return; }
  reportFirst('first_place');
  const before = saves.snapshot(state);
  before.previous=saves.history(before.previous,2);
  delete before.undoBudget;
  state.gardenUndo = before;
  placeShape(state.board, drag.shape, drag.target.col, drag.target.row);
  state.score += drag.shape.cells.length;
  state.piecesPlaced += 1;

  const completed = findCompletedRegions(state.board);
  const regionCount = completed.rows.length + completed.cols.length + completed.palaces.length;
  if (regionCount === 0) {
    state.combo = 0;
    clearFeedback();
    feedback.placement();
    finishTurn(drag.trayIndex);
    return;
  }

  state.score += simultaneousClearScore(regionCount);
  before.clearGain = regionCount;
  state.sessionClears += regionCount;
  recordFirstClear();
  const addedDecor = addGardenClears(regionCount);
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const energyResult = collectPalaceEnergy(completed);
  const finishedIntro=state.gardenIntro;
  if(finishedIntro){state.gardenIntro=false;state.score=0;state.piecesPlaced=0;state.combo=0;state.maxCombo=0;state.gardenUndo=null;}
  feedback.elimination(state.combo, energyResult.charges > 0, regionCount);
  if (energyResult.charges > 0) {
    showFeedback('幸运方块已充能');
  } else if (regionCount >= 2) {
    const label = regionCount === 2 ? '双重消除'
      : (regionCount === 3 ? '三重消除' : `${regionCount}重消除`);
    showFeedback(`${label} +${simultaneousClearScore(regionCount)}`);
  } else if (energyResult.gained > 0) {
    showFeedback(state.combo >= 2
      ? `能量 +${energyResult.gained} · COMBO ×${state.combo}`
      : `能量 +${energyResult.gained}`);
  } else {
    showFeedback(state.combo >= 2 ? `COMBO ×${state.combo}` : '漂亮！');
  }
  if (addedDecor.length) showFeedback(`庭院新添「${addedDecor.map(collection.named).join('、')}」· 回首页看看`, 3200);
  if(finishedIntro)showFeedback('首次消除完成 · 修竹已解锁，金色小块送给你',5000);
  state.clearingCells = completedCells(completed);
  state.clearProgress = 0;
  // Commit and save the settled turn before the visual effect: interruption during
  // the 130ms animation must not lose a move or reroll the next tray on resume.
  clearCompletedRegions(state.board, completed);
  moveClearedEnergyPalaces(energyResult.clearedEnergyPalaces);
  finishTurn(drag.trayIndex, true);
  if(finishedIntro)state.energyGuideVisible=true;
  clearAnimation = { start: Date.now() };
  invalidateScene();
});

wx.onTouchCancel(event => {
  if(levelScrollGesture){
    if(event && event.changedTouches && !touchById(event.changedTouches,levelScrollGesture.touchId))return;
    levelScrollGesture=null;cancelPress();return;
  }
  if (pressAnimation) {
    if (event && event.changedTouches
      && !touchById(event.changedTouches, pressAnimation.touchId)) return;
    cancelPress();
    return;
  }
  if(state.screen==='gravity'){
    if(!event || !event.changedTouches || touchById(event.changedTouches,gravityMode.touchId))gravityMode.cancel();return;
  }
  if (!state.drag) return;
  if (event && event.changedTouches && !touchById(event.changedTouches, dragTouchId)) return;
  state.drag = null;
  dragTouchId = null;
  invalidateScene();
});

try { if (wx.getLaunchOptionsSync) receiveInvitation(wx.getLaunchOptionsSync().query); }
catch (_) { /* Ordinary startup remains usable if launch metadata is unavailable. */ }
