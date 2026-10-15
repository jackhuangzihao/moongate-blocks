const assert=require('assert');
const C=require('../js/challenge/challenges'),D=require('../js/daily/daily'),B=require('../js/rules/board'),S=require('../js/platform/sharing');
const definitions=require('../js/daily/daily-week-one');
const {boot,clone,protectedStore,protectedState}=require('./helpers/game-harness');
const weekly=[-29,-30,-31,-32,-33,-34,-35].map(id=>C.level(id));
assert.equal(definitions.length,7);assert.equal(weekly.length,7);
assert.equal(D.levelFor('2026-10-12'),-8,'The day before activation retains its original puzzle');
assert.equal(D.levelFor('2026-10-13'),-37,'Activation is Tuesday, not a shifted Monday puzzle');
for(let i=0;i<35;i++)assert.equal(D.levelFor(D.dateKey(Date.UTC(2026,9,19+i))),D.WEEKLY_IDS[i%7]);
for(const invalid of ['2026-02-30','not-a-date',null])assert.equal(D.levelFor(invalid),null);

let previews=0,shortcuts=0,orderSensitive=0,twoStarRoutes=0;
for(const [index,level] of weekly.entries()){
 const definition=definitions[index],original=JSON.stringify(level),run=C.start(level.id);
 assert.ok(['适中','进阶','较难'].includes(level.difficulty));assert.ok(level.theme.length<=8);
 assert.ok(level.par>=6 && level.par<=9);assert.equal(level.limit,level.par+3);
 assert.equal(level.solution.length,level.par);assert.equal(definition.plan.length,level.par);
 assert.equal(definition.board.length,9);definition.board.forEach(row=>assert.match(row,/^[01]{9}$/));
 assert.equal(level.deck.length>=Math.ceil(level.limit/3)*3,true);
 for(const key of run.keys){assert.equal(run.board[key[1]][key[0]],1);assert.ok(run.gates.some(g=>g.id===key[2]));}
 for(const flower of run.flowers)assert.equal(run.board[flower[1]][flower[0]],2);
 const opened=new Set(),used=new Set();
 for(const move of level.solution){
   const before=clone(run),preview=C.preview(run,...move);assert.ok(preview,level.title);
   assert.deepStrictEqual(run,before,'Hover preview must be immutable');
   for(const [x,y] of run.tray[move[0]].cells)if(opened.has(`${move[1]+x},${move[2]+y}`))used.add(`${move[1]+x},${move[2]+y}`);
   const result=C.play(run,...move);assert.ok(result);
   for(const key of Object.keys(result))assert.deepStrictEqual(preview[key],result[key]);
   for(const [x,y] of result.openedGates)opened.add(`${x},${y}`);
   assert.equal(run.won,run.history.length===level.par,'No padding placements after completing the goal');
   if(!run.ended){assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);assert.deepStrictEqual(C.undo(run),before);}
   previews++;
 }
 assert.equal(C.stars(run),3,level.title+' has a verified three-star route');
 if(level.gates){assert.equal(run.gates.length,0);assert.ok(used.size,'Open space must be used, not decorative');}
 assert.equal(JSON.stringify(level),original);
 // Exhaustive one/two-placement checks catch accidental short tutorial solutions.
 const initial=C.start(level.id);
 for(let slot=0;slot<3;slot++)for(let r=0;r<9;r++)for(let c=0;c<9;c++){
   if(!B.canPlace(initial.board,initial.tray[slot],c,r))continue;
   const first=clone(initial);C.play(first,slot,c,r);assert.equal(first.won,false);
   for(let next=0;next<3;next++)if(first.tray[next])for(let y=0;y<9;y++)for(let x=0;x<9;x++){
     if(!B.canPlace(first.board,first.tray[next],x,y))continue;
     const second=clone(first);C.play(second,next,x,y);shortcuts++;
     assert.equal(second.won,false,level.title+' must require planning beyond two moves');
   }
 }
 // Some moves in the same hand have to wait for a row clear or gate opening.
 let sensitive=false;
 for(let a=0;a<level.par&&!sensitive;a++)for(let b=a+1;b<Math.min(level.par,(Math.floor(a/3)+1)*3);b++){
   const plan=clone(level.solution);[plan[a],plan[b]]=[plan[b],plan[a]];const trial=C.start(level.id);
   for(const move of plan)if(!C.play(trial,...move))break;
   if(!trial.won){sensitive=true;break;}
 }
 orderSensitive+=Number(sensitive);
 // A spare final-hand piece can be played safely: two-star completion is real,
 // rather than giving three stars to every possible win.
 if(level.par%3){
   const prefix=Math.floor(level.par/3)*3,tail=level.solution.slice(prefix),base=C.start(level.id);
   level.solution.slice(0,prefix).forEach(move=>C.play(base,...move));
   const unused=[0,1,2].filter(slot=>!tail.some(move=>move[0]===slot));let slower;
   for(const slot of unused)for(let r=0;r<9&&!slower;r++)for(let c=0;c<9&&!slower;c++){
     const trial=clone(base);if(!C.play(trial,slot,c,r)||trial.ended)continue;
     for(const move of tail)if(!C.play(trial,...move))break;
     if(trial.won&&C.stars(trial)===2)slower=trial;
   }
   assert.ok(slower,level.title+' allows a slower successful attempt');twoStarRoutes++;
 }
}
assert.ok(orderSensitive>=4);assert.ok(twoStarRoutes>=3);
// Regression: the original prototype put both markers in a column and was won
// by three horizontal pieces. The revised first puzzle separates the targets.
const formerlyTrivial=C.start(weekly[0].id);
for(const move of [[1,2,5],[2,4,7],[0,3,3]])C.play(formerlyTrivial,...move);
assert.equal(formerlyTrivial.won,false);

// Calendar rollover, old marks and active attempts survive the dated rollout.
const old=D.start(null,'2026-10-12');C.play(old,...C.level(old.level).solution[0]);
const oldProgress=D.update({version:1,active:null,records:[],marks:{}},old);
assert.equal(D.start(oldProgress,'2026-10-12').history.length,1);
assert.equal(D.start(oldProgress,'2026-10-13').level,-37);
const oldCompleted=C.start(-8);C.level(-8).solution.forEach(move=>C.play(oldCompleted,...move));oldCompleted.dailyDate='2026-10-12';
const completed=D.update(oldProgress,oldCompleted);
assert.equal(D.completedOn(completed,'2026-10-12'),true);
assert.equal(D.normalize(completed).records[0].bestSteps,oldCompleted.history.length);

for(let index=0;index<7;index++){
 const date=D.dateKey(Date.UTC(2026,9,19+index)),level=C.level(D.WEEKLY_IDS[index]),store=protectedStore(),protectedBefore=protectedState(store);
 const options={clock:{value:Date.parse(date+'T04:00:00Z')}};
 const app=boot(store,options);app.run('openDaily()');
 const labels=app.draw();assert.ok(labels.some(item=>item.text.includes(level.difficulty)));
 app.run('startDaily()');assert.equal(app.run('state.challenge.level'),level.id);
 app.move(level.solution[0]);app.run('undoMove(1)');assert.equal(app.run('state.challenge.undoBudget.spent'),1);
 const resumed=boot(store,options);resumed.run('openDaily();startDaily()');assert.equal(resumed.run('state.challenge.undoBudget.spent'),1);
 resumed.complete();assert.equal(resumed.run('challenges.stars(state.challenge)'),3);
 assert.equal(D.completedOn(store[D.KEY],date),true);assert.deepStrictEqual(protectedState(store),protectedBefore);
 const card=S.resultCard(resumed.run('state')),query=Object.fromEntries(new URLSearchParams(card.query));
 assert.equal(S.parseInvitation(query).level,level.id);assert.equal(S.parseInvitation({...query,rule:'999'}),null);
 // Failed-share recipients start a separate attempt and cannot overwrite their daily save.
 const friend=boot(store,{...options,query:{...query,help:'1'}});friend.run('startInvitation()');friend.complete();
 assert.deepStrictEqual(protectedState(store),protectedBefore);
}
// A same-day old link remains valid and preserves its original level and rule.
const oldCard=S.resultCard({screen:'playing',gameOver:true,challenge:oldCompleted,piecesPlaced:oldCompleted.history.length});
assert.equal(S.parseInvitation(Object.fromEntries(new URLSearchParams(oldCard.query))).level,-8);
// Updating late must not discard old-bank results made after the rollout date.
const lateDate='2026-10-20',lateOldId=-16,lateRun=C.start(lateOldId);
lateRun.dailyDate=lateDate;lateRun.undoBudget={...require('../js/rules/undo-budget').create(),spent:1};
C.play(lateRun,...C.level(lateOldId).solution[0]);
const lateStore=protectedStore();lateStore[D.KEY]=D.update(null,lateRun);
const lateOptions={clock:{value:Date.parse(lateDate+'T04:00:00Z')}};
const late=boot(lateStore,lateOptions);late.run('openDaily()');
assert.ok(late.draw().some(label=>label.text===C.level(lateOldId).title));
late.run('startDaily()');assert.equal(late.run('state.challenge.level'),lateOldId);
assert.equal(late.run('state.challenge.history.length'),1);assert.equal(late.run('state.challenge.undoBudget.spent'),1);
late.complete();const lateOldQuery=Object.fromEntries(new URLSearchParams(S.resultCard(late.run('state')).query));
assert.equal(S.parseInvitation(lateOldQuery).level,lateOldId);
late.run('openDaily();startDaily()');assert.equal(late.run('state.challenge.level'),D.levelFor(lateDate));
late.complete();assert.equal(lateStore[D.KEY].records.filter(record=>record.date===lateDate).length,2,'Keep best steps separately for different puzzles');
assert.equal(D.completedCount(lateStore[D.KEY]),1,'A date earns one stamp, even across puzzle banks');
late.run('openDaily()');assert.ok(late.draw().some(label=>label.text===`已完成 · 最佳 ${C.level(D.levelFor(lateDate)).par} 步`));
const kept=clone(lateStore[D.KEY]),legacyFriend=boot(lateStore,{...lateOptions,query:lateOldQuery});
assert.equal(legacyFriend.run('state.screen'),'invitation');legacyFriend.run('startInvitation()');
legacyFriend.move(C.level(lateOldId).solution[0]);legacyFriend.handlers.Show({query:lateOldQuery});
assert.equal(legacyFriend.run('state.screen'),'playing');assert.equal(legacyFriend.run('state.challenge.history.length'),1);
legacyFriend.complete();assert.deepStrictEqual(lateStore[D.KEY],kept,'Same-day old-bank shares are isolated from new-bank daily progress');
console.log(`PASS: seven weekly three-star routes (${previews} moves), ${shortcuts} exhaustive two-move checks, ${orderSensitive} order-sensitive routes, ${twoStarRoutes} slower wins, dated rollout and real touch/share/save integration`);
