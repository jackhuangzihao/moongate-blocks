// Reproducible developer benchmark; does not run on players' phones.
const fs=require('fs'),path=require('path'),C=require('../../js/challenge/challenges'),D=require('../../js/daily/daily'),E=require('./evaluator');
const seeds=Array.from({length:24},(_,i)=>i+101);
const groups={legacyDaily:[-29,-30,-31,-32,-33,-34,-35],daily:D.WEEKLY_IDS,
 chapterIntroductions:[0,1,2,12,24,36,48],chapterExpansion:C.LEVELS.slice(60).map(l=>l.id)};
const report={version:1,seeds,meaning:'Bot wins are a reproducible regression signal, not estimated human win rates.',groups:{}};
for(const [name,ids] of Object.entries(groups)){
 report.groups[name]=ids.map(id=>{
  const level=C.level(id),row={id,number:level.number,chapter:level.chapter,title:level.title,par:level.par,limit:level.limit,choices:E.options(C.start(id)).length};
  for(const [strategy,fit] of [['immediate',false],['nearComplete',true]]){
   const runs=seeds.map(seed=>E.greedy(id,seed,fit));row[strategy]={wins:runs.filter(r=>r.won).length,threeStars:runs.filter(r=>r.stars===3).length,attempts:seeds.length};
  }
  return row;
 });
 console.log(name,report.groups[name].map(r=>`${r.title}:${r.immediate.wins}/${seeds.length},${r.nearComplete.wins}/${seeds.length}`).join(' '));
}
fs.writeFileSync(path.resolve(__dirname,'../../docs/difficulty-review/benchmark.json'),JSON.stringify(report,null,2)+'\n');
