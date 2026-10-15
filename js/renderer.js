const {
  nearbyEnergy,
  drawBoard,
  drawClearAnimation,
  drawPlacementPreview,
  drawIceAnimation,
  drawDraggedShape,
  drawMechanicGuide,
  drawEnergy,
  drawSuggestion,
  drawTray
} = require('./views/board-view');
const {
  getSettingsButton,
  getConfirmActions,
  drawConfirm,
  getSettingsActions,
  drawSettings,
  getHelpActions,
  drawHelp,
  getGoalAction,
  getPlayPanelActions,
  drawPlayPanel
} = require('./views/panel-view');
const {
  getHomeActions,
  getBackButton,
  getSpecialActions,
  drawSpecial,
  getChapterActions,
  getLevelViewport,
  levelScrollFor,
  getLevelActions,
  getMenuActions,
  getGravityEntry,
  drawMenu,
  drawPicker,
  getCollectionTabs,
  getCollectionActions,
  drawCollection,
  getRankingButton
} = require('./views/menu-view');
const { COLORS, MODES } = require('./config');
const challenges = require('./challenge/challenges');
const art = require('./views/art');
const collection = require('./progression/collection');
const { focusForState: collectionFocus, growthForState: gardenGrowth } = collection;
const mechanicGuide = require('./progression/mechanic-guide');
const basics = require('./progression/basics');
const sharing = require('./platform/sharing');
const undoBudget = require('./rules/undo-budget');
const goals = require('./progression/goals');
const { roundedRect, text, pressedRect, button, drawSettingsIcon } = require('./views/canvas-ui');
const { drawTarget } = require('./views/board-symbols');
const GARDEN_COLORS = { ...COLORS };
const CHALLENGE_COLORS = { ...COLORS, background:'#E8EFFB', panel:'#FFFFFF', text:'#263E6A',
  secondaryText:'#4D6081', primaryButton:'#354FBE', block:'#7999D9', emptyCell:'#DEE5F3',
  boardEdge:'#BECBEA', palaceLine:'#ACBCD7', energyEmptyCell:'#D9E3F6', clearGlow:'#FFF1CA' };

function challengeTarget(run) {
  const level=challenges.level(run.level);
  const [name,unit]={rows:['整行','行'],cols:['整列','列'],palaces:['九宫','个'],
    regions:['消除','次'],cross:['同步消除','次'],ice:['薄冰','块'],area:['区域方块','格'],flowers:['花圃','处'],keys:['机关','道'],stones:['标记','个']}[level.kind];
  return {name,unit,remaining:Math.max(0,level.target-run.progress)};
}

function drawHeader(ctx, layout, state) {
  const run=state.challenge, level=run&&challenges.level(run.level), x=layout.horizontalPadding;
  const target=run&&challengeTarget(run);
  text(ctx,'‹ 返回',40,layout.settingsY+30,13);
  text(ctx,run?`${run.invited?'好友挑战':run.dailyDate?'每日精选':`第 ${challenges.level(run.level).number} 关`} · ${level.title}`:'清雅庭院',layout.width/2,layout.settingsY+30,17,COLORS.text,'center','600');
  drawSettingsIcon(ctx,getSettingsButton(layout),COLORS.secondaryText);
  text(ctx,run?`${target.name}还差`:state.gardenIntro?'教学不计分':'本局分数',x,layout.scoreY-30,11,COLORS.secondaryText,'left');
  text(ctx,run?`${target.remaining} ${target.unit}`:state.score,x,layout.scoreY,run?28:32,COLORS.text,'left','600');
  text(ctx,run?'剩余步数':MODES[state.mode].title+' · 个人最佳',layout.width-x,layout.scoreY-30,11,COLORS.secondaryText,'right');
  text(ctx,run?`${Math.max(0,level.limit-run.history.length)} 步`:state.best,layout.width-x,layout.scoreY,run?28:19,COLORS.text,'right','600');
  const actions = getChallengeActions(layout, state);
  const remaining=undoBudget.remaining(undoBudget.current(state)), supplement=undoBudget.canSupplement(state);
  ctx.globalAlpha = undoBudget.hasHistory(state) && (remaining || supplement) ? 1 : 0.55;
  const undoRect=pressedRect(state,'challenge-undo',actions.undo);
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,undoRect.x,undoRect.y,undoRect.width,undoRect.height,14);ctx.fill();
  text(ctx,supplement?'补充撤回':'撤回',undoRect.x+undoRect.width/2,undoRect.y+19,supplement?12:14,COLORS.text,'center','600');
  text(ctx,supplement?'视频 +1':`剩余 ${remaining} 次`,undoRect.x+undoRect.width/2,undoRect.y+35,10,COLORS.secondaryText);
  ctx.globalAlpha = 1;
  if (actions.hint) {
  const hintRect = pressedRect(state, 'tool-hint', actions.hint);
  ctx.fillStyle = COLORS.panel; roundedRect(ctx,hintRect.x,hintRect.y,hintRect.width,hintRect.height,14);ctx.fill();
  text(ctx,'提示',hintRect.x+hintRect.width/2,hintRect.y+19,14,COLORS.text,'center','600');
  const free = hintSource(state) === 'free';
  text(ctx,free?'免费':'视频',hintRect.x+hintRect.width/2,hintRect.y+35,10,free?COLORS.primaryButton:COLORS.secondaryText,'center',free?'600':'400');
  }
  if (run) {
    const spare = level.par - run.history.length;
    const firstPass=!run.dailyDate && !run.invited && !state.challengeProgress.stars[run.level];
    text(ctx, run.won ? `${challenges.stars(run)} 星完成` : firstPass ? '先完成目标 · 通关后可再争三星' : spare > 0 ? `三星还可用 ${spare} 步` : '仍可通关 · 重玩可再争三星', layout.width-x, layout.scoreY+24, 11, COLORS.secondaryText, 'right');
  }
  const focus=collectionFocus(state);
  if(focus)text(ctx,focus.text,layout.width/2,layout.boardY-71,11,COLORS.secondaryText);
  const y=layout.boardY-60;
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,y,layout.width-x*2,44,13);ctx.fill();
  const marked=run && level.kind==='stones';
  if(marked)drawTarget(ctx,x+12,y+5,17);
  ctx.font=`600 ${run?16:13}px sans-serif`;ctx.fillStyle=COLORS.text;ctx.textAlign='left';
  ctx.fillText(run?challenges.goal(level):state.gardenIntro?'第一次消除 · 为庭院添修竹':'填满就消除 · 挑战更高分',
    x+(marked?35:13),y+(run?19:18),layout.width-x*2-(marked?35:13)-72);
  const near=nearbyEnergy(state);
  const lessonMove=mechanicGuide.move(state.mechanicGuide,run);
  const detail=state.feedback || (run
    ? lessonMove?'把下方描边方块拖到虚线处，试试看':state.mechanicGuide?state.mechanicGuide.lines[0]:challenges.detail(level)
    : state.gardenIntro?'把下方方块拖到虚线处，填满这个 3×3 九宫'
    : near?`描金九宫还差 ${near.missing} 格 · 填满可充能`
    : state.energyGuideVisible && !state.tutorialVisible?'清除 ✦ 九宫集能量，满三点后下一组送幸运方块'
    : state.tutorialVisible?'拖动方块，填满一行、一列或九宫试试看'
    : state.welcomeEnergy?'首次体验已点亮两点，清除 ✦ 目标宫可充满'
    : '不限时 · 托盘都放不下时结束');
  ctx.font='11px sans-serif';ctx.fillStyle=COLORS.secondaryText;ctx.textAlign='left';
  ctx.fillText(detail,x+13,y+35,layout.width-x*2-26);
  text(ctx,run?`${Math.min(run.progress,level.target)} / ${level.target} ⓘ`:'规则 ⓘ',layout.width-x-13,y+18,12,COLORS.primaryButton,'right','600');
}

// 永久禁区画成"被占住的东西"，而不是叉号：叉号读作"错误 / 禁止"，
// 而禁区在消除判定里算已占用，穿过它的行列照样能消。
// slab：相连的禁区合成一整块石台（中等的中央 3×3）；stone：每格一枚棋子（困难的星位）。

// —— 动态层：每帧重画，绝不进入场景缓存 ——

// 落点预览只在能放的时候出现："出现预览 = 能放，没有预览 = 放不下"，不依赖颜色。
// 放不下时若也画一个描边预览，它和手里的方块只差不到半格，看起来像重影。

function drawDynamicLayer(ctx, layout, state) {
  if (state.screen === 'playing'
    && (!state.gameOver || state.clearingCells.length || (state.breakingIce || []).length)
    && !state.settingsOpen && !state.helpOpen && !state.confirmAction && !state.playPanel) {
    drawClearAnimation(ctx, layout, state);
    drawIceAnimation(ctx, layout, state);
    if(state.mechanicGuide && !state.drag)drawMechanicGuide(ctx,layout,state);
    drawPlacementPreview(ctx, layout, state);
    drawDraggedShape(ctx, layout, state);
  }
  if (state.pressedRect && state.pressedButton) {
    const r = pressedRect(state, state.pressedButton, state.pressedRect);
    ctx.save();ctx.globalAlpha=.12;ctx.fillStyle=COLORS.primaryButton;
    roundedRect(ctx,r.x,r.y,r.width,r.height,16);ctx.fill();ctx.restore();
  }
  if (state.transitionAlpha > 0) {
    ctx.globalAlpha = Math.min(1, state.transitionAlpha);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.globalAlpha = 1;
  }
  if(state.rewardBusy) {
    ctx.fillStyle='rgba(25,40,65,.5)';ctx.fillRect(0,0,layout.width,layout.height);
    text(ctx,'正在准备视频…',layout.width/2,layout.height/2,18,'#FFFFFF');
  }

}

function resultSummary(state) {
  const run=state.challenge;
  if (!run) {
    const change=collection.growthResult(state.collection,collection.totalStars(state.challengeProgress),state.sessionClears);
    if(change)return change.text;
    return `本局积累 ${state.sessionClears || 0} 次消除 · 连消最高 ×${state.maxCombo}`;
  }
  const comparison=sharing.comparison(run);
  if (comparison) return comparison;
  if (run.invited) return run.won?'独立试玩完成 · 你的原有进度保留':'固定棋盘与方块，重试仍是同一道题';
  if (run.dailyDate) {
    const record=(state.dailyProgress.records || []).find(item=>item.date===run.dailyDate && item.level===run.level && item.rule===challenges.level(run.level).rule);
    return run.won?`当日印记已点亮 · 最佳 ${record?record.bestSteps:state.piecesPlaced} 步`:'固定棋盘与方块，重试仍是同一道题';
  }
  if (!run.won) return run.level>=12?'失败后可用一次机会回退 1～3 步':'每次重试，棋盘和方块都相同';
  if (challenges.nextLevel(run.level)===null) return state.challengeProgress.stars.every(Boolean)?'所有章节已完成 · 再挑战三星':'本章完成 · 小径已通';
  return challenges.level(run.level).order===challenges.chapterLevels(challenges.level(run.level).chapter).length-1?'本章完成，新的机关在下一章等你':'新的布局，在下一段石径等你';
}

function drawGameOver(ctx, layout, state) {
  if (!state.gameOver || (state.clearingCells && state.clearingCells.length) || (state.breakingIce || []).length) return;
  const run=state.challenge,won=run&&run.won,newRecord=state.score>state.startingBest;
  const actions=getGameOverActions(layout,state),width=Math.min(330,layout.width-48),x=(layout.width-width)/2;
  ctx.fillStyle=COLORS.background;ctx.fillRect(0,0,layout.width,layout.height);
  const top=Math.max(layout.safeTop+28,layout.settingsY);
  text(ctx,run?`${run.invited?'好友挑战':run.dailyDate?run.dailyDate+' · 每日精选':`第 ${challenges.level(run.level).number} 关`} · ${challenges.level(run.level).title}`:'清雅庭院 · 本局回顾',layout.width/2,top+15,13,COLORS.secondaryText);
  const artHeight=Math.max(48,Math.min(145,actions.restart.y-top-306));
  (run?art.path:art.garden)(ctx,{x:(layout.width-250)/2,y:top+24,width:250,height:artHeight},run?(run.level<0?-run.level:challenges.level(run.level).number):state.decor,null,run?null:collection.growthResult(state.collection,collection.totalStars(state.challengeProgress),state.sessionClears)||gardenGrowth(state));
  const titleY=top+artHeight+46;
  text(ctx,run?(won?(challenges.level(run.level).kind==='flowers'?'花开成景了！':'小径打通了！'):'换个思路，再试一次'):newRecord?'刷新纪录！':'又一局，留在庭间',layout.width/2,titleY,25,COLORS.text,'center','600');
  if(run&&won){
    const earned=challenges.stars(run);
    for(let i=0;i<3;i++) {
      const reveal = Math.max(0, Math.min(1, ((state.gameOverProgress ?? 1) - i * .28) / .32));
      art.star(ctx, layout.width/2+(i-1)*35, titleY+37, i<earned?8+5*reveal:13,
        i<earned && reveal>0?'#B47D26':'#C4CBD8');
    }
    text(ctx,`${state.piecesPlaced} 步完成 · ${state.score} 分`,layout.width/2,titleY+70,13,COLORS.secondaryText);
    const fewer=run.history.length-challenges.level(run.level).par;
    const best=!run.dailyDate&&!run.invited&&state.challengeProgress.bestSteps&&state.challengeProgress.bestSteps[run.level];
    text(ctx,fewer>0?`再少用 ${fewer} 步即可三星${best?` · 最佳 ${best} 步`:''}`:
      best?`${state.resultPreviousBest&&best<state.resultPreviousBest?'刷新个人最少步数':'本关个人最佳'} · ${best} 步`:'三星完成 · 好布局值得分享',layout.width/2,titleY+91,12,COLORS.primaryButton);
  } else if (run) {
    const target=challengeTarget(run);
    text(ctx,`${target.name}还差 ${target.remaining} ${target.unit}`,layout.width/2,titleY+51,24,COLORS.text,'center','600');
    text(ctx,run.history.length>=challenges.level(run.level).limit?'步数已用完，目标还未完成':'当前托盘已无处可放，目标还未完成',layout.width/2,titleY+80,13,COLORS.secondaryText);
    text(ctx,hintSource(state)==='free'?'重试可用一次免费提示':'朋友可从这一关的初始棋盘尝试解法',layout.width/2,titleY+100,11,COLORS.secondaryText);
  } else {
    text(ctx,state.score,layout.width/2,titleY+51,42,COLORS.text,'center','600');
    const message=newRecord?(state.startingBest?`超越原纪录 ${state.score-state.startingBest} 分`:'你的第一份纪录'):
      (state.startingBest===state.score&&state.startingBest>0?'追平历史最佳！':`距离历史最佳还差 ${Math.max(0,state.startingBest-state.score)} 分`);
    text(ctx,message,layout.width/2,titleY+80,13,COLORS.secondaryText);
    text(ctx,'本局结束：托盘方块都放不下了',layout.width/2,titleY+101,11,COLORS.secondaryText);
  }
  const fresh=collection.fresh(state.collection,collection.totalStars(state.challengeProgress));
  if((won || !run) && fresh.length)text(ctx,`庭院新添「${collection.named(fresh[0])}」· 回首页看看`,
    layout.width/2,Math.min(titleY+116,actions.share.y-10),10,COLORS.primaryButton);
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,actions.restart.y-76,width,60,15);ctx.fill();
  const special=run&&(run.dailyDate||run.invited);
  text(ctx,resultSummary(state),layout.width/2,actions.restart.y-50,13);
  const focus=collectionFocus(state);
  text(ctx,state.savePending?(run && !special?'星级待保存，请稍候再退出':'进度待保存，请稍候再退出'):focus?focus.text:collection.progressLine(state.collection,collection.totalStars(state.challengeProgress),run?'stars':'clears'),layout.width/2,actions.restart.y-28,12,COLORS.secondaryText);
  button(ctx,actions.restart,run?(won?(run.invited?'再挑战一次':run.dailyDate?'返回每日精选':challenges.nextLevel(run.level)===null?'回顾全部关卡':challenges.level(run.level).order===challenges.chapterLevels(challenges.level(run.level).chapter).length-1?`走进第 ${challenges.level(run.level).chapter+2} 章`:`进入第 ${challenges.level(challenges.nextLevel(run.level)).number} 关`):'重新挑战'):'再来一局',true,state,'gameover-restart');
  button(ctx,actions.menu,'返回首页',false,state,'gameover-menu');
  if (run && !won) {
    if(actions.undo)button(ctx,actions.undo,undoBudget.canSupplement(state)?'补充撤回 · 视频':`回退调整 · ${undoBudget.remaining(undoBudget.current(state))}次`,false,state,'challenge-undo',13);
    button(ctx,actions.share,'请朋友看看',false,state,'result-share',13);
  } else {
    if (actions.retry) button(ctx,actions.retry,'再挑战一次',false,state,'gameover-retry');
    button(ctx, pressedRect(state, 'result-share', actions.share), '分享成绩');
    if(!run && actions.revive) {
      ctx.globalAlpha=state.reviveUsed?.55:1;
      button(ctx,actions.revive,state.reviveUsed?'复活已用':'复活 · 视频',false,state,'tool-revive');
      ctx.globalAlpha=1;
    }
  }
}
function getGameOverActions(layout, state = null) {
  const width=Math.min(330,layout.width-48),x=(layout.width-width)/2,bottom=layout.height-layout.safeBottom-24;
  const retry=state&&state.challenge&&state.challenge.won&&!state.challenge.invited;
  const failure=state&&state.challenge&&!state.challenge.won;
  const adjustment=failure&&undoBudget.hasHistory(state)&&(undoBudget.remaining(undoBudget.current(state))||undoBudget.canSupplement(state));
  const split=retry||adjustment||(state&&!state.challenge&&state.videoToolsEnabled);
  return {restart:{x,y:bottom-116,width,height:50},menu:{x,y:bottom-54,width,height:48},
    share:{x:retry||adjustment?x+(width+12)/2:x,y:bottom-248,width:split?(width-12)/2:width,height:48},
    ...(retry?{retry:{x,y:bottom-248,width:(width-12)/2,height:48}}:{}),
    ...(state&&!state.challenge&&state.videoToolsEnabled?{revive:{x:x+(width+12)/2,y:bottom-248,width:(width-12)/2,height:48}}:{}),
    ...(!state||adjustment?{undo:{x,y:bottom-248,width:adjustment?(width-12)/2:width,height:48}}:{})};
}

// 提示入口：闯关送的免费提示优先，其次才是视频。
function hintSource(state) {
  if (!state || state.gardenIntro || state.basics) return null;
  if (state.challenge && !state.challenge.dailyDate && !state.challenge.invited && challenges.freeHintReady(state.challengeProgress, state.challenge.level)) return 'free';
  return state.videoToolsEnabled ? 'video' : null;
}
function getChallengeActions(layout, state = null) {
  const hint = hintSource(state);
  const y=layout.scoreY-(state&&state.challenge?32:26);
  return {
    undo: { x: layout.width / 2 - (hint?60:28), y, width: 56, height: 44 },
    ...(hint?{hint: { x: layout.width / 2 + 4, y, width: 56, height: 44 }}:{})
  };
}

function getBasicsActions(layout) {
  const width=Math.min(310,layout.width-48),x=(layout.width-width)/2;
  return {skip:getSettingsButton(layout),next:{x:x+20,y:layout.boardY+layout.boardHeight/2+35,width:width-40,height:46}};
}
function drawBasics(ctx,layout,state) {
  const lesson=state.basics,center=layout.width/2,rule=basics.LESSONS[lesson.step],actions=getBasicsActions(layout);
  text(ctx,'‹ 返回',40,layout.settingsY+30,13);
  text(ctx,'基础练习',center,layout.settingsY+30,17,COLORS.text,'center','600');
  text(ctx,'跳过',actions.skip.x+actions.skip.width/2,actions.skip.y+30,12,COLORS.secondaryText);
  text(ctx,`${lesson.step+1} / 3`,center,layout.scoreY-22,22,COLORS.primaryButton,'center','600');
  text(ctx,'练习不计分，不消耗撤回',center,layout.scoreY+3,12,COLORS.secondaryText);
  if(!lesson.done || state.clearingCells.length){
  text(ctx,rule.title,center,layout.boardY-39,15,COLORS.text,'center','600');
  text(ctx,state.feedback || rule.detail,center,layout.boardY-18,11,COLORS.secondaryText);
  drawBoard(ctx,layout,state);
  if(lesson.step===1){
    ctx.strokeStyle=COLORS.primaryButton;ctx.lineWidth=2;
    roundedRect(ctx,layout.boardX+3*layout.cellSize,layout.boardY+3*layout.cellSize,3*layout.cellSize,3*layout.cellSize,4);ctx.stroke();
  }
  text(ctx,'方向固定，按住方块拖到空位',center,layout.energyY+4,12,COLORS.secondaryText);
  drawTray(ctx,layout,state);drawSuggestion(ctx,layout,state);
  }
  if(lesson.done && !state.clearingCells.length){
    const width=actions.next.width+40,x=actions.next.x-20,y=actions.next.y-132;
    ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,y,width,192,18);ctx.fill();
    text(ctx,'学会了，去挑战吧',center,y+34,17,COLORS.text,'center','600');
    text(ctx,state.basicsReturn?'原对局进度已保留':'庭院新添一株修竹',center,y+61,12,COLORS.secondaryText);
      art.garden(ctx,{x:x+8,y:y+68,width:90,height:60},['bamboo']);
      text(ctx,'消除积累进度',x+109,y+88,12,COLORS.text,'left');
      text(ctx,'解锁庭院花木',x+109,y+110,12,COLORS.secondaryText,'left');
    button(ctx,actions.next,state.basicsReturn?'返回原处':'开始游戏',true,state,'basics-next',15);
  }
}

// 场景层：除拖动方块、落点预览、消除动画之外的一切。
// 只有状态真正变化时才重画一次，拖动过程中一帧都不重画。
function renderScene(ctx, layout, state) {
  const blue=state.screen==='playing'?Boolean(state.challenge):state.homeMode==='challenge';
  Object.assign(COLORS,blue?CHALLENGE_COLORS:GARDEN_COLORS);
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  if (state.screen === 'maps' || state.screen === 'levels') { drawPicker(ctx,layout,state); return; }
  if (state.screen === 'collection') { drawCollection(ctx,layout,state); return; }
  if (state.screen === 'daily' || state.screen === 'invitation') { drawSpecial(ctx,layout,state); return; }
  if (state.screen === 'menu') {
    drawMenu(ctx, layout, state);
    drawSettings(ctx, layout, state);
    drawHelp(ctx, layout, state);
    return;
  }
  if(state.basics){drawBasics(ctx,layout,state);return;}
  const resultVisible=state.gameOver && !(state.clearingCells || []).length && !(state.breakingIce || []).length;
  if(!resultVisible){
    drawHeader(ctx, layout, state);
    drawBoard(ctx, layout, state);
    drawEnergy(ctx, layout, state);
    drawTray(ctx, layout, state);
    drawSuggestion(ctx, layout, state);
  }
  drawGameOver(ctx, layout, state);
  drawSettings(ctx, layout, state);
  drawHelp(ctx, layout, state);
  drawConfirm(ctx, layout, state);
  drawPlayPanel(ctx, layout, state);
}

module.exports = {
  roundedRect,
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
};
