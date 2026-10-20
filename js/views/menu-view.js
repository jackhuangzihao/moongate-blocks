const { COLORS, MODES, MODE_ORDER } = require('../config');
const challenges = require('../challenge/challenges');
const art = require('./art');
const collection = require('../progression/collection');
const daily = require('../daily/daily');
const basics = require('../progression/basics');
const sharing = require('../platform/sharing');
const { roundedRect, text, pressedRect, button, drawSettingsIcon, wrapText } = require('./canvas-ui');
const { drawFlower, drawKey, drawGate } = require('./board-symbols');
const themes = require('./themes');

const { focusForState: collectionFocus, growthForState: gardenGrowth } = collection;
const MENU_CARD_GAP = 12;
const GRAVITY_CARD = {
  id: 'gravity', buttonId: 'gravity-entry', title: '落玉庭',
  description: '消除后下落，落稳再连锁', footer: '挑战高分与连续消除', badge: '重力连锁',
  cardFill: '#F7F5E8', cardStroke: '#B6A16C', titleColor: '#355849', accent: '#A18348'
};

function getHomeActions(layout) {
  const width=Math.min(330,layout.width-48),x=(layout.width-width)/2,bottom=layout.height-layout.safeBottom-20;
  return {
    garden:{x,y:layout.settingsY,width:(width-8)/2,height:44},
    challenge:{x:x+(width+8)/2,y:layout.settingsY,width:(width-8)/2,height:44},
    start:{x,y:bottom-164,width,height:50},choose:{x,y:bottom-102,width:(width-10)/2,height:46},
    daily:{x:x+(width+10)/2,y:bottom-102,width:(width-10)/2,height:46},
    target:{x,y:bottom-248,width,height:69},
    ranking:{x,y:bottom-48,width:width-64,height:44},settings:{x:x+width-48,y:bottom-48,width:48,height:44},
    // 庭院首页的插画连同下面那行字，一起作为"我的庭院"入口。
    collection:{x,y:layout.settingsY+(layout.height<700?108:126),width,height:Math.max(0,bottom-252-layout.settingsY-(layout.height<700?108:126))}
  };
}

function getBackButton(layout) { return {x:12,y:layout.settingsY,width:64,height:48}; }

function getSpecialActions(layout) {
  const width=Math.min(330,layout.width-48);
  const y=Math.min(layout.height-layout.safeBottom-92,layout.settingsY+560);
  return {start:{x:(layout.width-width)/2,y,width,height:50}};
}

function drawSpecial(ctx,layout,state) {
  const isDaily=state.screen==='daily',date=state.today||daily.dateKey();
  const id=isDaily?daily.entryLevel(state.dailyProgress,date):state.invitation&&state.invitation.level;
  const level=challenges.level(id);
  if(!level)return;
  const center=layout.width/2,top=layout.settingsY,action=getSpecialActions(layout).start;
  const width=action.width,x=action.x,records=state.dailyProgress?state.dailyProgress.records:[];
  const record=isDaily&&records.find(item=>item.date===date && item.level===id && item.rule===level.rule);
  const saved=isDaily&&state.dailyProgress.active&&state.dailyProgress.active.date===date;
  button(ctx,{...getBackButton(layout),height:32},'‹ 返回',false,state,'special-back',13);
  text(ctx,isDaily?'每日精选':state.invitation.help?'朋友请你看看':'好友邀你挑战',center,top+31,20,COLORS.text,'center','600');
  text(ctx,isDaily?`${date} · 同日同题`:state.invitation.dailyDate?`${state.invitation.dailyDate} · 独立试玩`:`第 ${challenges.level(id).number} 关 · 独立试玩`,center,top+57,12,COLORS.secondaryText);
  const size=Math.max(78,Math.min(layout.height<700?150:210,action.y-top-252)),boardX=center-size/2;
  const boardY=top+74+Math.max(0,Math.min(48,(action.y-top-size-252)/2)),cell=size/9;
  const preview=challenges.start(id);
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,boardX-5,boardY-5,size+10,size+10,10);ctx.fill();
  preview.board.forEach((row,r)=>row.forEach((v,c)=>{
    ctx.fillStyle=v===2?COLORS.stone:v===1?COLORS.block:COLORS.emptyCell;
    roundedRect(ctx,boardX+c*cell+1,boardY+r*cell+1,cell-2,cell-2,v===2?cell/2:2);ctx.fill();
    if(preview.ice.some(p=>p[0]===c&&p[1]===r)){ctx.strokeStyle='#326D91';ctx.lineWidth=1;ctx.stroke();}
  }));
  (preview.flowers || []).forEach(([c,r,left])=>drawFlower(ctx,boardX+c*cell+1,boardY+r*cell+1,cell-2,left));
  for(const gate of preview.gates || [])for(const [c,r] of gate.cells)drawGate(ctx,boardX+c*cell+1,boardY+r*cell+1,cell-2,gate.id);
  for(const [c,r,id] of preview.keys || [])drawKey(ctx,boardX+c*cell+1,boardY+r*cell+1,cell-2,id,preview.ice.some(p=>p[0]===c&&p[1]===r));
  if(level.area){
    ctx.save();ctx.strokeStyle=COLORS.accent;ctx.lineWidth=1;ctx.setLineDash([2,2]);
    level.area.forEach(([c,r])=>{roundedRect(ctx,boardX+c*cell+1,boardY+r*cell+1,cell-2,cell-2,2);ctx.stroke();});ctx.restore();
  }
  preview.stones.forEach(([c,r])=>{
    ctx.strokeStyle=COLORS.text;ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(boardX+(c+.35)*cell,boardY+(r+.25)*cell);ctx.lineTo(boardX+(c+.65)*cell,boardY+(r+.5)*cell);ctx.lineTo(boardX+(c+.35)*cell,boardY+(r+.75)*cell);ctx.stroke();
  });
  const y=boardY+size+16;
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x,y,width,88,14);ctx.fill();
  text(ctx,level.title,x+14,y+24,18,COLORS.text,'left','600');
  text(ctx,`${level.difficulty?level.difficulty+' · ':''}${level.limit} 步以内`,x+width-14,y+23,12,COLORS.secondaryText,'right');
  text(ctx,challenges.goal(level),x+14,y+47,14,COLORS.text,'left','600');
  const benchmark=state.invitation && (!isDaily || state.invitation.dailyDate===date)?sharing.benchmarkText(state.invitation):null;
  text(ctx,benchmark || (record?`已完成 · 最佳 ${record.bestSteps} 步`:isDaily&&level.theme?`${level.theme} · 三星 ${level.par} 步内 · 可重试`:isDaily?'完成留下今日印记 · 可以重试争取更少步数':state.invitation && state.invitation.help?'从初始棋盘尝试，保留自己的闯关进度':'固定发牌 · 可撤回 1 次 · 独立试玩'),x+14,y+70,11,COLORS.secondaryText,'left');
  if(isDaily){
    const gap=width/7;
    for(let i=0;i<7;i++){
      const day=daily.dateKey(Date.parse(date+'T00:00:00Z')-(6-i)*86400000);
      const got=daily.completedOn(state.dailyProgress,day),cx=x+gap*(i+.5),cy=action.y-39;
      ctx.fillStyle=got?COLORS.primaryButton:COLORS.emptyCell;ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.fill();
      text(ctx,got?'✓':day.slice(-2),cx,cy+4,10,got?'#FFFFFF':COLORS.secondaryText);
      if(i===6)text(ctx,'今天',cx,cy+25,10,COLORS.secondaryText);
    }
  } else text(ctx,'这次试玩不解锁章节，也不会覆盖正在玩的关卡',center,action.y-23,11,COLORS.secondaryText);
  button(ctx,action,isDaily?(saved?'继续今日精选':record?'再试一次，挑战更少步数':'挑战今日精选'):'开始／继续好友挑战',true,state,'special-start');
  text(ctx,isDaily?`累计完成 ${daily.completedCount(state.dailyProgress)} 天 · 漏一天不清零`:'从同一分享重新进入，可以继续未完成的试玩',center,action.y+73,11,COLORS.secondaryText);
}

function getChapterActions(layout) {
  const width=Math.min(330,layout.width-48),x=(layout.width-width)/2,cell=(width-8*(challenges.CHAPTERS.length-1))/challenges.CHAPTERS.length;
  return challenges.CHAPTERS.map((_,i)=>({x:x+i*(cell+8),y:layout.settingsY+52,width:cell,height:44}));
}

function getLevelViewport(layout, chapter=0) {
  const width=Math.min(330,layout.width-48),y=layout.settingsY+144;
  const height=Math.max(44,layout.height-layout.safeBottom-48-y),rowHeight=104;
  const contentHeight=Math.ceil(challenges.chapterLevels(chapter).length/3)*rowHeight-10;
  return {x:(layout.width-width)/2,y,width,height,rowHeight,maxScroll:Math.max(0,contentHeight-height)};
}

function levelScrollFor(layout, level) {
  const view=getLevelViewport(layout,level.chapter);
  return Math.min(view.maxScroll,Math.max(0,Math.floor(level.order/3)*view.rowHeight-view.height/2+view.rowHeight/2));
}

function getLevelActions(layout, chapter=0, scroll=0) {
  const view=getLevelViewport(layout,chapter),cell=(view.width-20)/3;
  const offset=Math.max(0,Math.min(view.maxScroll,Number.isFinite(scroll)?scroll:0));
  const actions={};challenges.chapterLevels(chapter).forEach((level,i)=>{
    actions[level.id]={x:view.x+(i%3)*(cell+10),y:view.y+Math.floor(i/3)*view.rowHeight-offset,width:cell,height:view.rowHeight-10};
  });return actions;
}

function getMenuActions(layout) {
  const width = Math.min(310, layout.width - 48);
  const x = (layout.width - width) / 2;
  const top = Math.max(140, layout.height * 0.22, layout.settingsY + 56);
  const cardCount = MODE_ORDER.length + 1; // The experiment gets one full card, without entering garden rankings.
  const cardHeight = Math.min(96, (layout.height - (layout.safeBottom || 0) - 20
    - top - MENU_CARD_GAP * (cardCount - 1)) / cardCount);
  const actions = {};
  MODE_ORDER.forEach((id, index) => {
    actions[id] = { x, y: top + (cardHeight + MENU_CARD_GAP) * index,
      width, height: cardHeight };
  });
  return actions;
}

function getGravityEntry(layout) {
  const last = getMenuActions(layout)[MODE_ORDER[MODE_ORDER.length - 1]];
  return { ...last, y: last.y + last.height + MENU_CARD_GAP };
}

function drawModeCard(ctx, rect, mode, best, state) {
  mode = themes.modeCard(mode, state);
  const buttonId = mode.buttonId || `pick-${mode.id}`;
  const pressed = state.pressedButton === buttonId;
  rect = pressedRect(state, buttonId, rect);
  const compact = rect.height < 85;
  ctx.fillStyle = mode.cardFill;
  roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 18);
  ctx.fill();
  ctx.strokeStyle = mode.cardStroke;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 18);
  ctx.stroke();
  ctx.fillStyle = mode.accent;
  roundedRect(ctx, rect.x + 8, rect.y + 15, 4, rect.height - 30, 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = mode.titleColor;
  ctx.font = compact ? '700 18px sans-serif' : '700 20px sans-serif';
  ctx.fillText(mode.title, rect.x + 22, rect.y + (compact ? 24 : 32));
  if (mode.badge) {
    const badge = { x: rect.x + rect.width - 100, y: rect.y + (compact ? 9 : 16), width: 74, height: 23 };
    ctx.fillStyle = '#EBE2BD';
    roundedRect(ctx,badge.x,badge.y,badge.width,badge.height,8);ctx.fill();
    text(ctx,mode.badge,badge.x+badge.width/2,badge.y+16,11,'#665021','center','600');
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = COLORS.secondaryText;
  ctx.font = compact ? '12px sans-serif' : '14px sans-serif';
  const saved = state.savedGames && state.savedGames[mode.id];
  ctx.fillText(saved ? `继续游戏 · ${saved.score} 分` : mode.description,
    rect.x + 22, rect.y + (compact ? 43 : 56));
  ctx.font = compact ? '11px sans-serif' : '13px sans-serif';
  if(rect.height<70){ctx.textAlign='right';ctx.fillText(`最佳 ${best}`,rect.x+rect.width-42,rect.y+24);}
  else ctx.fillText(mode.footer || `最高分  ${best}`, rect.x + 22, rect.y + (compact ? 60 : 79));
  ctx.textAlign = 'right';
  ctx.fillStyle = mode.accent;
  ctx.font = '22px sans-serif';
  ctx.fillText('›', rect.x + rect.width - 22 + (pressed ? 3 : 0), rect.y + rect.height / 2 + 7);
}

function drawHomeBoard(ctx,rect,progress=0) {
  const size=Math.min(rect.height-10,rect.width*.52),cell=size/9;
  const x=rect.x+4,y=rect.y+2;
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,x-4,y-4,size+8,size+8,8);ctx.fill();
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const filled=c>=3&&c<6&&r>=3&&r<(progress<.35?5:6)&&progress<.75;
    ctx.fillStyle=filled?COLORS.block:COLORS.emptyCell;
    roundedRect(ctx,x+c*cell+1,y+r*cell+1,cell-2,cell-2,2);ctx.fill();
  }
  ctx.strokeStyle=COLORS.palaceLine;ctx.lineWidth=1;
  for(let i=0;i<9;i++){roundedRect(ctx,x+i%3*cell*3,y+Math.floor(i/3)*cell*3,cell*3,cell*3,3);ctx.stroke();}
  ctx.strokeStyle=COLORS.accent;ctx.lineWidth=2;
  roundedRect(ctx,x+3*cell,y+3*cell,3*cell,3*cell,3);ctx.stroke();
  const tx=x+size+14,tw=rect.width-size-20;
  text(ctx,'9×9 方块消除',tx,y+size*.22,13,COLORS.text,'left','600');
  wrapText(ctx,progress>=.75?'填满九宫 → 消除':'填满行、列或 3×3 九宫',tx,y+size*.48,tw,12);
  text(ctx,'拖动方块，试一次 ›',tx,y+size*.9,11,COLORS.accent,'left');
}

function drawMenu(ctx,layout,state) {
  const a=getHomeActions(layout),challenge=state.homeMode==='challenge',center=layout.width/2;
  const first=basics.isNew(state);
  button(ctx,a.garden,'自由消除',!challenge,state,'home-garden');button(ctx,a.challenge,'目标闯关',challenge,state,'home-challenge');
  const compact=layout.height<700,titleY=a.garden.y+(compact?76:87);
  ctx.textAlign='center';ctx.fillStyle=COLORS.text;
  ctx.font=challenge?'700 32px sans-serif':'500 34px serif';ctx.fillText('方寸九宫',center,titleY);
  text(ctx,challenge?'限定步数完成目标，通关后再争三星':'拖动方块，填满行、列或九宫即可消除',center,titleY+(compact?23:26),13,COLORS.secondaryText);
  const featureY=a.start.y-84,artTop=titleY+(compact?32:39);
  const availableHeight=featureY-artTop-(compact?24:32),artHeight=Math.max(36,Math.min(215,availableHeight));
  const artY=artTop+Math.max(0,(availableHeight-artHeight)/2);
  const progress=state.challengeProgress,active=progress.active;
  const levelId=active?active.level:challenges.unlocked(progress),level=challenges.level(levelId);
  const artWidth=Math.min(290,artHeight*1.65);
  const focus=collectionFocus(state);
  if(challenge){
    art.path(ctx,{x:center-artWidth/2,y:artY,width:artWidth,height:artHeight},level.number);
    if(focus)text(ctx,focus.text,center,featureY-12,12,COLORS.secondaryText);
  }
  else if(first) {
    drawHomeBoard(ctx,{x:a.start.x,y:artY,width:a.start.width,height:Math.max(70,featureY-artY-20)},state.homeDemoProgress);
  }
  else {
    art.garden(ctx,{x:center-artWidth/2,y:artY,width:artWidth,height:artHeight},state.decor,null,gardenGrowth(state));
    const owned=collection.unlocked(state.collection,collection.totalStars(state.challengeProgress)),fresh=owned.filter(id=>!state.collection.seen.includes(id)),upcoming=collection.next(state.collection,0,'clears');
    const chosen=collection.target(state.collection,collection.totalStars(state.challengeProgress));
    const growing=gardenGrowth(state);
    text(ctx,fresh.length?`庭院新添：${fresh.slice(0,2).map(collection.named).join('、')}${fresh.length>2?` 等 ${fresh.length} 件`:''} ›`
      :growing && growing.have>0 && !growing.complete?`${growing.item.name} · ${growing.label} · ${growing.progress} ›`:chosen?`我的庭院 · 已添 ${owned.length} / ${collection.ITEMS.length} 件 ›`:focus?focus.text+' ›':owned.length?`我的庭院 · 已添 ${owned.length} / ${collection.ITEMS.length} 件 ›`
      :`我的庭院 · 再消除 ${upcoming.missing} 次可添「${upcoming.item.name}」 ›`,
      center,Math.min(featureY-10,artY+artHeight/2+95*Math.min(artWidth/300,artHeight/190)+17),12,fresh.length?COLORS.accent:COLORS.secondaryText,'center',fresh.length?'600':'400');
  }
  ctx.fillStyle=COLORS.panel;roundedRect(ctx,a.start.x,featureY,a.start.width,69,16);ctx.fill();
  if(state.pressedButton==='home-target'){ctx.strokeStyle=COLORS.accent;ctx.lineWidth=2;ctx.stroke();}
  const saved=state.savedGames[state.freeMode],allDone=progress.stars.every(n=>n>0);
  const chapter=progress.chapter||0,chapterDone=challenges.chapterLevels(chapter).every(level=>progress.stars[level.id]);
  const target=!challenge&&collection.target(state.collection,collection.totalStars(progress));
  if(first && !challenge){
    text(ctx,'自由消除 · 清雅庭院',a.start.x+16,featureY+22,16,COLORS.text,'left','600');
    text(ctx,'没有通关分数 · 方块全放不下时结束',a.start.x+16,featureY+42,11,COLORS.secondaryText,'left');
    text(ctx,'消除积累进度，解锁庭院花木',a.start.x+16,featureY+59,11,COLORS.secondaryText,'left');
  } else if(target){
    text(ctx,`${target.complete?'已添':'想添'}：${target.item.name}  ›`,a.start.x+16,featureY+25,16,COLORS.text,'left','600');
    text(ctx,target.complete?'目标达成，点击查看庭院':focus.progress+' · 点击前往',a.start.x+16,featureY+48,12,COLORS.secondaryText,'left');
  } else {
  text(ctx,challenge?`第 ${level.number} 关 · ${level.title}`:`${MODES[state.freeMode].title} · 自由消除`,a.start.x+16,featureY+25,16,COLORS.text,'left','600');
  text(ctx,challenge?(allDone?'诸景已通关，试着收集全部三星':`${level.pace || '挑战'} · ${challenges.goal(level)} · ${level.limit} 步`):
    saved?`已保存 ${saved.score} 分 · 随时继续`:'不限时挑战高分 · 全都放不下时结束',a.start.x+16,featureY+48,12,COLORS.secondaryText,'left');
  }
  button(ctx,a.start,challenge?(active?'继续这一关':allDone?'重游全部关卡':chapterDone?'本章完成 · 选择章节':`挑战第 ${level.number} 关`):(saved?'继续这一局':'开始消除'),true,state,'home-start');
  button(ctx,a.choose,challenge?'自由选章 ›':'选择棋盘 ›',false,state,'home-choose');
  const done=state.dailyProgress && state.dailyProgress.records.some(item=>item.date===state.today);
  button(ctx,a.daily,done?'今日已完成 ✓':'每日精选 ›',false,state,'home-daily');
  text(ctx,challenge?`已收集 ${progress.stars.reduce((a,b)=>a+b,0)} / ${challenges.LEVELS.length*3} 颗星`:'查看庭院好友排行 ›',a.ranking.x+a.ranking.width/2,a.ranking.y+28,12,COLORS.secondaryText);
  drawSettingsIcon(ctx,pressedRect(state,'home-settings',a.settings),COLORS.secondaryText);
}

function drawPicker(ctx,layout,state) {
  button(ctx,{...getBackButton(layout),height:32},'‹ 返回',false,state,'picker-back',13);
  text(ctx,state.screen==='maps'?'选择棋盘':'闯关地图',layout.width/2,layout.settingsY+31,20,COLORS.text,'center','600');
  if(state.screen==='maps'){
    const actions=getMenuActions(layout);
    MODE_ORDER.forEach(id=>drawModeCard(ctx,actions[id],MODES[id],state.bestScores[id]||0,state));
    drawModeCard(ctx,getGravityEntry(layout),GRAVITY_CARD,0,state);
  } else {
    const chapter=state.levelChapter||0;
    const tabs=getChapterActions(layout);
    tabs.forEach((r,i)=>button(ctx,r,`第${['一','二','三','四','五'][i] || i+1}章`,chapter===i,state,`chapter-${i}`,r.width<60?13:16));
    text(ctx,challenges.CHAPTERS[chapter].title+' · 首关开放，章内逐关解锁',layout.width/2,layout.settingsY+123,11,COLORS.secondaryText);
    const view=getLevelViewport(layout,chapter),offset=Math.max(0,Math.min(view.maxScroll,state.levelScroll||0));
    const actions=getLevelActions(layout,chapter,offset);
    ctx.save();ctx.beginPath();ctx.rect(view.x,view.y,view.width,view.height);ctx.clip();
    const next=challenges.unlocked(state.challengeProgress,chapter);
    challenges.chapterLevels(chapter).forEach(level=>{
      if(actions[level.id].y+actions[level.id].height<=view.y || actions[level.id].y>=view.y+view.height)return;
      const i=level.id,r=pressedRect(state,`pick-${i}`,actions[i]),locked=!challenges.isUnlocked(state.challengeProgress,i),earned=state.challengeProgress.stars[i];
      ctx.globalAlpha=locked?.48:1;ctx.fillStyle=COLORS.panel;roundedRect(ctx,r.x,r.y,r.width,r.height,15);ctx.fill();
      ctx.globalAlpha=1;
      if(i===next && !earned){
        ctx.strokeStyle=COLORS.accent;ctx.lineWidth=1.5;
        roundedRect(ctx,r.x+1,r.y+1,r.width-2,r.height-2,14);ctx.stroke();
      }
      text(ctx,String(level.number).padStart(2,'0'),r.x+r.width/2,r.y+(r.height<75?20:24),20,COLORS.text,'center','600');
      text(ctx,level.title,r.x+r.width/2,r.y+(r.height<75?39:43),12,COLORS.secondaryText);
      if(r.height>61)text(ctx,earned?'★'.repeat(earned)+'☆'.repeat(3-earned):locked?'未解锁':'可挑战',r.x+r.width/2,r.y+(r.height<75?56:62),11,COLORS.energyText);
      ctx.globalAlpha=1;
    });
    ctx.restore();
    if(view.maxScroll>0){
      const thumb=view.height*view.height/(view.height+view.maxScroll);
      ctx.fillStyle=COLORS.secondaryText;
      ctx.globalAlpha=.35;roundedRect(ctx,view.x+view.width+7,view.y+(view.height-thumb)*offset/view.maxScroll,3,thumb,1.5);ctx.fill();ctx.globalAlpha=1;
      text(ctx,'上下滑动查看关卡',layout.width/2,layout.height-layout.safeBottom-32,10,COLORS.secondaryText);
    }
    const total=state.challengeProgress.stars.reduce((a,b)=>a+b,0);
    text(ctx,`本章 ${challenges.chapterLevels(chapter).reduce((sum,level)=>sum+state.challengeProgress.stars[level.id],0)} / ${challenges.chapterLevels(chapter).length*3} 星 · 全部 ${total} / ${challenges.LEVELS.length*3}`,layout.width/2,layout.height-layout.safeBottom-18,12,COLORS.secondaryText);
  }
}

function collectionLayout(layout) {
  const width=Math.min(330,layout.width-48),x=(layout.width-width)/2;
  const compact=layout.height<700,bottom=layout.height-layout.safeBottom-24,cardHeight=compact?62:66,gap=compact?8:10;
  const artTop=layout.settingsY+64;
  const artHeight=Math.max(30,Math.min(205,bottom-artTop-(compact?300:322))),artWidth=Math.min(width,artHeight*300/190);
  const tabsY=artTop+artHeight+12,cardsY=tabsY+(compact?66:72);
  return {width,x,bottom,cardHeight,gap,artTop,artHeight,artWidth,tabsY,cardsY};
}

function getCollectionTabs(layout) {
  const {width,x,tabsY}=collectionLayout(layout),w=(width-16)/3;
  return Object.fromEntries(collection.TRACKS.map((track,i)=>[track.id,{x:x+i*(w+8),y:tabsY,width:w,height:44}]));
}

function getCollectionActions(layout, track='clears') {
  const {width,x,gap,cardHeight,cardsY}=collectionLayout(layout),actions={};
  collection.ITEMS.filter(item=>item.track===track).forEach((item,i)=>{
    const w=(width-gap)/2;
    actions[item.id]={x:x+(i%2)*(w+gap),y:cardsY+Math.floor(i/2)*(cardHeight+gap),width:w,height:cardHeight};
  });
  return actions;
}

function drawCollection(ctx,layout,state) {
  const {width,x,bottom,artTop,artHeight,artWidth,cardsY}=collectionLayout(layout),center=layout.width/2;
  const track=collection.TRACKS.find(item=>item.id===state.collectionTab)||collection.TRACKS[0];
  const actions=getCollectionActions(layout,track.id),tabs=getCollectionTabs(layout);
  const stars=collection.totalStars(state.challengeProgress);
  const growing=gardenGrowth(state);
  button(ctx,{...getBackButton(layout),height:32},'‹ 返回',false,state,'picker-back',13);
  text(ctx,'我的庭院',center,layout.settingsY+31,20,COLORS.text,'center','600');
  text(ctx,`已添 ${collection.unlocked(state.collection,stars).length} / ${collection.ITEMS.length} 件 · 未解锁可选为目标`,center,layout.settingsY+53,12,COLORS.secondaryText);
  art.garden(ctx,{x:center-artWidth/2,y:artTop,width:artWidth,height:artHeight},state.decor,state.collectionReveal,gardenGrowth(state));
  collection.TRACKS.forEach(t=>button(ctx,tabs[t.id],t.title,t.id===track.id,state,'collection-tab-'+t.id));
  text(ctx,track.id==='memorial'?`每日累计 ${state.collection.dailyCompletions||0} 天 · 漏一天不清零`:track.source+' · '+(track.id==='clears'?state.collection.clears:stars)+' '+track.unit,x,cardsY-9,12,COLORS.secondaryText,'left');
  for(const item of collection.ITEMS.filter(item=>item.track===track.id)){
    const rect=pressedRect(state,'decor-'+item.id,actions[item.id]);
    const have=collection.amount(item,state.collection,stars),got=have>=item.need;
    ctx.fillStyle=COLORS.panel;roundedRect(ctx,rect.x,rect.y,rect.width,rect.height,12);ctx.fill();
    if(!got && state.collection.target===item.id){ctx.strokeStyle=COLORS.accent;ctx.lineWidth=2;ctx.stroke();}
    if(!got)text(ctx,state.collection.target===item.id?'当前目标':'设为目标',rect.x+rect.width-10,rect.y+22,10,COLORS.accent,'right');
    text(ctx,item.name,rect.x+10,rect.y+22,14,got?COLORS.text:COLORS.secondaryText,'left','600');
    text(ctx,got?(state.decor.includes(item.id)?'已摆放 · 点击收起':'已收起 · 点击摆放'):collection.requirement(item,state.collection,stars),rect.x+10,rect.y+44,10,got?COLORS.accent:COLORS.secondaryText,'left');
    if(!got){
      ctx.fillStyle=COLORS.emptyCell;roundedRect(ctx,rect.x+10,rect.y+rect.height-9,rect.width-20,3,1.5);ctx.fill();
      ctx.fillStyle=COLORS.primaryButton;roundedRect(ctx,rect.x+10,rect.y+rect.height-9,Math.max(3,(rect.width-20)*have/item.need),3,1.5);ctx.fill();
    }
  }
  text(ctx,growing && !growing.complete?`${growing.item.name} · ${growing.label} · 达标后完整呈现`:track.id==='memorial'?'纪念品只作装饰，不改变关卡难度':'收起不扣进度 · 点击其他分类查看奖励',center,bottom,11,COLORS.secondaryText);
}

function getRankingButton(layout) { return getHomeActions(layout).ranking; }

module.exports = { 
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
 };
