const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const { createTray, SHAPES } = require('../js/rules/shapes');

// Run the actual game handlers without a WeChat device or animation loop.
const labels = [], rectangles = [], taps = [], events = [];
const ctx = new Proxy({}, {
  get(target, key) {
    if (key === 'fillText') return text => labels.push(text);
    if (key === 'roundRect') return (...args) => rectangles.push(args);
    return target[key] || (() => {});
  },
  set(target, key, value) { target[key] = value; return true; }
});
const storage = {};
const handlers = {};
const wx = {
  getWindowInfo: () => ({ windowWidth: 320, windowHeight: 568 }),
  createCanvas: () => ({ getContext: () => ctx }),
  getStorageSync: key => storage[key],
  setStorageSync: (key, value) => { storage[key] = value; },
  onTouchStart: fn => { handlers.start = fn; },
  onTouchMove: fn => { handlers.move = fn; },
  onTouchEnd: fn => { handlers.end = fn; },
  onTouchCancel: fn => { handlers.cancel = fn; }
};
const gamePath = path.resolve(__dirname, '../game.js');
const requireGame = createRequire(gamePath);
const sandbox = vm.createContext({
  wx, requestAnimationFrame() {},
  require: name => name === './js/platform/feedback'
    ? { settings: {}, playMusic() {}, placement() {}, elimination() {}, buttonTap() { taps.push(true); },
        undoMove() { events.push('undo'); }, iceBreak() { events.push('ice'); }, bloom() { events.push('bloom'); },
        result(success) { events.push(success ? 'win' : 'over'); } } : requireGame(name)
});
vm.runInContext(fs.readFileSync(gamePath, 'utf8'), sandbox);
const run = source => vm.runInContext(source, sandbox);

for (let i = 0; i < 100; i++) {
  assert.strictEqual(createTray({ includeLucky: true }).filter(s => s.lucky).length, 1);
  assert.ok(createTray().every(s => !s.lucky));
}
assert.ok(SHAPES.every(s => !s.lucky));

run('restartGame(); state.luckyPendingCount = 2; state.tray = [null, null, null]; finishTurn(0)');
assert.strictEqual(run('state.luckyPendingCount'), 1);
assert.strictEqual(run('state.tray.filter(s => s.lucky).length'), 1);
run('renderScene(ctx, layout, state)');
assert.ok(labels.includes('✦ 下一组获得幸运方块'));
assert.ok(labels.includes('✦ 幸运'));
run('state.luckyPendingCount = 2; renderScene(ctx, layout, state)');
assert.ok(labels.includes('✦ 下一组获得幸运方块 · 待领 2 个'));
run('stepAnimations(Date.now() + 3000)');
assert.strictEqual(run('state.luckyHighlightUntil'), 0);
labels.length = 0;
run('renderScene(ctx, layout, state)');
assert.ok(!labels.includes('✦ 幸运'));
run('state.luckyPendingCount = 1; state.tray = [null, null, null]; finishTurn(0)');
assert.strictEqual(run('state.luckyPendingCount'), 0);
assert.strictEqual(run('state.tray.filter(s => s.lucky).length'), 1);
labels.length = 0;
run('renderScene(ctx, layout, state)');
assert.ok(!labels.some(text => text.includes('下一组获得幸运方块')));
assert.ok(labels.includes('✦ 幸运'));

run('state.bestScores.easy = 100; restartGame(); state.score = 140; saveBestScore(); state.gameOver = true; state.gameOverProgress = 1; renderScene(ctx, layout, state)');
assert.ok(labels.includes('刷新纪录！'));
assert.ok(labels.includes('超越原纪录 40 分'));
assert.strictEqual(run('state.best'), 140);
for (const [score, expected] of [[90, '距离历史最佳还差 50 分'], [140, '追平历史最佳！']]) {
  run(`restartGame(); state.score = ${score}; state.gameOver = true; state.gameOverProgress = 1; renderScene(ctx, layout, state)`);
  assert.ok(labels.includes(expected));
}
run('state.bestScores.easy = 0; restartGame(); state.score = 8; state.gameOver = true; state.gameOverProgress = 1; renderScene(ctx, layout, state)');
assert.ok(labels.includes('你的第一份纪录'));

run('restartGame(); state.unavailableTray[0] = true');
const point = run('({clientX: layout.horizontalPadding + layout.traySlotWidth / 2, clientY: layout.trayY, identifier: 1})');
handlers.start({ changedTouches: [point] });
assert.strictEqual(run('state.feedback'), '暂时无处可放，先试试其他方块');
assert.strictEqual(run('state.drag'), null);
assert.strictEqual(storage.fangcunUnavailableHintSeen, true);
run('clearFeedback()');
handlers.start({ changedTouches: [point] });
assert.strictEqual(run('state.feedback'), '');
run('restartGame()');
assert.strictEqual(run('state.luckyPendingCount'), 0);
assert.strictEqual(run('state.luckyHighlightUntil'), 0);
// Choose each map through the real menu handlers, then drag a piece onto its far edge.
for (const id of ['easy', 'medium', 'hard']) {
  run('state.screen = "maps"');
  const tap = run(`(() => { const r = getMenuActions(layout)['${id}'];
    return { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, identifier: 2 }; })()`);
  handlers.start({ changedTouches: [tap] });
  handlers.end({ changedTouches: [tap] });
  run('stepAnimations(Date.now() + 1000)');
  assert.strictEqual(run('state.mode'), id);
  assert.strictEqual(run('state.screen'), 'playing');
  assert.strictEqual(run('state.board[0].length'), id === 'long' ? 6 : 9);
  assert.strictEqual(run('Math.round(layout.boardWidth / layout.cellSize)'), id === 'long' ? 6 : 9);
  for (let i = 0; i < 30; i++) {
    assert.ok(run(`createEnergyPalaces(state.mode).every(index => {
      const cols = MODES[state.mode].cols / 3;
      const row = Math.floor(index / cols) * 3, col = (index % cols) * 3;
      return state.board.slice(row, row + 3).every(r => r.slice(col, col + 3).every(v => v === 0));
    })`));
  }
  run("state.tray[0] = { id: 'dot', cells: [[0, 0]] }; updateTrayAvailability()");
  const start = run('({clientX: layout.horizontalPadding + layout.traySlotWidth / 2, clientY: layout.trayY, identifier: 3})');
  if (id === 'courtyard') {
    const missing = run(`({clientX: layout.boardX + layout.cellSize / 2,
      clientY: layout.boardY + layout.cellSize / 2 + Math.min(86, layout.cellSize * 2.2), identifier: 3})`);
    handlers.start({ changedTouches: [start] });
    handlers.end({ changedTouches: [missing] });
    assert.strictEqual(run('state.board[0][0]'), -1);
    assert.strictEqual(run('state.piecesPlaced'), 0);
    assert.strictEqual(run('state.tray[0].id'), 'dot');
  }
  const col = id === 'long' ? 5 : (id === 'courtyard' ? 4 : 8);
  const end = run(`({clientX: layout.boardX + (${col} + 0.5) * layout.cellSize,
    clientY: layout.boardY + 8.5 * layout.cellSize + Math.min(86, layout.cellSize * 2.2), identifier: 3})`);
  handlers.start({ changedTouches: [start] });
  handlers.end({ changedTouches: [end] });
  assert.strictEqual(run(`state.board[8][${col}]`), 1);
  assert.strictEqual(run('state.piecesPlaced'), 1);
  run('state.score = 200; saveBestScore()');
  assert.strictEqual(storage[run('MODES[state.mode].bestKey')], 200);
}
run('state.mode = "long"; restartGame(); state.energyPalaces = [5]');
assert.strictEqual(run('collectPalaceEnergy({palaces:[[1,2]]}).gained'), 1);
run('state.mode = "courtyard"; restartGame()');
assert.strictEqual(run('boardOccupancy()'), 0);
assert.strictEqual(run('completedCells({rows:[0], cols:[], palaces:[]}).length'), 7);
assert.strictEqual(run('trayIndexAt(layout.width / 2, layout.energyY)'), -1);
// Complete the upper energy palace through the real drag handler and its preview.
run(`state.energy = 2; state.energyPalaces = [1];
  for (let r = 0; r < 3; r++) for (let c = 3; c < 6; c++) state.board[r][c] = 1;
  state.board[2][5] = 0;
  state.tray[0] = {id:'dot', cells:[[0,0]]}; updateTrayAvailability();`);
const palaceStart = run('({clientX: layout.horizontalPadding + layout.traySlotWidth / 2, clientY: layout.trayY, identifier: 9})');
const palaceEnd = run(`({clientX: layout.boardX + 5.5 * layout.cellSize,
  clientY: layout.boardY + 2.5 * layout.cellSize + Math.min(86, layout.cellSize * 2.2), identifier: 9})`);
handlers.start({changedTouches:[palaceStart]});
sandbox.palaceEnd = palaceEnd;
run('updateDrag(pointOf(palaceEnd))');
assert.strictEqual(run('state.drag.previewClearingCells.length'), 9);
handlers.end({changedTouches:[palaceEnd]});
run('stepAnimations(Date.now() + 1000)');
assert.strictEqual(run('state.luckyPendingCount'), 1);
assert.strictEqual(run('state.energy'), 0);
assert.strictEqual(run('state.board[2][5]'), 0);
events.length = 0;
run('state.board = state.board.map(r => r.map(v => v === 0 ? 1 : v)); finishTurn(0)');
assert.strictEqual(run('state.gameOver'), true);
// 结算时要播结果音：这一局没有超过起始最高分，应当是收束音而不是通关音。
assert.deepStrictEqual(events, ['over']);
events.length = 0;
run('restartGame(); state.startingBest = 0; state.score = 30; state.board = state.board.map(r => r.map(v => v === 0 ? 1 : v)); finishTurn(0)');
assert.strictEqual(run('state.gameOver'), true);
assert.deepStrictEqual(events, ['win']);
// 放不下时棋盘上不画预览，手里的方块也不变样；能放时才出现落点预览。
{
  const { drawDynamicLayer } = requireGame('./js/renderer');
  const calls = [];
  const rec = new Proxy({}, {
    get(target, key) {
      if (key === 'fill' || key === 'stroke') return () => calls.push(key + ':' + target.fillStyle + '@' + target.globalAlpha);
      return key in target ? target[key] : () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  run('state.mode = "easy"; restartGame(); state.board[0][0] = 1');
  const dot = SHAPES.find(s => s.id === 'dot');
  const base = run('({ ...state, screen: "playing" })');
  const draw = (valid, target) => { calls.length = 0; drawDynamicLayer(rec, run('layout'), { ...base,
    drag: { shape: dot, bounds: { width: 1, height: 1 }, x: 100, y: 100, target, valid, previewClearingCells: [] } });
    return calls.slice(); };
  const invalid = draw(false, { col: 0, row: 0 });
  const offBoard = draw(false, null);
  const valid = draw(true, { col: 1, row: 0 });
  assert.strictEqual(invalid.length, 1, '放不下时只画手里的方块');
  assert.deepStrictEqual(invalid, offBoard, '在棋盘上放不下与还没到棋盘时画法一致');
  assert.strictEqual(valid.length, 2, '能放时多一个落点预览');
  assert.ok(!invalid.some(c => c.startsWith('stroke')), '不再画描边重影');
}
// 抬起事件被系统吞掉时（切后台、下拉通知栏），下一次触摸必须能自动恢复，
// 否则 onTouchStart 会一直认为旧手指还按着，整局无响应。
run('state.mode = "easy"; restartGame()');
const first = run('({clientX: layout.horizontalPadding + layout.traySlotWidth / 2, clientY: layout.trayY, identifier: 41})');
const second = run('({clientX: layout.horizontalPadding + layout.traySlotWidth * 1.5, clientY: layout.trayY, identifier: 42})');
handlers.start({ touches: [first], changedTouches: [first] });
assert.strictEqual(run('state.drag && state.drag.trayIndex'), 0);
handlers.start({ touches: [first, second], changedTouches: [second] });
assert.strictEqual(run('state.drag && state.drag.trayIndex'), 0); // 两指同时按着：忽略第二根
handlers.start({ touches: [second], changedTouches: [second] });
assert.strictEqual(run('state.drag && state.drag.trayIndex'), 1); // 第一根已消失：旧拖动作废
run('releaseStaleTouches()');
assert.strictEqual(run('state.drag'), null);
console.log('Game feedback checks passed');

// A press is visible before navigation; dragging away/cancelling never activates it.
run("restartGame();returnHome();let tapClock=100;Date.now=()=>tapClock;state.homeMode='garden'");
const homeRect=run('getHomeActions(layout).challenge');
const hp={clientX:homeRect.x+homeRect.width/2,clientY:homeRect.y+homeRect.height/2,identifier:51};
const event=p=>({touches:[p],changedTouches:[p]});
const oldTaps=taps.length;
handlers.start(event(hp));assert.equal(run('state.pressedButton'),'home-challenge');
assert.equal(run('state.homeMode'),'garden');
rectangles.length=0;run('renderScene(ctx,layout,state);drawDynamicLayer(ctx,layout,state)');
assert.ok(rectangles.some(r=>Math.abs(r[2]-homeRect.width*.95)<.01),'Pressed button visibly shrinks');
const outside={...hp,clientX:0,clientY:0};handlers.move(event(outside));handlers.end({touches:[],changedTouches:[outside]});
assert.equal(run('state.pressedRect'),null);assert.equal(taps.length,oldTaps);assert.equal(run('state.homeMode'),'garden');
handlers.start(event(hp));handlers.cancel({touches:[],changedTouches:[hp]});assert.equal(run('state.pressedRect'),null);
handlers.start(event(hp));handlers.end({touches:[],changedTouches:[hp]});
run('tapClock=210;stepAnimations(tapClock)');assert.equal(taps.length,oldTaps+1);assert.ok(run('Boolean(sceneTransition)'));
run('tapClock=320;stepAnimations(tapClock)');assert.equal(run('state.homeMode'),'challenge');assert.ok(run('state.transitionAlpha>0'));
run('tapClock=430;stepAnimations(tapClock)');assert.equal(run('sceneTransition'),null);assert.equal(run('state.transitionAlpha'),0);
// Free revival is gone from both labels and hit areas.
run("state.challenge=null;state.screen='playing';state.gameOver=true;state.gameOverProgress=1");
labels.length=0;run('renderScene(ctx,layout,state)');assert.ok(!labels.includes('复活 · 视频'));
run('state.videoToolsEnabled=true;renderScene(ctx,layout,state)');assert.ok(labels.includes('复活 · 视频'));
assert.equal(run('typeof reviveGarden'),'undefined');assert.ok(run("'revive' in getGameOverActions(layout,state)"));
console.log('Press feedback, release cancellation, page transitions and removal of free revival passed');

const played=[],vibrations=[];
const feedbackModule={exports:{}};
const audioWx={getStorageSync:()=>undefined,setStorageSync(){},vibrateShort:o=>vibrations.push(o.type),
 createInnerAudioContext:()=>({stop(){},play(){played.push({src:this.src,volume:this.volume,rate:this.playbackRate});},onError(){}})};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/platform/feedback.js'),'utf8'),{wx:audioWx,module:feedbackModule,require:createRequire(path.resolve(__dirname,'../js/platform/feedback.js'))});
const fb=feedbackModule.exports;
// 每个事件都要有自己的素材：按钮不再借用落子，通关不再借用充能。
const fired=action=>{const before=played.length;action();return played.slice(before);};
const sources={};
for (const [name,action] of [['按钮',()=>fb.buttonTap()],['落子',()=>fb.placement()],
  ['撤销',()=>fb.undoMove()],['破冰',()=>fb.iceBreak()],['开花',()=>fb.bloom()],['结束',()=>fb.result(false)],
  ['通关',()=>fb.result(true)],['消除',()=>fb.elimination(1,false,1)],
  ['连消',()=>fb.elimination(2,false,2)],['充能',()=>fb.elimination(1,true,1)]]) {
  const [sound]=fired(action);
  assert.ok(sound,`${name} 没有发声`);
  assert.ok(!sources[sound.src],`${name} 与 ${sources[sound.src]} 共用了同一个音效文件`);
  sources[sound.src]=name;
}
assert.equal(Object.keys(sources).length,10);
const pitches=[1,1.122,1.26,1.498];
for(let tier=0;tier<4;tier++){
 const [sound]=fired(()=>fb.elimination(tier+2,false,1));
 assert.equal(sound.src,'assets/audio/combo.wav');assert.equal(sound.rate,pitches[tier]);
}
const [charged]=fired(()=>fb.elimination(8,true,4));
assert.equal(charged.src,'assets/audio/energy.wav');assert.equal(charged.rate,1,'charge melody must not inherit combo transposition');
const [won]=fired(()=>fb.result(true));assert.equal(won.rate,1);
const [bloomed]=fired(()=>fb.bloom());assert.equal(bloomed.src,'assets/audio/bloom.wav');assert.equal(bloomed.rate,1);
assert.ok(bloomed.volume<won.volume);assert.equal(vibrations.at(-1),'light');
const bloomWav=fs.readFileSync(path.resolve(__dirname,'../assets/audio/bloom.wav'));
assert.equal(bloomWav.toString('ascii',0,4),'RIFF');assert.equal(bloomWav.readUInt16LE(22),1);assert.equal(bloomWav.readUInt32LE(24),44100);
assert.ok((bloomWav.length-44)/88200<.5,'bloom is a short feedback cue');
let peak=0;for(let i=44;i<bloomWav.length;i+=2)peak=Math.max(peak,Math.abs(bloomWav.readInt16LE(i)));
assert.ok(peak<32767);assert.equal(bloomWav.readInt16LE(44),0);assert.equal(bloomWav.readInt16LE(bloomWav.length-2),0);
assert.equal(require('crypto').createHash('sha1').update(fs.readFileSync(path.resolve(__dirname,'../assets/audio/bgm-v2.wav'))).digest('hex'),'a122d1fa2322749f61db14c3943abb35c3b8c033','background music stays unchanged');
const beforeTapHaptics=vibrations.length;fb.buttonTap();fb.placement();assert.equal(vibrations.length,beforeTapHaptics);
fb.setSoundEnabled(false);fb.setVibrationEnabled(false);
const playCount=played.length,vibrateCount=vibrations.length;
fb.buttonTap();fb.undoMove();fb.iceBreak();fb.bloom();fb.result(true);
assert.equal(played.length,playCount);assert.equal(vibrations.length,vibrateCount);
console.log('Ten distinct effects including a short bloom cue; sound/haptics respect disabled preferences');

// A settings write failure cannot leave audio playing after the toggle is off.
let musicPlaying=false,stopCount=0,writeFails=true;
const failedAudio={exports:{}},audioStore={};
const brokenWx={getStorageSync(){throw Error('read failed')},setStorageSync(k,v){if(writeFails)throw Error('full');audioStore[k]=v},
 createInnerAudioContext:()=>({play(){musicPlaying=true},pause(){musicPlaying=false},stop(){stopCount++},onError(){}})};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/platform/feedback.js'),'utf8'),{
 wx:brokenWx,module:failedAudio,require:createRequire(path.resolve(__dirname,'../js/platform/feedback.js'))});
const broken=failedAudio.exports;
broken.playMusic();assert.equal(musicPlaying,true);broken.setMusicEnabled(false);
assert.equal(musicPlaying,false);assert.equal(broken.settings.musicEnabled,false);
broken.setSoundEnabled(false);assert.equal(stopCount,10);
broken.setVibrationEnabled(false);broken.suspend();assert.equal(stopCount,20);
writeFails=false;require('../js/persistence/storage').retry(brokenWx);
assert.equal(audioStore.fangcunMusicEnabled,false);assert.equal(audioStore.fangcunSoundEnabled,false);
assert.equal(audioStore.fangcunVibrationEnabled,false);
console.log('Audio stops immediately despite storage failure; settings retry and background effects cleanup passed');

// Real settings flow: native feedback must never float above another panel.
const nativeFeedback = [];
wx.createFeedbackButton = options => {
  const button = { options, destroyed:false, shown:0,
    onTap(fn){this.tap=fn}, show(){this.shown++}, destroy(){this.destroyed=true} };
  nativeFeedback.push(button); return button;
};
run('releaseStaleTouches(); sceneTransition=null; state.confirmAction=null; state.helpOpen=false; state.settingsOpen=true; foreground=true; playerFeedback.sync(null); present()');
assert.equal(nativeFeedback.length,1);
assert.equal(nativeFeedback[0].options.text,'意见反馈  ›');
assert.equal(nativeFeedback[0].options.style.top,run('getSettingsActions(layout).feedback.y'));
run('present(); present()');assert.equal(nativeFeedback.length,1,'No repeated creation while idle');
const tapsBeforeFeedback=taps.length;nativeFeedback[0].tap();assert.equal(taps.length,tapsBeforeFeedback+1);
for(const overlay of ['state.helpOpen=true','state.confirmAction="restart"','foreground=false','state.settingsOpen=false']) {
  run(`${overlay}; present()`);
  assert.equal(nativeFeedback.at(-1).destroyed,true,overlay);
  run('state.helpOpen=false; state.confirmAction=null; foreground=true; state.settingsOpen=true; present()');
  assert.equal(nativeFeedback.at(-1).destroyed,false);
}
run('playerFeedback.sync(null)');
delete wx.createFeedbackButton;
let feedbackHelp;
wx.showModal=options=>{feedbackHelp=options;};
run('state.helpOpen=false; state.confirmAction=null; state.settingsOpen=true; sceneTransition=null; releaseStaleTouches(); present()');
const feedbackPoint=run('(() => {const r=getSettingsActions(layout).feedback;return {clientX:r.x+r.width/2,clientY:r.y+r.height/2,identifier:301};})()');
handlers.start({changedTouches:[feedbackPoint]});handlers.end({changedTouches:[feedbackPoint]});
run('stepAnimations(Date.now()+1000)');
assert.ok(feedbackHelp.content.includes('反馈与投诉'),'Unsupported clients get a usable alternative');
const failingFeedback=require('../js/platform/player-feedback').createPlayerFeedback({createFeedbackButton(){throw Error('unsupported')}},()=>{});
assert.doesNotThrow(()=>failingFeedback.sync({x:0,y:0,width:100,height:48}));
assert.equal(failingFeedback.available,false);
console.log('Native feedback: one button, tap sound, modal/background cleanup and unsupported-client fallback passed');

// The real three-flower puzzle opens two flowers before its final winning bloom.
sandbox.flowerClearCues=[];
run('feedback.elimination=()=>flowerClearCues.push(true)');
run('state.settingsOpen=false;state.helpOpen=false;restartGame(null,challenges.start(42))');
let intermediateBlooms=0;
for(const [slot,c,r] of requireGame('./js/challenge/challenges').level(42).solution){
 const before=run('state.challenge.flowers.filter(f=>f[2]===0).length');events.length=0;sandbox.flowerClearCues.length=0;
 run(`playChallenge({trayIndex:${slot},target:{col:${c},row:${r}}});stepAnimations(Date.now()+1000);stepAnimations(Date.now()+2000)`);
 const opened=run('state.challenge.flowers.filter(f=>f[2]===0).length')-before;
 if(run('state.challenge.won')){
  assert.ok(opened>0);assert.deepStrictEqual(events,['win'],'final flower uses the winning cue without another bloom sound');
 } else if(opened){
  intermediateBlooms++;assert.deepStrictEqual(events,['bloom'],'an actual nonfinal bloom has one distinct cue');
  assert.equal(sandbox.flowerClearCues.length,0,'opening a flower does not also play the ordinary clear cue');
 } else assert.ok(!events.includes('bloom'),'placement and watering alone do not play the bloom cue');
}
assert.equal(intermediateBlooms,2);assert.ok(run('state.challenge.won'));
console.log('Actual flower play: watering stays quiet, intermediate blooms are distinct, final bloom yields to success');

// Animation callbacks cannot restart sound/vibration after hiding or while a video plays.
fb.setSoundEnabled(true);fb.setVibrationEnabled(true);fb.suspend();
const suspendedSounds=played.length, suspendedVibrations=vibrations.length;
fb.result(true);fb.iceBreak();fb.elimination(2,true,2);fb.placement();fb.setMusicEnabled(true);
assert.equal(played.length,suspendedSounds);assert.equal(vibrations.length,suspendedVibrations);
fb.resume();fb.result(true);
assert.ok(played.length>suspendedSounds);assert.ok(vibrations.length>suspendedVibrations);
console.log('Background and video suspension gates both sound and vibration');
