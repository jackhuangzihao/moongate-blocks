const assert=require('assert');
const C=require('../js/challenge/challenges'),D=require('../js/daily/daily'),B=require('../js/rules/board'),S=require('../js/platform/sharing');
const {decode}=require('../js/rules/level-data'),{boot,clone,queryFor}=require('./helpers/game-harness');
const E=require('./design/evaluator');
const additions=C.LEVELS.slice(60),daily=D.WEEKLY_IDS.map(id=>C.level(id));
assert.equal(additions.length,30);assert.equal(daily.length,7);
assert.throws(()=>decode({title:'bad',board:['0']}),/Invalid authored board/);
const sequence=C.CHAPTERS.flatMap((_,i)=>C.chapterLevels(i));
assert.equal(new Set(sequence.map(l=>l.id)).size,90);
sequence.forEach((l,i)=>{assert.equal(l.number,i+1);assert.equal(C.nextLevel(l.id),sequence[i+1]?.id??null);});
assert.equal(C.nextLevel(11),60);assert.equal(C.nextLevel(65),12);assert.equal(C.nextLevel(89),null);
for(let chapter=0;chapter<5;chapter++)assert.equal(C.chapterLevels(chapter).length,18);

// Every original ID, earned star and partially played chapter survives expansion.
const oldStars=Array(60).fill(3),active=C.start(49);C.play(active,...C.level(49).solution[0]);
const old={version:1,stars:oldStars,chapter:4,runs:[null,null,null,null,C.checkpoint(active)],
 bestSteps:C.LEVELS.slice(0,60).map(l=>l.par),bestRules:C.LEVELS.slice(0,60).map(l=>l.rule)};
const migrated=C.load({getStorageSync:()=>old});
assert.deepStrictEqual(migrated.stars.slice(0,60),oldStars);
assert.ok(migrated.stars.slice(60).every(n=>n===0));assert.deepStrictEqual(C.restore(migrated.active),active);
assert.deepStrictEqual(migrated.bestSteps.slice(0,60),old.bestSteps);
for(let chapter=0;chapter<5;chapter++){
 assert.equal(C.unlocked(migrated,chapter),60+chapter*6);
 assert.ok(C.isUnlocked(migrated,chapter*12+11));assert.ok(!C.isUnlocked(migrated,61+chapter*6));
}
const gap=clone(old);gap.stars[7]=0;gap.stars[60]=3;
const clean=C.load({getStorageSync:()=>gap});assert.equal(clean.stars[60],0);assert.equal(clean.stars[12],3);

let moves=0,shortcuts=0;
for(const level of additions.concat(daily)){
 const start=C.start(level.id),original=JSON.stringify(level),coordinates=p=>p.slice(0,2).join(',');
 assert.equal(level.deck.length>=Math.ceil(level.limit/3)*3,true);
 assert.equal(level.par,level.solution.length);assert.ok(E.options(start).length>=3,'A puzzle offers placement choices');
 for(const list of [level.stones,level.ice,level.flowers,level.keys]){
  assert.equal(new Set(list.map(coordinates)).size,list.length,level.title+' unique targets');
  for(const [c,r] of list)assert.ok(Number.isInteger(c)&&Number.isInteger(r)&&c>=0&&c<9&&r>=0&&r<9);
 }
 const run=C.start(level.id),doors=new Set(),used=new Set();let broken=0;
 for(const [index,move] of level.solution.entries()){
  const before=clone(run),preview=C.preview(run,...move);assert.deepStrictEqual(run,before);
  const piece=run.tray[move[0]];
  piece.cells.forEach(([x,y])=>{const cell=[x+move[1],y+move[2]].join(',');if(doors.has(cell))used.add(cell);});
  const result=C.play(run,...move);assert.ok(result,level.title);assert.equal(preview.won,run.won);
  result.openedGates.forEach(p=>doors.add(coordinates(p)));broken+=result.brokenIce.length;
  assert.equal(run.won,index===level.par-1,level.title+' reference has no trailing moves');
  if(!run.won)assert.deepStrictEqual(C.restore(C.checkpoint(run)),run);
  moves++;
 }
 assert.equal(C.stars(run),3);assert.equal(JSON.stringify(level),original);
 if(level.gates.length){assert.ok(doors.size>0,level.title+' opens a gate');assert.ok(used.size>0,level.title+' uses opened space');}
 if(level.ice.length)assert.ok(broken>0,level.title+' uses ice');
 // Exhaustive two-placement search, including all tray order choices.
 for(const first of E.options(start)){
  const one=E.clone(start);C.play(one,...first);assert.ok(!one.won,level.title+' one-move shortcut');
  for(const second of E.options(one)){
   const two=E.clone(one);C.play(two,...second);assert.ok(!two.won,level.title+' two-move shortcut');shortcuts++;
  }
 }
}
// Old weekly links remain playable after the new bank takes over.
for(let i=0;i<7;i++){
 const date=D.dateKey(Date.UTC(2026,9,19+i)),id=-29-i;
 assert.ok(D.matchesDate(date,id));assert.equal(S.parseInvitation(queryFor(id,date)).level,id);
 assert.equal(D.levelFor(date),-36-i);assert.ok(!D.matchesDate(date,-36-(i+1)%7));
}
// Real taps must reach scrolled cards, update the selected chapter, and follow the
// chapter order across appended IDs instead of silently jumping to another chapter.
for(const size of [{w:320,h:568},{w:390,h:844}]){
 const store={[C.KEY]:old},app=boot(store,{size});
 app.run("state.homeMode='challenge';state.screen='levels';state.levelChapter=0;state.levelScroll=levelScrollFor(layout,challenges.level(60))");
 const labels=app.draw().map(x=>x.text);assert.ok(labels.includes('13'));
 app.tap(app.run('getLevelActions(layout,0,state.levelScroll)[60]'));assert.equal(app.run('state.challenge.level'),60);
 app.complete();app.tap(app.run('getGameOverActions(layout,state).restart'));assert.equal(app.run('state.challenge.level'),61);
 app.run("state.screen='levels';state.levelScroll=100");app.tap(app.run('getChapterActions(layout)[1]'));assert.equal(app.run('state.levelScroll'),0);
}
console.log(`PASS: 90 stable IDs / chapter order, 60-level migration, 37 new three-star routes (${moves} moves), ${shortcuts} two-move checks, original daily links and scrollable real touch navigation`);
// Seed + generator version reproduces the published candidate; route curation
// and board decoding may reorder coordinate sets but cannot alter their cells.
const G=require('./design/generator');
for(const definition of require('../js/challenge/challenge-expansion').concat(require('../js/daily/daily-week-two'))){
 const a=G.candidate(definition.seed,definition.generatorProfile),b=decode(definition);
 assert.equal(definition.generatorVersion,G.VERSION);
 for(const key of ['filled','blocked'])assert.deepStrictEqual(a[key].map(p=>p.join(',')).sort(),b[key].map(p=>p.join(',')).sort());
 for(const key of ['deck','stones','ice','flowers','keys','gates','target'])assert.deepStrictEqual(a[key],b[key],definition.title+' '+key);
}
assert.throws(()=>G.candidate(-1,'intro'));assert.throws(()=>G.candidate(1,'unknown'));
const count=C.LEVELS.length;G.evaluate(null);assert.equal(C.LEVELS.length,count);
const tutorialSolving=E.solve(0,{width:5,maxSteps:1});assert.equal(tutorialSolving.route.length,1);
console.log('PASS: reproducible seeds/profiles and bounded offline solver');
// Baseline regression gates check the intended separation, not a claimed human difficulty score.
assert.ok([101,102,103,104].every(seed=>E.greedy(60,seed,true).won),'First expansion puzzle stays approachable');
for(const level of daily){
 const wins=[101,102,103,104].filter(seed=>E.greedy(level.id,seed,true).won).length;
 assert.ok(wins<=1,level.title+' should require more than the near-complete-region heuristic');
}
console.log('PASS: approachable chapter expansion and separate daily baseline');
