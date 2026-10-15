const { SHAPES } = require('../rules/shapes');
const piece = id => SHAPES.find(shape => shape.id === id);
const palace = index => Array.from({ length: 9 }, (_, i) => [index % 3 * 3 + i % 3, Math.floor(index / 3) * 3 + Math.floor(i / 3)]);
const cellsOf = ([id, c, r]) => piece(id).cells.map(([x, y]) => [x + c, y + r]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
// Four weeks of authored daily routes. These work areas and piece partitions are
// independent of the chapter layouts; no random draw or mirrored chapter is used.
const PATTERNS = [
  [['zig4H',0,0],['line2H',0,2]],
  [['zag4H',0,0],['line2V',2,1]],
  [['tee4Left',0,0],['dot',2,0],['dot',2,2]],
  [['corner5A',0,0],['line2H',1,0]],
  [['plus5',0,0],['dot',0,0],['dot',2,2]],
  [['square2',1,1],['line2H',0,0],['dot',0,2]],
  [['tee4Up',0,0],['line2H',0,2]],
  [['corner3A',1,0],['line2H',0,2],['dot',0,0]]
];
const SITES = [[0,4,8],[2,3,7],[1,5,6],[0,5,7]];
const TITLES = [
  ['露珠寻踪','三庭相和','初霜融融','扫叶留白','花信初启','晨光交会','两桥听风'],
  ['寻石问路','错落成景','寒露渐暖','水榭清影','风来花醒','回廊相逢','双溪并流'],
  ['松间拾趣','庭深三叠','薄冰映月','阶前扫雪','一树新蕊','星月相接','长桥卧波'],
  ['月下寻迹','落子有声','霜尽春回','窗前留白','满庭花语','四时交汇','双泉和鸣']
];
function finish(level, plan, index) {
  level.id = -index - 1; level.rule = 1; level.chapter = -1;
  level.deck = []; level.solution = [];
  for (let i = 0; i < plan.length; i += 3) {
    const hand = ['line2H', 'line2V', 'dot'];
    plan.slice(i, i + 3).forEach(([id, c, r], j) => {
      const slot = (j + Math.floor(i / 3) + index) % 3;
      hand[slot] = id; level.solution.push([slot, c, r]);
    });
    level.deck.push(...hand);
  }
  level.par = level.par ?? plan.length; level.limit = level.limit ?? plan.length + 2;
  while (level.deck.length < Math.ceil(level.limit / 3) * 3) level.deck.push(['line2H','line2V','dot'][level.deck.length % 3]);
  return level;
}
function gardens(week, theme) {
  const patterns = [[0,3,5],[1,4,6],[2,0,4],[3,1,7],[4,5,0]][theme];
  const level = { title:TITLES[week][theme], kind:['stones','regions','ice','area','flowers'][theme],
    filled:[], holes:[], stones:[], ice:[], flowers:[], blocked:[] };
  const sites = SITES[week].map((site, i) => {
    const c = site % 3 * 3, r = Math.floor(site / 3) * 3;
    const plan = PATTERNS[(patterns[i] + week) % PATTERNS.length].map(([id,x,y])=>[id,c+x,r+y]);
    const cells = palace(site), holes = plan.flatMap(cellsOf), filled = cells.filter(cell=>!holes.some(hole=>same(cell,hole)));
    level.filled.push(...cells); level.holes.push(...holes);
    if (theme === 0) level.stones.push(filled[filled.length - 1]);
    if (theme === 2 || (theme === 4 && i === 0)) level.ice.push(...filled);
    if (theme === 4) {
      const flower = [[c-1,r+1],[c+3,r+1],[c+1,r-1],[c+1,r+3]].find(([x,y])=>x>=0&&x<9&&y>=0&&y<9
        && !SITES[week].some(site=>palace(site).some(cell=>same(cell,[x,y]))));
      level.flowers.push([...flower, i===0?2:1]); level.blocked.push(flower);
    }
    return plan;
  });
  const plan = [];
  for (let piece = 0; piece < 3; piece++) sites.forEach(site=>{ if(site[piece])plan.push(site[piece]); });
  if (theme === 4) plan.push(...sites[0]);
  if (theme === 3) level.area = SITES[week].flatMap(palace);
  level.target = theme===2?level.ice.length:theme===3?level.area.length:3;
  return finish(level, plan, week * 7 + theme);
}
function crossing(week) {
  const plans = [
    [['line3H',0,4],['line2H',3,3],['line3H',6,4],['line3H',3,4]],
    [['line2H',0,4],['dot',2,4],['line3H',6,4],['plus5',3,3]],
    [['line3H',0,4],['line2H',6,4],['dot',8,4],['tee4Down',3,3]],
    [['line2V',4,0],['dot',4,2],['line3V',4,6],['tee4Right',3,3]]
  ];
  const line = Array.from({length:9},(_,i)=>week===3?[4,i]:[i,4]);
  return finish({title:TITLES[week][5],kind:'cross',target:1,filled:palace(4).concat(line),
    holes:plans[week].flatMap(cellsOf),stones:[],ice:[],flowers:[],blocked:[]},plans[week],week*7+5);
}
function bridges(week) {
  const horizontal = week % 2 === 0, lines = [[0,4],[1,7],[2,6],[0,5]][week];
  const cuts = week<2?[[0,3],[5,2]]:[[1,2],[4,3],[8,1]];
  const plan = [], filled = [];
  lines.forEach(line=>{for(let i=0;i<9;i++)filled.push(horizontal?[i,line]:[line,i]);});
  cuts.forEach(([offset,length])=>lines.forEach(line=>plan.push([length===1?'dot':`line${length}${horizontal?'H':'V'}`,
    horizontal?offset:line,horizontal?line:offset])));
  return finish({title:TITLES[week][6],kind:'regions',target:2,filled,holes:plan.flatMap(cellsOf),
    stones:[],ice:[],flowers:[],blocked:[]},plan,week*7+6);
}
const original = Array.from({length:28},(_,index)=>{
  const week=Math.floor(index/7),theme=index%7;
  return theme<5?gardens(week,theme):theme===5?crossing(week):bridges(week);
});
// Append only: dates, saved attempts and share links keep the original negative IDs.
const weekly = require('./daily-week-one').map(({board,plan,...details},index)=>{
  const filled=[],blocked=[];
  board.forEach((row,r)=>[...row].forEach((cell,c)=>{
    if(cell==='1')filled.push([c,r]);
    if(cell==='2')blocked.push([c,r]);
  }));
  for(const [c,r] of details.flowers || [])if(!blocked.some(([x,y])=>x===c&&y===r))blocked.push([c,r]);
  return finish({stones:[],ice:[],flowers:[],...details,filled,blocked,holes:[]},plan,original.length+index);
});
const advanced=require('./daily-week-two').map((definition,index)=>({
  ...require('../rules/level-data').decode(definition),id:-36-index,chapter:-1,rule:1
}));
module.exports = original.concat(weekly,advanced);
