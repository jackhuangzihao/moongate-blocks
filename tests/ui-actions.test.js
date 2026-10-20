const assert = require('assert');
const { COLORS, MODES, MODE_ORDER } = require('../js/config');
const { createLayout } = require('../js/views/layout');
const {
  getGameOverActions,
  getHomeActions,
  getBackButton,
  drawDynamicLayer,
  getSpecialActions,
  getCollectionActions,
  getCollectionTabs,
  getChallengeActions,
  getLevelActions,
  getLevelViewport,
  getChapterActions,
  getSettingsButton,
  getSettingsActions,
  getGoalAction,
  getHelpActions,
  getConfirmActions
} = require('../js/renderer');

const layout = createLayout(375, 812, { top: 44, bottom: 778 }, { bottom: 80 });
assert.strictEqual(getSettingsButton(layout).y, 88);
assert.ok(getSettingsButton(layout).height >= 48);
assert.ok(getSettingsActions(layout).close.width >= 48);
assert.ok(getConfirmActions(layout).confirm.height >= 48);
assert.ok(getGameOverActions(layout).restart.height >= 48);
assert.ok(getGameOverActions(layout).menu.height >= 48);
assert.ok(getHelpActions(layout).confirm.height >= 48);
assert.ok(getSettingsActions(layout).restart.height >= 48);
assert.ok(getSettingsActions(layout).menu.height >= 48);
assert.ok(MODE_ORDER.every(id => MODES[id].cardFill === MODES.easy.cardFill));

const shortLayout = createLayout(320, 568, { top: 20, bottom: 548 }, { bottom: 54 });
const tallLayout = createLayout(430, 932, { top: 47, bottom: 898 }, { bottom: 83 });
assert.ok(shortLayout.boardY > shortLayout.scoreY + 60);
assert.ok(shortLayout.boardWidth >= 210, 'Compact phones keep at least a 210px nine-column board');
const backHit=getBackButton(shortLayout);assert.ok(backHit.height>=44);
let backPaint;
const pressContext=new Proxy({}, {get:(_,key)=>key==='roundRect'?(x,y,width,height)=>{backPaint={x,y,width,height};}:()=>{}});
drawDynamicLayer(pressContext,shortLayout,{screen:'menu',pressedButton:'game-home',pressedRect:backHit});
assert.ok(backPaint.y+backPaint.height<=shortLayout.scoreY-36,'Back-button press feedback leaves the score label clear');
assert.ok(tallLayout.boardY > tallLayout.scoreY + 60);
assert.ok(tallLayout.trayY + tallLayout.trayHitHalfHeight < 898);

function luminance(hex) {
  const values = hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

assert.ok(1.05 / (luminance(COLORS.primaryButton) + 0.05) >= 4.5);
// 模式名以 13px 小字出现在顶部（页面背景上）和玩法说明（面板上），两处都要达到 AA。
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const id of MODE_ORDER) {
  assert.ok(contrast(MODES[id].titleColor, COLORS.background) >= 4.5, `${id} title on background`);
  assert.ok(contrast(MODES[id].titleColor, COLORS.panel) >= 4.5, `${id} title on panel`);
}
console.log('UI action checks passed');

for (const [width,height,top,bottom,capsule] of [[320,568,20,548,54],[375,667,20,647,54],[390,844,44,810,80],[430,932,47,898,83]]) {
 const l=createLayout(width,height,{top,bottom},{bottom:capsule});
 const home=getHomeActions(l),levels=getLevelActions(l);
 for (const r of [...Object.values(home),...Object.values(getCollectionActions(l)),...Object.values(getGameOverActions(l)),...Object.values(getSettingsActions(l))]) {
   assert.ok(r.x>=0&&r.x+r.width<=width);assert.ok(r.y>=top&&r.y+r.height<=bottom);
 }
 assert.ok(l.trayY+l.trayHitHalfHeight<=bottom);
 assert.ok(l.trayY-l.trayHitHalfHeight>l.energyY+8);
 assert.ok(home.start.y>home.garden.y+44);
}
console.log('Two-mode screens fit compact and notched phones');

for (const [width,height,top,bottom,capsule] of [[320,568,20,548,54],[375,667,20,647,54],[390,844,44,810,80],[430,932,47,898,83]]) {
 const l=createLayout(width,height,{top,bottom},{bottom:capsule},{...MODES.easy,challenge:true});
 const a=getChallengeActions(l,{videoToolsEnabled:true,challenge:{level:35}});
 for(const r of Object.values(a)){
  assert.ok(r.width>=44&&r.height>=44);
  assert.ok(r.y>l.settingsY+34,'Below the header title');
  assert.ok(r.y+r.height+4<=getGoalAction(l).y,'Tools leave a gap above the goal card');
 }
 assert.ok(a.hint && a.undo.x+a.undo.width<a.hint.x);
 assert.ok(getGoalAction(l).y+getGoalAction(l).height+4<=l.boardY,'Goal card does not cover the board');
 const gardenUndo=getChallengeActions(l,{videoToolsEnabled:false}).undo;
 assert.ok(gardenUndo.y+gardenUndo.height+4<=getGoalAction(l).y,'Garden undo also clears the compact goal card');
 assert.ok(l.trayY-l.trayHitHalfHeight>l.energyY+8);
}
console.log('Challenge controls and next-tray preview fit four phone sizes without board/tray overlap');

for(const [width,height,top,bottom,capsule] of [[320,568,20,548,54],[375,667,20,647,54],[390,844,44,810,80],[430,932,47,898,83]]){
 const l=createLayout(width,height,{top,bottom},{bottom:capsule});
 const count=require('../js/challenge/challenges').CHAPTERS.length;
 const tabs=getChapterActions(l);assert.equal(tabs.length,count);
 for(let chapter=0;chapter<count;chapter++){
  const actions=getLevelActions(l,chapter);assert.equal(Object.keys(actions).length,18);
  const view=getLevelViewport(l,chapter),last=getLevelActions(l,chapter,view.maxScroll);
  assert.equal(Number(Object.keys(actions)[0]),chapter*12);
  assert.ok(view.y>tabs[0].y+tabs[0].height && view.y+view.height<=bottom-32);
  for(const r of [...tabs,...Object.values(actions)]){
   assert.ok(r.height>=44&&r.width>=44);
   assert.ok(r.x>=0&&r.x+r.width<=width);
  }
  const final=require('../js/challenge/challenges').chapterLevels(chapter).at(-1);
  assert.ok(last[final.id].y+last[final.id].height<=view.y+view.height);
  assert.deepStrictEqual(getLevelActions(l,chapter,-100),actions);
  assert.deepStrictEqual(getLevelActions(l,chapter,Infinity),actions);
 }
}
for(const l of [shortLayout,layout,tallLayout]){
 const a=getHomeActions(l);
 assert.ok(a.choose.x+a.choose.width<a.daily.x,'daily and map buttons do not overlap');
 const b=getSpecialActions(l).start;
 assert.ok(b.height>=44 && b.y+b.height<l.height-l.safeBottom);
}
assert.ok('revive' in getGameOverActions(layout,{videoToolsEnabled:true}));
assert.ok(!('revive' in getGameOverActions(layout,{videoToolsEnabled:false})));
assert.equal(getChallengeActions(layout,{videoToolsEnabled:false}).hint,undefined);
console.log('All chapters and daily entry fit four phone sizes; video revival entry fits');

const settingsRows = ['sound','music','vibration','guide','feedback','restart','menu']
  .map(key => getSettingsActions(shortLayout)[key]);
settingsRows.forEach((row,i) => {
  assert.ok(row.height >= 48);
  if(i) assert.ok(settingsRows[i-1].y + settingsRows[i-1].height <= row.y);
});
console.log('Feedback entry and all settings rows fit without overlap');

const guide=require('../js/progression/mechanic-guide'),C=require('../js/challenge/challenges');
for(const l of [shortLayout,layout,tallLayout]){
  for(const track of ['clears','stars','memorial'])for(const r of Object.values(getCollectionActions(l,track))){
    assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.x+r.width<=l.width);
    assert.ok(r.y>=l.safeTop&&r.y+r.height<=l.height-l.safeBottom);
  }
  assert.equal(Object.keys(getCollectionTabs(l)).length,3);
  for(const level of C.LEVELS.concat(C.DAILY_LEVELS)){
    const g=guide.create(C.start(level.id),{},0);if(!g)continue;
    const {panel,skip}=guide.rects(l,g),[c,r]=g.cell;
    assert.ok(skip.width>=44&&skip.height>=44);
    assert.ok(panel.x>=0&&panel.x+panel.width<=l.width&&panel.y>=l.boardY);
    assert.ok(panel.y+panel.height<=l.boardY+l.boardHeight);
    const targetY=l.boardY+r*l.cellSize;
    assert.ok(panel.y+panel.height<=targetY||panel.y>=targetY+l.cellSize,'Guide keeps its highlighted cell visible');
  }
}

// Text remains readable on locked cards; locking dims the background, not its labels.
const {boot}=require('./helpers/game-harness');
const picker=boot();picker.run("state.screen='levels';state.homeMode='challenge'");
const locked=picker.draw().filter(label=>label.text==='未解锁');
assert.ok(locked.length>0);
assert.ok(locked.every(label=>label.alpha===1),'Locked labels stay opaque');
// Expanded chapters keep their public numbering on the home illustration as well as the button.
const homeApp=boot();homeApp.run("state.homeMode='challenge';state.challengeProgress.active=challenges.checkpoint(challenges.start(12))");
const homeLabels=homeApp.draw().map(label=>label.text);
assert.ok(homeLabels.includes('19') && homeLabels.some(label=>label.startsWith('第 19 关 ·')));
assert.ok(!homeLabels.includes('13'),'The internal level ID is not a displayed level number');
// Disabled undo remains legible and explains why without changing the game.
for(const setup of ['restartGame()','startChallenge(12)']){
 const app=boot({fangcunTutorialSeen:true});app.run(setup);
 const label=app.draw().find(item=>item.text==='撤回');
 assert.equal(label.alpha,1);assert.ok(contrast(label.color,COLORS.trayBackground)>=4.5);
 const before=JSON.stringify(app.run('state.board'));
 app.tap(app.run('getChallengeActions(layout,state).undo'));
 assert.ok(app.notices.includes('当前没有可撤回的落子'));
 assert.equal(JSON.stringify(app.run('state.board')),before);
}
// Level identity stays visible in every status; progress remains unchanged.
{
  const app=require('./helpers/game-harness').boot();
  app.run("state.screen='levels';state.challengeProgress.stars[0]=2");
  const before=JSON.stringify(app.run('state.challengeProgress'));
  const labels=app.draw().map(item=>item.text);
  for(const label of ['01','02','03','★★☆','可挑战','未解锁'])assert.ok(labels.includes(label),label);
  assert.equal(JSON.stringify(app.run('state.challengeProgress')),before);
}
// Collection action labels and compact help remain readable on small screens.
for(const size of [{w:320,h:568},{w:390,h:844}]){
  const app=require('./helpers/game-harness').boot({}, {size});
  app.run("state.screen='collection';state.collection.target='bamboo'");
  let labels=app.draw();
  assert.ok(labels.some(x=>x.text==='当前目标'));
  assert.ok(labels.some(x=>x.text==='设为目标'));
  app.run("startChallenge(12);state.helpOpen=true");labels=app.draw();
  assert.ok(labels.some(x=>x.text==='方块不能旋转'));
  assert.ok(!labels.some(x=>x.text.includes('建议入口')));
  const actions=app.run('getHelpActions(layout)');
  const last=labels.find(x=>x.text.includes('本关规则'));
  assert.ok(last.y<actions.practice.y-10);
}
