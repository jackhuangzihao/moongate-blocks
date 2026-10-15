// Seeded offline candidates. Increment VERSION before changing generation rules.
// The game ships reviewed snapshots, so changing this tool cannot change old saves.
const C=require('../../js/challenge/challenges'),B=require('../../js/rules/board'),E=require('./evaluator');
const VERSION=1;
const PROFILES=['intro','regions','ice','stones','flowers','gates','mixed'];
const BASIC=['line2H','line2V','line3H','line3V','square2','corner3A','corner3B','corner3C','corner3D'];
const unique=cells=>[...new Map(cells.map(p=>[p.slice(0,2).join(','),p])).values()];
function candidate(seed,profile) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!PROFILES.includes(profile))throw Error('Invalid candidate seed/profile');
  const rnd=E.random(seed),filled=[],empty=[],shapes=profile==='intro'?BASIC:BASIC.concat('tee4Down','tee4Right');
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)(rnd()<.39?filled:empty).push([c,r]);
  if(filled.length<3||empty.length<3)return null;
  const level={title:'候选',chapter:0,rule:1,kind:'regions',target:profile==='intro'?3:5,filled,holes:[],blocked:[],
    stones:[],ice:[],keys:[],gates:[],flowers:[],limit:11,par:8,seed,generatorVersion:VERSION,generatorProfile:profile,
    deck:Array.from({length:15},()=>shapes[Math.floor(rnd()*shapes.length)])};
  const pick=cells=>cells[Math.floor(rnd()*cells.length)].slice();
  if(profile==='ice'){
    level.kind='stones';level.stones=[pick(filled),pick(filled)];level.ice=level.stones.map(p=>p.slice());
  }
  if(profile==='stones'){
    level.kind='stones';level.stones=[pick(filled),pick(filled),pick(filled)];level.blocked=empty.filter(()=>rnd()<.09);
  }
  if(profile==='flowers'||profile==='mixed'){
    level.kind='flowers';level.flowers=unique([pick(empty),pick(empty)].map(p=>[...p,2]));
    level.target=level.flowers.length;level.blocked=level.flowers.map(p=>p.slice(0,2));
  }
  if(profile==='gates'||profile==='mixed'){
    if(profile==='gates'){level.kind='stones';level.stones=[pick(filled),pick(filled)];}
    else level.ice=[pick(filled),pick(filled)];
    level.keys=[[...pick(filled),'A']];
    const cells=[pick(empty),pick(empty),pick(empty)].filter(p=>!level.blocked.some(q=>q[0]===p[0]&&q[1]===p[1]));
    level.gates=[{id:'A',cells:unique(cells)}];
    if(!level.gates[0].cells.length)return null;
  }
  level.stones=unique(level.stones);level.ice=unique(level.ice);
  if(level.kind==='stones')level.target=level.stones.length;
  return level;
}
function evaluate(level,width=90) {
  if(!level)return null;
  const trial={...level,id:C.LEVELS.length};
  C.LEVELS.push(trial);
  try {
    const run=C.start(trial.id),done=B.findCompletedRegions(run.board);
    if(done.rows.length+done.cols.length+done.palaces.length)return null;
    const solved=E.solve(trial.id,{width,maxSteps:10});
    if(!solved.route)return null; // Search exhaustion is inconclusive; omit the candidate.
    trial.solution=solved.route;trial.par=solved.route.length;trial.limit=trial.par+3;
    trial.baseline=[1,2,3,4].map(seed=>E.greedy(trial.id,seed,true));
    return trial;
  } finally { C.LEVELS.pop(); }
}
if(require.main===module) {
  const fs=require('fs'),path=require('path');
  try {
    const [profile,seedText,countText='1']=process.argv.slice(2),seed=Number(seedText),count=Number(countText);
    if(!Number.isInteger(count)||count<1||count>300||!Number.isInteger(seed)||seed+count-1>0xffffffff)throw Error('Usage: node tests/design/generator.js PROFILE SEED COUNT(1..300)');
    const output=[];
    for(let i=0;i<count;i++){
      const found=evaluate(candidate(seed+i,profile));if(found)output.push(found);
      console.log(`[level-design] checked ${i+1}/${count}, solvable candidates ${output.length}`);
    }
    const file=path.resolve(__dirname,`../../docs/difficulty-review/candidates-${profile}-${seed}.json`);
    fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
    console.log(`[level-design] saved ${file}; candidates still need manual review`);
  } catch(error) { console.error(`[level-design] ${error.message}`);process.exitCode=1; }
}
module.exports={VERSION,PROFILES,candidate,evaluate};
