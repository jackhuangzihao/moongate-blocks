const { COLORS, MODES } = require('../config');
const undoBudget = require('../rules/undo-budget');
const goals = require('../progression/goals');
const { roundedRect, text, pressedRect, button, wrapText } = require('./canvas-ui');
const { drawTarget, drawFlower, drawKey } = require('./board-symbols');

const SETTINGS_PANEL_HEIGHT = 518;

function getSettingsButton(layout) {
  return { x: layout.width - 64, y: layout.settingsY, width: 48, height: 48 };
}

function getConfirmActions(layout) {
  const width = Math.min(290, layout.width - 48);
  const x = (layout.width - width) / 2;
  const y = (layout.height - 210) / 2;
  return {
    cancel: { x: x + 20, y: y + 136, width: (width - 50) / 2, height: 48 },
    confirm: { x: x + 30 + (width - 50) / 2, y: y + 136, width: (width - 50) / 2, height: 48 }
  };
}

function drawConfirm(ctx, layout, state) {
  if (!state.confirmAction) return;
  ctx.fillStyle = 'rgba(45, 49, 46, 0.58)';
  ctx.fillRect(0, 0, layout.width, layout.height);
  const actions = getConfirmActions(layout);
  const panelX = actions.cancel.x - 20;
  const panelY = actions.cancel.y - 137;
  const panelWidth = actions.confirm.x + actions.confirm.width - panelX + 20;
  ctx.fillStyle = COLORS.panel;
  roundedRect(ctx, panelX, panelY, panelWidth, 210, 20);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 21px sans-serif';
  ctx.fillText(state.confirmAction === 'restart' ? '重新开始？' : '返回模式选择？',
    layout.width / 2, panelY + 52);
  ctx.fillStyle = COLORS.secondaryText;
  ctx.font = '14px sans-serif';
  ctx.fillText(state.confirmAction === 'restart' ? '当前对局进度将不会保留'
    : '保留本局，稍后可以继续', layout.width / 2, panelY + 84);
  const cancelButton = pressedRect(state, 'confirm-cancel', actions.cancel);
  const confirmButton = pressedRect(state, 'confirm-confirm', actions.confirm);
  ctx.fillStyle = COLORS.surfaceWarm;
  roundedRect(ctx, cancelButton.x, cancelButton.y,
    cancelButton.width, cancelButton.height, 23);
  ctx.fill();
  ctx.fillStyle = COLORS.primaryButton;
  roundedRect(ctx, confirmButton.x, confirmButton.y,
    confirmButton.width, confirmButton.height, 23);
  ctx.fill();
  ctx.font = '600 15px sans-serif';
  ctx.fillStyle = COLORS.secondaryText;
  ctx.fillText('取消', cancelButton.x + cancelButton.width / 2,
    cancelButton.y + cancelButton.height / 2 + 5);
  ctx.fillStyle = COLORS.onPrimary;
  ctx.fillText('确定', confirmButton.x + confirmButton.width / 2,
    confirmButton.y + confirmButton.height / 2 + 5);
}

function settingsPanel(layout) {
  const width = Math.min(310, layout.width - 48);
  const x = (layout.width - width) / 2;
  const height = Math.min(SETTINGS_PANEL_HEIGHT, layout.height - layout.safeTop - layout.safeBottom - 8);
  const y = layout.safeTop + (layout.height - layout.safeTop - layout.safeBottom - height) / 2;
  return { x, y, width, height };
}
function getSettingsActions(layout) {
  const { x, y, width, height } = settingsPanel(layout), actions = {};
  const step = (height - 64 - 24 - 48) / 7;
  ['sound', 'music', 'vibration', 'guide', 'appearance', 'feedback', 'restart', 'menu'].forEach((name, i) => {
    actions[name] = { x: x + 24, y: y + 64 + i * step, width: width - 48, height: 48 };
  });
  actions.close = { x: x + width - 60, y: y + 6, width: 48, height: 48 };
  return actions;
}

function drawToggle(ctx, rect, enabled, state, id) {
  const width = 44;
  const height = 24;
  const base = { x: rect.x + rect.width - width,
    y: rect.y + (rect.height - height) / 2, width, height };
  const visual = pressedRect(state, id, base);
  const x = visual.x;
  const y = visual.y;
  ctx.fillStyle = enabled ? COLORS.block : COLORS.gridLine;
  roundedRect(ctx, x, y, visual.width, visual.height, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + (enabled ? visual.width - 12 : 12), y + visual.height / 2,
    Math.min(9, visual.height * 0.38), 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

function drawSettings(ctx, layout, state) {
  if (!state.settingsOpen) return;
  ctx.fillStyle = 'rgba(45, 49, 46, 0.48)';
  ctx.fillRect(0, 0, layout.width, layout.height);
  const actions = getSettingsActions(layout);
  const { x: panelX, y: panelY, width: panelWidth, height } = settingsPanel(layout);
  ctx.fillStyle = COLORS.panel;
  roundedRect(ctx, panelX, panelY, panelWidth, height, 22);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 23px sans-serif';
  ctx.fillText('设置', layout.width / 2, panelY + 46);
  ctx.fillStyle = state.pressedButton === 'settings-close' ? COLORS.text : COLORS.secondaryText;
  ctx.font = '22px sans-serif';
  ctx.fillText('×', actions.close.x + actions.close.width / 2,
    actions.close.y + actions.close.height / 2 + 7);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px sans-serif';
  ctx.fillText('音效', actions.sound.x, actions.sound.y + 30);
  ctx.fillText('音乐', actions.music.x, actions.music.y + 30);
  ctx.fillText('震动', actions.vibration.x, actions.vibration.y + 30);
  ctx.fillStyle = state.pressedButton === 'settings-guide' ? COLORS.accent : COLORS.text;
  ctx.fillText('玩法说明', actions.guide.x, actions.guide.y + 30);
  ctx.fillStyle = state.pressedButton === 'settings-appearance' ? COLORS.accent : COLORS.text;
  ctx.fillText('外观', actions.appearance.x, actions.appearance.y + 30);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.secondaryText;
  ctx.font = '18px sans-serif';
  ctx.fillText('›', actions.guide.x + actions.guide.width, actions.guide.y + 30);
  ctx.fillText('›', actions.appearance.x + actions.appearance.width, actions.appearance.y + 30);
  drawToggle(ctx, actions.sound, state.soundEnabled, state, 'settings-sound');
  drawToggle(ctx, actions.music, state.musicEnabled, state, 'settings-music');
  drawToggle(ctx, actions.vibration, state.vibrationEnabled, state, 'settings-vibration');

  const feedbackButton = pressedRect(state, 'settings-feedback', actions.feedback);
  ctx.fillStyle = COLORS.surfaceMuted;
  roundedRect(ctx, feedbackButton.x, feedbackButton.y, feedbackButton.width, feedbackButton.height, 12);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px sans-serif';
  ctx.fillText('意见反馈  ›', layout.width / 2, feedbackButton.y + feedbackButton.height / 2 + 5);

  if (state.screen === 'menu') {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.secondaryText;
    ctx.font = '13px sans-serif';
    ctx.fillText('哪里不清楚、哪里不好玩，都欢迎反馈', layout.width / 2, actions.restart.y + 24);
    ctx.font = '12px sans-serif';
    ctx.fillText('我们会参考大家的反馈持续改进', layout.width / 2, actions.restart.y + 48);
  } else {
    const restartButton = pressedRect(state, 'settings-restart', actions.restart);
    const menuButton = pressedRect(state, 'settings-menu', actions.menu);
    ctx.fillStyle = COLORS.surfaceWarm;
    roundedRect(ctx, restartButton.x, restartButton.y,
      restartButton.width, restartButton.height, 23);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.alertText;
    ctx.font = '600 16px sans-serif';
    ctx.fillText('重新开始', layout.width / 2,
      restartButton.y + restartButton.height / 2 + 5);

    ctx.fillStyle = COLORS.surfaceMuted;
    roundedRect(ctx, menuButton.x, menuButton.y,
      menuButton.width, menuButton.height, 22);
    ctx.fill();
    ctx.fillStyle = COLORS.secondaryText;
    ctx.font = '600 15px sans-serif';
    ctx.fillText('返回模式选择', layout.width / 2,
      menuButton.y + menuButton.height / 2 + 5);
  }
}

function getHelpActions(layout) {
  const width=Math.min(330,layout.width-32),height=330,x=(layout.width-width)/2,y=(layout.height-height)/2;
  return {panel:{x,y,width,height},practice:{x:x+16,y:y+height-62,width:(width-40)/2,height:48},
    confirm:{x:x+24+(width-40)/2,y:y+height-62,width:(width-40)/2,height:48}};
}

function drawHelp(ctx,layout,state) {
  if(!state.helpOpen)return;
  const a=getHelpActions(layout),{x,y,width,height}=a.panel,center=layout.width/2;
  ctx.fillStyle='rgba(45,49,46,.55)';ctx.fillRect(0,0,layout.width,layout.height);
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,y,width,height,22);ctx.fill();
  text(ctx,'玩法说明',center,y+36,22,COLORS.text,'center','600');
  const lines=[
    '填满行、列或 3×3 九宫即可消除',
    '自由消除：冲高分，全放不下时结束',
    '目标闯关：限步达标，争取三星',
    '方块不能旋转',
    '消除、集星星，解锁庭院花木'
  ];
  let yy=y+66;
  for(const line of lines)yy=wrapText(ctx,line,x+20,yy,width-40,13);
  const run=state.screen==='playing'?state.challenge:null;
  const mode=MODES[state.mode] || MODES.easy;
  const extra=run?'本关规则：点击棋盘上方的目标卡查看'
    :mode.help || (mode.blocked.length?`${mode.title}：${mode.description}`:'带 ✦ 九宫可充能，满三点后下一组送幸运方块');
  wrapText(ctx,extra,x+20,yy+12,width-40,11);
  button(ctx,a.practice,'基础练习',false,state,'help-practice',14);
  button(ctx,a.confirm,'知道了',true,state,'help-confirm',14);
}

function getGoalAction(layout) {
  return {x:layout.horizontalPadding,y:layout.goalY,width:layout.width-layout.horizontalPadding*2,height:44};
}

function getPlayPanelActions(layout, state) {
  const width=Math.min(330,layout.width-40),height=state.playPanel==='goal'?430:320;
  const x=(layout.width-width)/2,y=(layout.height-height)/2;
  const count=state.challenge && state.challenge.ended && undoBudget.remaining(undoBudget.current(state))
    ? Math.min(3,state.challenge.history.length) : 0;
  const steps={},gap=8,stepWidth=(width-40-gap*2)/3;
  for(let i=1;i<=count;i++)steps[i]={x:x+20+(i-1)*(stepWidth+gap),y:y+137,width:stepWidth,height:48};
  return {panel:{x,y,width,height},close:{x:x+width-54,y:y+4,width:48,height:44},steps,
    confirm:{x:x+20,y:y+height-66,width:width-40,height:48}};
}

function drawGoalExample(ctx,x,y,width,description) {
  const center=x+width/2,kind=description.example,size=34;
  text(ctx,'→',center,y+29,24,COLORS.secondaryText);
  if(kind==='flowers'){
    drawFlower(ctx,center-76,y,size,2);drawFlower(ctx,center+42,y,size,1);
  } else if(kind==='ice') {
    ctx.fillStyle='#D0F2FA';roundedRect(ctx,center-76,y,size,size,5);ctx.fill();
    text(ctx,'2',center-59,y+24,18,COLORS.text,'center','600');
    ctx.fillStyle=COLORS.block;roundedRect(ctx,center+42,y,size,size,5);ctx.fill();
  } else if(kind==='keys') {
    drawKey(ctx,center-76,y,size,'A');
    ctx.strokeStyle=COLORS.accent;ctx.lineWidth=1;ctx.setLineDash([3,2]);
    roundedRect(ctx,center+42,y,size,size,5);ctx.stroke();ctx.setLineDash([]);
    text(ctx,'开',center+59,y+24,14,COLORS.accent);
  } else if(kind==='stones') {
    drawTarget(ctx,center-76,y,size);ctx.strokeStyle=COLORS.boardEdge;ctx.lineWidth=1;
    roundedRect(ctx,center+42,y,size,size,5);ctx.stroke();
  } else {
    // Generic rule diagram, not a suggested move on the player's board.
    const grid=['rows','cols','regions','cross'].includes(kind)?9:3,cell=grid===9?7:14;
    for(let side=0;side<2;side++)for(let r=0;r<grid;r++)for(let c=0;c<grid;c++){
      const active=kind==='rows'?r===4:kind==='cols'?c===4:grid===9?r===4||(c>=3&&c<6&&r>=3&&r<6):true;
      const filled=side===0&&active,xx=center+(side?34:-94)+c*cell,yy=y+r*cell;
      ctx.fillStyle=filled?COLORS.block:COLORS.emptyCell;roundedRect(ctx,xx,yy,cell-1,cell-1,2);ctx.fill();
      if(kind==='area'){ctx.strokeStyle=COLORS.accent;ctx.lineWidth=.7;ctx.stroke();}
    }
  }
  text(ctx,description.caption,center,y+70,11,COLORS.secondaryText);
}

function drawPlayPanel(ctx,layout,state) {
  if(!state.playPanel)return;
  const actions=getPlayPanelActions(layout,state),{x,y,width,height}=actions.panel,center=layout.width/2;
  ctx.fillStyle='rgba(35,45,50,.5)';ctx.fillRect(0,0,layout.width,layout.height);
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,y,width,height,22);ctx.fill();
  text(ctx,'×',actions.close.x+24,actions.close.y+29,22,COLORS.secondaryText);
  if(state.playPanel==='goal'){
    const description=goals.describe(state);
    text(ctx,description.title,center,y+39,21,COLORS.text,'center','600');
    text(ctx,description.goal,center,y+72,16,COLORS.accent,'center','600');
    let lineY=y+101;
    for(const line of description.lines)lineY=wrapText(ctx,line,x+20,lineY,width-40);
    drawGoalExample(ctx,x,y+240,width,description);
    text(ctx,'规则示意 · 不会消耗提示或撤回机会',center,y+341,11,COLORS.secondaryText);
    button(ctx,actions.confirm,'知道了，继续摆放',true,state,'play-panel-confirm',15);
  } else {
    const supplement=undoBudget.canSupplement(state),remaining=undoBudget.remaining(undoBudget.current(state));
    text(ctx,supplement?'补充一次撤回':'回到哪一步？',center,y+41,21,COLORS.text,'center','600');
    text(ctx,supplement?'完整观看视频，获得 1 次机会':`本局剩余 ${remaining} 次撤回机会`,center,y+81,14,COLORS.accent);
    text(ctx,supplement?`本局还可补充 ${undoBudget.MAX_GRANTS-undoBudget.current(state).grants} 次`:'退 1～3 步，都只消耗 1 次机会',center,y+111,12,COLORS.secondaryText);
    for(const [steps,rect] of Object.entries(actions.steps))button(ctx,rect,`退 ${steps} 步`,Number(steps)===state.undoSteps,state,'undo-step-'+steps,14);
    if(supplement)text(ctx,'未完整观看不发放，也不占补充次数',center,y+158,12,COLORS.secondaryText);
    text(ctx,supplement?'领取后自行使用，不会自动改变棋盘':'回退不保证通关，也可以免费重新挑战',center,y+218,11,COLORS.secondaryText);
    button(ctx,actions.confirm,supplement?'看视频 · 获得 1 次':`确认退 ${state.undoSteps} 步`,true,state,'play-panel-confirm',15);
  }
}

module.exports = { 
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
 };
