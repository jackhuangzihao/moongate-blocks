const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const {createRequire}=require('module');
const C=require('../js/challenge/challenges'),K=require('../js/progression/collection'),{SHAPES}=require('../js/rules/shapes');
const clone=x=>JSON.parse(JSON.stringify(x));
const game=path.resolve(__dirname,'../game.js'),req=createRequire(game);
function boot(store={},size={w:320,h:568}) {
 const handlers={},notices=[],texts=[],events=[],sandboxRef={shareHandlers:{},failCard:false};
 const ctx=new Proxy({},{get:(o,k)=>k==='fillText'?(s,x,y)=>texts.push({s:String(s),x,y}):o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const wx={getWindowInfo:()=>({windowWidth:size.w,windowHeight:size.h}),createCanvas:()=>({getContext:()=>ctx,toTempFilePathSync:()=>{if(sandboxRef.failCard)throw Error('export');return '/tmp/card.png';}}),
 getStorageSync:k=>store[k]===undefined?undefined:clone(store[k]),setStorageSync:(k,v)=>store[k]=clone(v),
 showToast:o=>notices.push(o.title),reportEvent:(id,data)=>events.push([id,data]),
 showShareMenu:o=>{sandboxRef.shareMenu=o;},onShareAppMessage:f=>{sandboxRef.shareHandlers.app=f;},onShareTimeline:f=>{sandboxRef.shareHandlers.timeline=f;}};
 for(const n of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show'])wx['on'+n]=f=>handlers[n]=f;
 const sandbox=vm.createContext({wx,get shareMenu(){return sandboxRef.shareMenu},shareHandlers:sandboxRef.shareHandlers,
 get failCard(){return sandboxRef.failCard},set failCard(v){sandboxRef.failCard=v},requestAnimationFrame(){},require:n=>n==='./js/platform/feedback'?{settings:{},playMusic(){},placement(){},elimination(){},resume(){},suspend(){},undoMove(){},iceBreak(){},result(){}}:req(n)});
 vm.runInContext(fs.readFileSync(game,'utf8'),sandbox);const run=s=>vm.runInContext(s,sandbox);
 const settle=()=>run('stepAnimations(Date.now()+1000);stepAnimations(Date.now()+2000)');
 function tap(rect){const p={clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,identifier:2};handlers.TouchStart({touches:[p],changedTouches:[p]});handlers.TouchEnd({touches:[],changedTouches:[p]});settle();}
 function drop(slot,c,r){
  const from=run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:1})`);
  const to=run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:1}})()`);
  handlers.TouchStart({touches:[from],changedTouches:[from]});handlers.TouchEnd({touches:[],changedTouches:[to]});settle();
 }
 const draw=()=>{texts.length=0;run('invalidateScene();present()');return texts.slice();};
 return {run,tap,drop,draw,notices,store,events,handlers};
}

// Damaged storage never unlocks anything or crashes.
for(const bad of [null,'x',{version:2,clears:999},{version:1,clears:-3,seen:'all'},{version:1,clears:1.5,seen:['ghost']}])
 assert.deepStrictEqual(K.normalize(bad),{version:1,clears:0,seen:[],hidden:[]});
assert.deepStrictEqual(K.unlocked({clears:20,seen:[]},12),['bamboo','plum','lamp']);
assert.deepStrictEqual(K.unlocked({clears:10000,seen:[]},108),K.ITEMS.filter(i=>i.track!=='memorial').map(i=>i.id),'old eight rewards retain their original thresholds');
const memorial=K.normalize({version:1,clears:10000,seen:['moon'],hidden:['plum']});
assert.equal(K.syncProgress(memorial,{chapterFourComplete:false,allStars:false,dailyCompletions:0}),false);
assert.equal(K.syncProgress(memorial,{dailyCompletions:6}),true);
assert.ok(!K.unlocked(memorial,108).includes('chime'));
assert.equal(K.requirement(K.ITEMS.find(i=>i.id==='chime'),memorial,108),'每日精选再完成 1 天');
assert.equal(K.syncProgress(memorial,{dailyCompletions:7}),true);
assert.ok(K.unlocked(memorial,108).includes('chime'));
assert.equal(K.syncProgress(memorial,{dailyCompletions:0}),false,'missing a day does not reset cumulative rewards');
assert.equal(K.syncProgress(memorial,{chapterFourComplete:'true',allStars:1,dailyCompletions:NaN}),false);
assert.equal(K.syncProgress(memorial,{chapterFourComplete:true}),true);
assert.ok(K.unlocked(memorial,108).includes('arbour'));assert.ok(!K.unlocked(memorial,108).includes('plaque'));
assert.equal(K.requirement(K.ITEMS.find(i=>i.id==='plaque'),memorial,108),'前四章基础三星 0/48 关');
assert.equal(K.syncProgress(memorial,{allStars:true,dailyCompletions:21}),true);
assert.equal(K.syncProgress(memorial,{allStars:false,chapterFourComplete:false,dailyCompletions:7}),false,'earned achievements are never revoked');
const reloadedMemorial=K.normalize(clone(memorial));
assert.deepStrictEqual(K.unlocked(reloadedMemorial,108),K.ITEMS.filter(i=>i.id!=='keyCharm').map(i=>i.id));
assert.ok(!K.displayed(reloadedMemorial,108).includes('plum'),'old visibility preference survives migration');
assert.deepStrictEqual(reloadedMemorial.seen,['moon']);
assert.deepStrictEqual(K.normalize({version:1,achievements:['arbour','unknown','arbour'],dailyCompletions:-1}),{version:1,clears:0,seen:[],hidden:[],achievements:['arbour']});
const art=require('../js/views/art');
function painted(decor){let count=0;const c=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>{assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)));count++;},set:(o,k,v)=>(o[k]=v,true)});art.garden(c,{x:0,y:0,width:300,height:190},decor);return count;}
const basePaint=painted([]);
for(const id of ['arbour','plaque','chime','bridge'])assert.ok(painted([id])>basePaint,id+' is painted in the actual courtyard illustration');
const Daily=require('../js/daily/daily');
const completeGarden=boot({[C.KEY]:{version:1,stars:Array(48).fill(3),chapter:3},
 [Daily.KEY]:{version:1,marks:{'2026-08':2**7-1,'2026-09':2**14-1}}});
for(const id of ['arbour','plaque','chime','bridge'])assert.ok(completeGarden.run('state.ownedDecor').includes(id),id+' unlocks from loaded game progress');
assert.equal(completeGarden.run('state.collection.dailyCompletions'),21,'nonconsecutive completed days count together');
assert.equal(completeGarden.notices.length,0,'loading earned rewards does not interrupt startup with toasts');
assert.ok(completeGarden.store[K.KEY].achievements.includes('plaque'),'new chapter milestones persist during startup');
completeGarden.run('openCollection()');assert.equal(completeGarden.run('state.collectionTab'),'stars','first unseen reward picks its category');
completeGarden.tap(completeGarden.run('getCollectionTabs(layout).memorial'));
completeGarden.tap(completeGarden.run("getCollectionActions(layout,'memorial').bridge"));
assert.ok(!completeGarden.run('state.decor').includes('bridge'));assert.ok(completeGarden.run('state.ownedDecor').includes('bridge'));
assert.ok(!boot(completeGarden.store).run('state.decor').includes('bridge'),'new rewards honor saved visibility choices');

// Garden clears accumulate, survive a relaunch, and an undone clear is taken back.
const single=SHAPES.find(s=>s.cells.length===1);assert.ok(single,'a one-cell shape exists');
const app=boot({fangcunTutorialSeen:true});app.run('state.mode="easy";continueOrStartGame()');
const setup=`for(let c=1;c<9;c++)state.board[0][c]=1;state.tray=[{...require('./js/rules/shapes').SHAPES.find(s=>s.cells.length===1),lucky:false},state.tray[1],state.tray[2]];updateTrayAvailability()`;
app.run(setup);
app.drop(0,0,0);
assert.equal(app.run('state.collection.clears'),1);assert.equal(app.store[K.KEY].clears,1);
app.run('undoMove()');assert.equal(app.run('state.collection.clears'),0,'undo takes the clear back');
app.run(setup);app.drop(0,0,0);assert.equal(app.run('state.collection.clears'),1);
assert.equal(boot(app.store).run('state.collection.clears'),1);

// Crossing a threshold announces the new piece once.
const near=boot({fangcunTutorialSeen:true,[K.KEY]:{version:1,clears:0,seen:[]}});near.run('state.mode="easy";continueOrStartGame()');
near.run(setup);near.drop(0,0,0);
// In play the news goes into the goal card instead of a toast over the board.
assert.equal(near.run('state.feedback'),'庭院新添「修竹」· 回首页看看');assert.ok(!near.notices.some(t=>t.includes('修竹')));
assert.deepStrictEqual(near.run('state.decor'),['bamboo']);
// The garden result page keeps saying what is new, then what comes next.
near.run('state.gameOver=true;state.gameOverProgress=1');assert.ok(near.draw().some(t=>t.s==='庭院新添「修竹」· 回首页看看'));
near.run('state.collection.seen=["bamboo"]');assert.ok(near.draw().some(t=>t.s==='想添「梅花」· 1/20 次消除'));

// Challenge stars unlock furnishings when the level is won.
const stars=Array(36).fill(0);stars[0]=3;stars[1]=3;stars[2]=3;stars[3]=2;
const hero=boot({[C.KEY]:{version:1,stars,chapter:0}});
assert.ok(hero.draw().some(t=>t.s==='想添「修竹」· 0/1 次消除 ›'),'empty garden says how to start');
assert.deepStrictEqual(hero.run('state.decor'),[],'11 stars are not enough');
hero.run('startChallenge(3)');
for(const [slot,c,r] of C.LEVELS[3].solution)hero.run(`playChallenge({trayIndex:${slot},target:{col:${c},row:${r}}});stepAnimations(Date.now()+5000)`);
assert.ok(hero.run('state.challenge.won'));assert.ok(hero.notices.includes('庭院新添：石灯'));
assert.deepStrictEqual(hero.run('state.decor'),['lamp']);
hero.run('state.gameOverProgress=1');assert.ok(hero.draw().some(t=>t.s==='想添「红灯笼」· 12/36 颗星'));
assert.deepStrictEqual(clone(hero.events.find(([event])=>event==='level_result')),['level_result',{level_id:4,result:'win',steps:C.LEVELS[3].solution.length,stars:3,fails:0}]);

// Home shows what is new; the art opens "我的庭院", which marks it seen and fits a small screen.
hero.run('returnHome();state.homeMode="garden"');
assert.ok(hero.draw().some(t=>t.s==='庭院新添：石灯 ›'));
hero.tap(hero.run('getHomeActions(layout).collection'));
assert.equal(hero.run('state.screen'),'collection');assert.deepStrictEqual(hero.store[K.KEY].seen,['lamp']);
const bottom=hero.run('layout.height-layout.safeBottom');
for(const track of K.TRACKS){
 hero.tap(hero.run(`getCollectionTabs(layout).${track.id}`));const page=hero.draw();
 for(const name of K.ITEMS.filter(i=>i.track===track.id).map(i=>i.name))assert.ok(page.some(t=>t.s===name),name+' listed');
 if(track.id==='clears')assert.ok(page.some(t=>t.s.includes('还差 1 次')));
 if(track.id==='stars'){assert.ok(page.some(t=>t.s.startsWith('已摆放')));assert.ok(page.some(t=>t.s==='还差 24 颗星'));}
 if(track.id==='memorial'){assert.ok(page.some(t=>t.s==='第四章基础 0/12 关'));assert.ok(page.some(t=>t.s===`前四章基础三星 ${hero.run('state.challengeProgress.stars.slice(0,48).filter(n=>n===3).length')}/48 关`));}
 assert.ok(page.every(t=>t.y<=bottom),'collection '+track.id+' fits 320×568');
}
hero.tap(hero.run('getBackButton(layout)'));assert.equal(hero.run('state.screen'),'menu');
assert.ok(hero.draw().some(t=>t.s==='想添「修竹」· 0/1 次消除 ›'));
// Challenge home has no garden entry.
hero.run('state.homeMode="challenge"');hero.tap(hero.run('getHomeActions(layout).collection'));assert.equal(hero.run('state.screen'),'menu');

// Help mentions the collection in both modes.
hero.run('state.homeMode="garden";state.helpOpen=true');assert.ok(hero.draw().map(t=>t.s).join('').includes('解锁庭院'));hero.run('state.helpOpen=false');

// The top-right menu can forward and post to Moments; content follows the current screen.
const menu=boot({[K.KEY]:{version:1,clears:25,seen:[]}});const shareOf=menu.run('shareHandlers');
assert.deepStrictEqual(clone(menu.run('shareMenu')),{withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
const home=shareOf.app();assert.equal(home.title,'方寸九宫 · 落子成局，来庭院里摆一局？');assert.equal(home.imageUrl,'/tmp/card.png');
assert.deepStrictEqual(clone(menu.run('sharing.menuCard(state)')).decor,['bamboo','plum'],'menu card shows the player garden');
menu.run('state.bestScores.easy=321');assert.ok(shareOf.app().title.includes('321'));assert.ok(shareOf.timeline().title.includes('321'));
menu.run('startChallenge(0)');for(const [slot,c,r] of C.LEVELS[0].solution)menu.run(`playChallenge({trayIndex:${slot},target:{col:${c},row:${r}}});stepAnimations(Date.now()+5000)`);
assert.ok(shareOf.app().title.includes('第 1 关'),'result screen shares the result');
menu.run('failCard=true');assert.deepStrictEqual(Object.keys(shareOf.app()),['title','query'],'image failure preserves the challenge invitation');

console.log('Garden collection: storage guard, clears with undo rollback, star unlocks, toasts, home entry and small-screen page passed');

// Practice awards bamboo once, keeps ranked scores clean and resumes by stage.
const intro=boot();intro.run('continueOrStartGame()');
assert.equal(intro.run('state.basics.step'),0);
const trayRect=intro.run('({x:layout.horizontalPadding+layout.traySlotWidth,y:layout.trayY-10,width:layout.traySlotWidth,height:20})');
intro.tap(trayRect);assert.equal(intro.run('state.piecesPlaced'),0);
assert.ok(!intro.store.fangcunTutorialSeen);
const resumedIntro=boot(clone(intro.store));resumedIntro.run('continueOrStartGame()');
for(const move of [[1,6,4],[1,3,5],[0,6,1]]){
 resumedIntro.drop(...move);
 if(resumedIntro.run('state.basics.done'))resumedIntro.tap(resumedIntro.run('getBasicsActions(layout).next'));
}
assert.equal(resumedIntro.run('state.basics'),null);
assert.equal(resumedIntro.run('state.score'),0);assert.equal(resumedIntro.run('state.best'),0);
assert.equal(resumedIntro.run('state.gardenUndo'),null);
assert.equal(resumedIntro.run('state.collection.clears'),1);
assert.ok(resumedIntro.store.fangcunTutorialSeen);
assert.deepStrictEqual(resumedIntro.run('state.decor'),['bamboo']);
resumedIntro.run('returnHome();continueOrStartGame()');assert.equal(resumedIntro.run('state.basics'),null);
// Existing single-palace tutorial saves from 1.5.0 remain validated and playable.
const legacy=boot({fangcunTutorialSeen:true});legacy.run(`restartGame();state.gardenIntro=true;
 state.energy=2;state.energyPalaces=[0];state.tray=[null,SHAPES.find(p=>p.id==='line3H'),null];
 state.board=createBoard('easy');for(let r=0;r<2;r++)for(let c=0;c<3;c++)state.board[r][c]=1;saveCurrentGame()`);
const savedIntro=legacy.store[require('../js/persistence/saves').keyFor('easy')],badIntro=clone(savedIntro);
assert.ok(require('../js/persistence/saves').decode(savedIntro,'easy'));
badIntro.board=badIntro.board.map(row=>row.map(()=>0));assert.equal(require('../js/persistence/saves').decode(badIntro,'easy'),null);
const legacyResume=boot(clone(legacy.store));legacyResume.run('continueOrStartGame()');legacyResume.drop(1,0,2);
assert.equal(legacyResume.run('state.gardenIntro'),false);
// Old collection data migrates; hiding doesn't lose ownership or reannounce a gift.
resumedIntro.run('returnHome();openCollection()');
resumedIntro.tap(resumedIntro.run('getCollectionActions(layout).bamboo'));
assert.deepStrictEqual(resumedIntro.run('state.decor'),[]);
assert.deepStrictEqual(resumedIntro.run('state.ownedDecor'),['bamboo']);
const hidden=boot(resumedIntro.store);assert.deepStrictEqual(hidden.run('state.decor'),[]);
hidden.run('openCollection()');hidden.tap(hidden.run('getCollectionActions(layout).bamboo'));
assert.deepStrictEqual(hidden.run('state.decor'),['bamboo']);
assert.equal(hidden.run('state.collection.clears'),1);
const lockedBefore=clone(hidden.store[K.KEY]);hidden.tap(hidden.run('getCollectionActions(layout).plum'));
assert.deepStrictEqual(hidden.store[K.KEY],{...lockedBefore,target:'plum'});
assert.deepStrictEqual(clone(hidden.run('state.ownedDecor')),['bamboo'],'selecting a target does not grant it');
hidden.tap(hidden.run('getCollectionActions(layout).lotus'));
assert.equal(hidden.store[K.KEY].target,'lotus','selecting another locked item replaces the target');
hidden.tap(hidden.run('getCollectionActions(layout).lotus'));
assert.equal(hidden.store[K.KEY].target,null,'tapping the same target cancels it');
assert.deepStrictEqual(clone(hidden.run('state.ownedDecor')),['bamboo']);
// Undo can revisit the failure, but one attempt records only one failure, even after reload.
const repeated=boot();repeated.run('startChallenge(0)');
assert.ok(repeated.draw().some(t=>t.s==='整行还差'));
assert.ok(!repeated.draw().some(t=>t.s==='本关分数'),'challenge header prioritizes the goal');
for(const [slot,c,r] of [[1,0,0],[2,2,0],[0,0,2],[0,5,0]])repeated.drop(slot,c,r);
assert.equal(repeated.run('state.challengeProgress.fails[0]'),1);
assert.ok(repeated.draw().some(t=>t.s==='整行还差 1 行'),'failure explains the remaining goal');
assert.ok(repeated.draw().some(t=>t.s==='已用 4 / 4 步 · 步数已用完'));
repeated.run('undoMove(1)');repeated.drop(0,5,0);
const exhaustedFailure=clone(repeated.run('state.challenge'));repeated.run('undoMove(1)');
assert.deepStrictEqual(clone(repeated.run('state.challenge')),exhaustedFailure);
assert.equal(repeated.run('state.challengeProgress.fails[0]'),1);
assert.equal(repeated.events.filter(e=>e[0]==='level_result').length,1);
repeated.run('undoMove(1);returnHome()');const failedResume=boot(repeated.store);
failedResume.run('startChallenge(0,true)');assert.equal(failedResume.run('state.gameOver'),true);
assert.equal(failedResume.run('state.challengeProgress.fails[0]'),1);
assert.ok(!failedResume.run('challenges.freeHintReady(state.challengeProgress,0)'));
failedResume.run('restartGame()');
for(const [slot,c,r] of [[1,0,0],[2,2,0],[0,0,2],[0,5,0]])failedResume.drop(slot,c,r);
assert.equal(failedResume.run('state.challengeProgress.fails[0]'),2);
// Goal counts follow the board through play and undo, including pre-cleared area cells.
const goalUi=boot({[C.KEY]:{version:1,stars:Array(36).fill(3),chapter:2}});
goalUi.run('startChallenge(28)');
const remaining=()=>C.LEVELS[28].target-goalUi.run('state.challenge.progress');
const beforeGoal=remaining();assert.ok(beforeGoal<C.LEVELS[28].target);
assert.ok(goalUi.draw().some(t=>t.s===`${beforeGoal} 格`));
goalUi.drop(...C.LEVELS[28].solution[0]);
assert.ok(goalUi.draw().some(t=>t.s===`${remaining()} 格`));
goalUi.run('undoMove(1)');assert.equal(remaining(),beforeGoal);
assert.ok(goalUi.draw().some(t=>t.s===`${beforeGoal} 格`));
// After transient feedback, the compact goal card returns to the star budget.
assert.ok(goalUi.draw().some(t=>t.s.startsWith('已退回 1 步')));
goalUi.run('stepAnimations(Date.now()+5000)');
assert.ok(goalUi.draw().some(t=>t.s==='消除虚线内的所有方块'),'Rule guidance takes priority while open');
goalUi.tap(goalUi.run('mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip'));
// A spent three-star budget still allows finishing within the level's full limit.
goalUi.run('state.challenge.history=Array(challenges.LEVELS[28].par).fill({})');
assert.ok(goalUi.draw().some(t=>t.s==='仍可通关 · 重玩可再争三星'));
// New objectives have visible rules, valid witnesses, and invalidate only changed runs.
for(const id of [3,5,17,22,28,32]){
 const l=C.LEVELS[id],run=C.start(id);assert.ok(l.rule>=5);assert.ok(C.goal(l)&&C.detail(l));
 for(const move of l.solution)assert.ok(C.play(run,...move));
 assert.ok(run.won);assert.equal(C.stars(run),3);
 const progress=C.load({getStorageSync:()=>({version:1,stars:Array(36).fill(3),chapter:l.chapter,runs:Array.from({length:3},(_,i)=>i===l.chapter?{level:id,rule:4,history:[]}:null)})});
 assert.ok(progress.updatedLayout);assert.equal(progress.active,null);assert.equal(progress.stars[id],3);
}
const cross=C.start(3);C.play(cross,...C.LEVELS[3].solution[0]);assert.equal(cross.progress,0);
C.play(cross,...C.LEVELS[3].solution[1]);assert.ok(cross.won);
for(const size of [{w:320,h:568},{w:375,h:667},{w:390,h:844},{w:430,h:932}]){
 const ui=boot({},size);const actions=Object.fromEntries(K.TRACKS.flatMap(track=>Object.entries(ui.run(`getCollectionActions(layout,'${track.id}')`))));
 for(const rect of Object.values(actions)){assert.ok(rect.width>=44&&rect.height>=44);assert.ok(rect.x>=0&&rect.x+rect.width<=size.w&&rect.y+rect.height<=size.h);}
}
console.log('Retention checks: first-clear tutorial/relaunch, ranked-score isolation, decor toggles, unique attempt failures and six objective migrations passed');

// Strategy cue follows the live board, without placing a suggested move or changing energy.
const energyCue=boot({fangcunTutorialSeen:true});energyCue.run('continueOrStartGame();state.board=state.board.map(row=>row.map(()=>0));state.energyPalaces=[0];for(let r=0;r<2;r++)for(let c=0;c<3;c++)state.board[r][c]=1;state.board[2][0]=1;clearFeedback()');
assert.ok(energyCue.draw().some(t=>t.s==='充能九宫还差 2 格 · 填满可充能'));
energyCue.run('state.board[2][1]=1');assert.ok(energyCue.draw().some(t=>t.s==='充能九宫还差 1 格 · 填满可充能'));
energyCue.run('state.board=state.board.map(row=>row.map(()=>0))');assert.ok(!energyCue.draw().some(t=>t.s.includes('充能九宫')));

// Newly earned decor animates once on opening; idle and revisits do not keep redrawing.
const reveal=boot({[K.KEY]:{version:1,clears:20,seen:[],hidden:[]}});
reveal.run('openCollection()');assert.deepStrictEqual(clone(reveal.run('state.collectionReveal.ids')),['bamboo','plum']);
reveal.run('stepAnimations(Date.now()+1500)');assert.equal(reveal.run('state.collectionReveal'),null);
reveal.run('returnHome();openCollection()');assert.equal(reveal.run('state.collectionReveal'),null);

// A small-screen flower must show the remaining watering count promised by the rule card.
for(const size of [{w:320,h:568},{w:390,h:844}]){
 const flowers=boot({},size);flowers.run('startChallenge(36)');
 assert.ok(flowers.draw().some(t=>t.s==='2'),'new flower shows two waterings');
 assert.ok(flowers.draw().some(t=>t.s==='每次浇灌一次，数字归零就开花'));
 flowers.run('dismissMechanicGuide("skip")');
 assert.ok(flowers.draw().some(t=>t.s==='先完成目标 · 通关后可再争三星'));
 flowers.tap(flowers.run('getGoalAction(layout)'));
 assert.ok(flowers.draw().some(t=>t.s==='在花圃上下左右消除，每次浇灌一次。'),'Full rules stay accessible from the goal card');
 flowers.tap(flowers.run('getPlayPanelActions(layout,state).confirm'));
 for(const move of C.LEVELS[36].solution){
  flowers.drop(...move);
  if(flowers.run('state.challenge.flowers[0][2]')===1){assert.ok(flowers.draw().some(t=>t.s==='1'));break;}
 }
}

for(const mode of ['easy','medium','hard']){
 const lessonApp=boot();lessonApp.run(`state.mode='${mode}';continueOrStartGame()`);
 assert.equal(lessonApp.run('state.mode'),'easy','first practice always teaches a complete 9x9 board');
 for(const move of [[1,6,4],[1,3,5],[0,6,1]]){lessonApp.drop(...move);if(lessonApp.run('state.basics.done'))lessonApp.tap(lessonApp.run('getBasicsActions(layout).next'));}
 assert.equal(lessonApp.run('state.score'),0);assert.equal(lessonApp.run('state.collection.clears'),1);
 assert.ok(require('../js/persistence/saves').decode(lessonApp.store[require('../js/persistence/saves').keyFor(mode)],mode));
}
// Ordinary successful placement keeps the general guidance until the first clear.
const learner=boot();learner.run('restartGame();state.tray=[{...require("./js/rules/shapes").SHAPES.find(p=>p.id==="dot")},state.tray[1],state.tray[2]]');
learner.drop(0,0,0);assert.equal(learner.run('state.tutorialVisible'),true);
assert.ok(!learner.store.fangcunTutorialSeen);
console.log('All three layouts retain independent saves after practice; ordinary placement does not prematurely dismiss teaching');

// The chosen reward sends a player to its actual source and persists across sessions.
const firstChapterStars=[...Array(12).fill(3),...Array(C.LEVELS.length-12).fill(0)];
for(const [id,screen,chapter] of [['plum','playing',null],['moon','levels',1],['arbour','levels',3],['plaque','levels',1],['chime','daily',null],['bridge','daily',null]]){
 const targeted=boot({fangcunTutorialSeen:true,fangcunGameModeV2:'medium',
  [C.KEY]:{version:1,stars:firstChapterStars,chapter:0},
  [K.KEY]:{version:1,clears:1,seen:['bamboo','lamp','lantern'],hidden:[],target:id}});
 assert.equal(targeted.run('state.collection.target'),id);
 const page=targeted.draw().map(t=>t.s).join(' ');
 assert.ok(page.includes(K.named(id)),id+' target is visible on the home page');
 targeted.tap(targeted.run('getHomeActions(layout).target'));
 assert.equal(targeted.run('state.screen'),screen,id+' opens its actual earning mode');
 if(chapter!==null)assert.equal(targeted.run('state.levelChapter'),chapter);
 if(screen==='playing'){assert.equal(targeted.run('state.challenge'),null);assert.equal(targeted.run('state.mode'),'medium');}
}
const targeted=boot({fangcunTutorialSeen:true,
 [K.KEY]:{version:1,clears:1,seen:['bamboo'],dailyCompletions:6,target:'chime'}});
assert.ok(targeted.draw().map(t=>t.s).join(' ').includes('6/7 天'));
targeted.run('continueOrStartGame();state.gameOver=true;state.gameOverProgress=1');
assert.ok(targeted.draw().some(t=>t.s===K.focus(targeted.store[K.KEY],0,'clears').text),'garden result keeps a selected daily goal visible');
targeted.run('startChallenge(0)');
for(const [slot,c,r] of C.LEVELS[0].solution)targeted.run(`playChallenge({trayIndex:${slot},target:{col:${c},row:${r}}});stepAnimations(Date.now()+5000)`);
targeted.run('state.gameOverProgress=1');
assert.ok(targeted.draw().some(t=>t.s===K.focus(targeted.store[K.KEY],3,'stars').text),'chapter result keeps a selected daily goal visible');

// A reward already earned on a previous run announces completion until it is acknowledged.
const achieved=boot({[K.KEY]:{version:1,clears:20,seen:['bamboo'],target:'plum'}});
const achievedText=achieved.draw().map(t=>t.s).join(' ');
assert.ok(achievedText.includes('已添：梅花') && achievedText.includes('目标达成'),'home acknowledges the reached target');
achieved.tap(achieved.run('getHomeActions(layout).target'));
assert.equal(achieved.run('state.screen'),'collection');assert.equal(achieved.store[K.KEY].target,null);
assert.ok(achieved.run('state.ownedDecor').includes('plum'));assert.ok(achieved.store[K.KEY].seen.includes('plum'));
assert.ok(boot(achieved.store).run('state.ownedDecor').includes('plum'),'acknowledging the target never revokes ownership');
console.log('Collection target integration: real taps, cancel/replace, earning routes, home/results and completion acknowledgment passed');

// Daily completion updates the selected long-term goal; an unsaved result remains the priority.
const sixDays={},todayMs=Date.parse(Daily.dateKey()+'T00:00:00Z');
for(let i=1;i<=6;i++){
 const date=new Date(todayMs-i*86400000).toISOString().slice(0,10),month=date.slice(0,7);
 sixDays[month]=(sixDays[month]||0)|2**(Number(date.slice(-2))-1);
}
for(const id of ['bridge','chime']){
 const dailyTarget=boot({[Daily.KEY]:{version:1,marks:sixDays},[K.KEY]:{version:1,clears:1,seen:['bamboo'],target:id}});
 dailyTarget.run('openDaily()');dailyTarget.tap(dailyTarget.run('getSpecialActions(layout).start'));
 const level=C.level(dailyTarget.run('state.challenge.level'));
 for(const [slot,c,r] of level.solution)dailyTarget.run(`playChallenge({trayIndex:${slot},target:{col:${c},row:${r}}});stepAnimations(Date.now()+5000)`);
 dailyTarget.run('state.gameOverProgress=1');
 assert.equal(dailyTarget.store[K.KEY].dailyCompletions,7);
 const line=K.focus(dailyTarget.store[K.KEY],0,'memorial').text;
 assert.ok(dailyTarget.draw().some(t=>t.s===line),'daily result prioritizes the selected target '+id);
 if(id==='chime')assert.ok(dailyTarget.run('state.ownedDecor').includes('chime'),'daily target grants the actual reward at its threshold');
 dailyTarget.run('state.savePending=true');
 const pending=dailyTarget.draw();
 assert.ok(pending.some(t=>t.s==='进度待保存，请稍候再退出'));
 assert.ok(!pending.some(t=>t.s===line),'a selected target never hides the save warning');
}
console.log('Daily collection goals: updated progress, completed reward and save-warning priority passed');
