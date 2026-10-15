const { SHAPES } = require('../rules/shapes');
const shape = id => SHAPES.find(piece => piece.id === id);
const row = r => Array.from({ length: 9 }, (_, c) => [c, r]);
const col = c => Array.from({ length: 9 }, (_, r) => [c, r]);
const palace = (c, r) => Array.from({ length: 9 }, (_, i) => [c + i % 3, r + Math.floor(i / 3)]);
const hole = (id, c, r) => shape(id).cells.map(([x, y]) => [x + c, y + r]);
const CHAPTERS = [
  { title: '初入庭间', detail: '组合拼块 · 留好下一手' },
  { title: '霜落石径', detail: '先破薄冰 · 再清标记' },
  { title: '曲径深处', detail: '石障限位 · 综合布局' },
  { title: '借景成局', detail: '邻格浇灌 · 花开成景' },
  { title: '启扉寻幽', detail: '收集钥匙 · 开门换局' }
];
const tutorials = [
  { title: '初见', kind: 'rows', target: 1, par: 1, limit: 4, 
    filled: row(4), holes: hole('line3H',3,4), deck: ['line3H','dot','line2V'], solution: [[0,3,4]] },
  { title: '听竹', kind: 'cols', target: 1, par: 1, limit: 4, 
    filled: col(4), holes: hole('line3V',4,3), deck: ['line2H','line3V','dot'], solution: [[1,4,3]] },
  { title: '方寸', kind: 'palaces', target: 1, par: 1, limit: 4, 
    filled: palace(3,3), holes: hole('line3H',3,5), deck: ['dot','line2V','line3H'], solution: [[2,3,5]] },
];

// Authored pieces partition each work area; mixing areas within a tray requires planning.
const PATTERNS = {
  s: [['line3H',0,1]],
  t: [['tee4Down',0,0]],
  a: [['square2',0,0],['line3H',0,2]],
  b: [['corner3B',0,0],['line2V',2,1]],
  c: [['tee4Down',0,0],['line2H',0,2]]
};
// Sites use [palace column, palace row, pattern, frozen]. The arrangements below are fixed.
function puzzle(title, sites) {
  const level = { title, kind:'stones', filled:[], holes:[], stones:[], ice:[], blocked:[], deck:[], solution:[] };
  const plans = sites.map(([pc,pr,pattern,frozen]) => {
    const cells = palace(pc*3,pr*3), pieces = PATTERNS[pattern].map(([id,x,y])=>[id,pc*3+x,pr*3+y]);
    const holes = pieces.flatMap(([id,c,r])=>hole(id,c,r));
    const filled = cells.filter(([x,y])=>!holes.some(([c,r])=>c===x&&r===y));
    level.filled.push(...cells); level.holes.push(...holes); level.stones.push(filled[filled.length-1]);
    if (frozen) level.ice.push(...filled);
    return { pieces, frozen };
  });
  const plan = [];
  for (let pass=0;pass<2;pass++) for (let step=0;step<3;step++) {
    plans.forEach(site=>{ if ((!pass || site.frozen) && site.pieces[step]) plan.push(site.pieces[step]); });
  }
  return finish(level, plan);
}
function finish(level, plan) {
  level.deck=[];level.solution=[];
  for (let i=0;i<plan.length;i+=3) {
    const batch=plan.slice(i,i+3), offset=(i/3)%2?1:2;
    const hand=['line2H','dot','line2V'];
    batch.forEach(([id,c,r],j)=>{const slot=(j+offset)%3;hand[slot]=id;level.solution.push([slot,c,r]);});
    level.deck.push(...hand);
  }
  level.par=plan.length;level.limit=level.par+3;level.target=level.stones.length;
  return level;
}
function crossing(title, frozen=false) {
  const plan=[['plus5',3,3],['line2H',0,4],['line3V',4,0],['line2V',4,7],['line3H',6,4],['dot',4,4]];
  const holes=plan.slice(0,5).flatMap(([id,c,r])=>hole(id,c,r));
  if (frozen) plan.push(['line2H',0,4],['line3H',3,4],['line3H',6,4]);
  return finish({title,kind:'stones',filled:row(4).concat(col(4)),holes,stones:[[2,4],[4,6]],
    ice:frozen?[[2,4]]:[],blocked:frozen?[[0,0],[2,0],[6,0],[8,0],[1,1],[7,1],[0,2],[2,2],[6,2],[8,2],[0,6],[8,6],[1,7],[7,7],[0,8],[8,8]]:[],
    },plan);
}

// Fixed, verified layouts. Board digits: 0 empty, 1 block, 2 permanent obstacle.
// Their crossing roads share cells, so clearing one changes the next placement.
const revised = require('./challenge-layouts').map(({id,title,board,stones,ice,plan}) => {
  const filled=[], blocked=[];
  board.forEach((row,r)=>[...row].forEach((cell,c)=>{
    if(cell==='1')filled.push([c,r]);
    if(cell==='2')blocked.push([c,r]);
  }));
  return {...finish({title,kind:'stones',filled,holes:[],stones,ice,blocked},plan),id,rule:4};
});
// Keep each chapter's introduction and the first combinations approachable.
const introductions = {
  0:tutorials[0], 1:tutorials[1], 2:tutorials[2],
  3:puzzle('双晴', [[0,0,'a'],[2,2,'s']]),
  4:puzzle('石径', [[0,2,'a'],[2,0,'b']]),
  5:puzzle('转角', [[0,0,'b'],[2,2,'c'],[0,2,'t']]),
  6:crossing('相逢'),
  12:puzzle('初霜', [[0,0,'s',true],[2,2,'a']]),
  13:puzzle('融雪', [[0,0,'b',true],[2,2,'c']]),
  24:crossing('入曲',true)
};
const LEVELS = Array.from({length:36},(_,id)=>introductions[id] || revised.find(level=>level.id===id));
// Six interludes change the task, while keeping the authored fixed-deck puzzles.
const linked = finish({title:'双晴',kind:'cross',filled:row(4).concat(palace(3,3)),
  holes:hole('line3H',3,4).concat(hole('line3H',3,5)),stones:[],ice:[],blocked:[]},
  [['line3H',3,5],['line3H',3,4]]);
linked.target=1; linked.rule=5; LEVELS[3]=linked;
for (const [id,kind,target] of [[5,'regions',3],[17,'ice',3],[22,'regions',6]]) {
  Object.assign(LEVELS[id],{kind,target,stones:[],rule:5});
}
// Ice in 冷泉 is all broken on move seven; later clearing is deliberately optional.
LEVELS[17].solution=LEVELS[17].solution.slice(0,7);
LEVELS[17].par=7; LEVELS[17].limit=10;
for (const [id,cells] of [[28,row(6)],[32,palace(6,0)]]) {
  const level=LEVELS[id];
  level.area=cells.filter(([c,r])=>!level.blocked.some(([x,y])=>x===c&&y===r));
  Object.assign(level,{kind:'area',target:level.area.length,stones:[],rule:5});
}
// Preserve the rule ids used by existing saves. These layouts previously used
// a tighter move limit; widening it below does not change a saved placement.
LEVELS.forEach((level,id)=>{
  if(id>=7 && ![12,13,24].includes(id)) level.rule=6;
});
for (const {title,kind,target,board,stones,ice,area,flowers,keys,gates,plan} of [
  ...require('./challenge-chapter-four'), ...require('./challenge-chapter-five')
]) {
  const filled=[],blocked=[];
  board.forEach((row,r)=>[...row].forEach((cell,c)=>{
    if(cell==='1')filled.push([c,r]);
    if(cell==='2')blocked.push([c,r]);
  }));
  for(const [c,r] of flowers||[])if(!blocked.some(([x,y])=>x===c&&y===r))blocked.push([c,r]);
  const level=finish({title,kind,filled,holes:[],stones,ice,blocked,...(area?{area}:{}),...(flowers?{flowers}:{}),
    ...(keys?{keys}:{}),...(gates?{gates}:{})},plan);
  Object.assign(level,{target,rule:1});
  LEVELS.push(level);
}
// Short breathers change the task instead of merely relaxing its move limit.
// Keep ids and fixed decks stable; only these changed tasks restart an old run.
for(const [id,kind,target,steps] of [[8,'regions',2,3],[16,'ice',2,4],[20,'regions',3,7],[32,'ice',4,5]]) {
  Object.assign(LEVELS[id],{kind,target,stones:[],solution:LEVELS[id].solution.slice(0,steps),par:steps,rule:7});
}
Object.assign(LEVELS[28],{area:palace(6,6),target:9,solution:LEVELS[28].solution.slice(0,6),par:6,rule:7});
for(const [id,steps] of [[40,7],[44,6]]) {
  const level=LEVELS[id],removed=level.flowers.slice(1);
  level.blocked=level.blocked.filter(([c,r])=>!removed.some(([x,y])=>x===c&&y===r));
  Object.assign(level,{flowers:level.flowers.slice(0,1),target:1,solution:level.solution.slice(0,steps),par:steps,rule:2});
}
const firstPaces=['入门','入门','入门','运用','运用','规划','规划','规划','小憩','运用','规划','综合'];
const laterPaces=['入门','运用','规划','规划','小憩','运用','规划','规划','小憩','运用','规划','综合'];
LEVELS.forEach((level,index)=>{
  level.id=index; level.chapter=Math.floor(index/12); level.rule=level.rule || (index<3?1:2);
  level.pace=(index<12?firstPaces:laterPaces)[index%12];
  // Passing allows experimentation; the original authored budget still earns
  // three stars. Extra fixed pieces only extend the existing deck's tail.
  level.limit=level.par+(index<3 || level.pace==='运用'?3:4);
  while(level.deck.length<Math.ceil(level.limit/3)*3) level.deck.push(['line2H','dot','line2V'][level.deck.length%3]);
});
// Stable IDs belong to saves and links; chapter order belongs to navigation.
for (const definition of require('./challenge-expansion').map(require('../rules/level-data').decode)) {
  LEVELS.push({...definition,id:LEVELS.length,rule:1,holes:[],pace:definition.pace || '进阶'});
}
const CHAPTER_LEVELS=CHAPTERS.map((_,chapter)=>LEVELS.filter(level=>level.chapter===chapter));
let displayNumber=1;
CHAPTER_LEVELS.forEach(levels=>levels.forEach((level,order)=>{
  level.order=order;level.number=displayNumber++;
}));
function chapterLevels(chapter) { return CHAPTER_LEVELS[chapter] || []; }
function nextLevel(id) {
  const level=LEVELS[id];if(!level)return null;
  const next=chapterLevels(level.chapter)[level.order+1] || chapterLevels(level.chapter+1)[0];
  return next ? next.id : null;
}
module.exports = { LEVELS, CHAPTERS, chapterLevels, nextLevel };
