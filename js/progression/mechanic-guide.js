// First encounters teach a rule. Chapter entrances optionally demonstrate it.
const C = require('../challenge/challenges');
const { canPlace } = require('../rules/board');
function create(run, seen, now) {
  if (!run || run.ended) return null;
  const level=C.level(run.level), candidates=[];
  if(run.level===0)candidates.push({id:'basics',cell:[4,4],title:'初入小径 · 填满一行',lines:['拖动下方方块，把一整行填满','整行填满就会消除，先完成这一关']});
  if((run.keys || []).length)candidates.push({id:'keys',cell:run.keys[0],title:'钥匙 · 开启同字机关',lines:['消除钥匙方块，才能打开同字母的门','门开启前，所在行列不能消除；冰先破再消']});
  if(run.flowers.length)candidates.push({id:'flowers',cell:run.flowers[0],title:'花圃 · 邻格浇灌',lines:['在上下左右的格子完成消除','每次浇灌一次，数字归零就开花']});
  if(run.ice.length)candidates.push({id:'ice',cell:run.ice[0],title:'薄冰 · 先破冰再消除',lines:['第一次消除破冰，下面的方块留下',level.kind==='ice'?'本关破冰就计数，不必再清下面的方块':'再次消除方块，才能清掉它的标记']});
  if(run.stones.length)candidates.push({id:'stones',cell:run.stones[0],title:'标记 · 跟着方块消除',lines:['› 才是需要清理的目标','填满所在行、列或九宫；圆石不消除']});
  if(level.area)candidates.push({id:'area',cell:level.area[0],title:'留白 · 清空虚线内',lines:['消除虚线内的所有方块','外面可以留方块，圆石不计入目标']});
  if(level.kind==='cross')candidates.push({id:'cross',cell:[4,4],title:'交汇 · 一手同时完成',lines:['用同一次落子填满行或列与九宫','分别消除不计入这个目标']});
  const preferred=run.level===0?'basics':run.level===24?'stones':(run.keys || []).length?'keys':level.kind==='stones' && run.ice.length?'ice':level.kind;
  const target=candidates.find(item=>item.id===preferred && !(seen && seen[item.id]))
    || candidates.find(item=>!(seen && seen[item.id]));
  return target?{...target,start:now,progress:0}:null;
}
function move(guide, run) {
  if(!guide || !run || run.ended || run.dailyDate || run.invited || run.level<0 || C.level(run.level).order!==0)return null;
  const solution=C.level(run.level).solution;
  // A demonstration is only valid along the authored opening. Never suggest a
  // stale reference move after the player explores a different route.
  if(!run.history.every((step,i)=>solution[i] && step.every((v,j)=>v===solution[i][j])))return null;
  const next=solution[run.history.length];
  if(!next)return null;
  const [slot,c,r]=next,piece=run.tray[slot];
  return piece && canPlace(run.board,piece,c,r)?{slot,c,r}:null;
}
function experienced(guide, run, result, oldProgress) {
  if(!guide)return false;
  switch(guide.id){
    case 'basics': return result.completed.rows.length>0;
    case 'ice': return result.brokenIce.length>0;
    case 'flowers': return result.wateredFlowers.length>0;
    case 'keys': return result.openedGates.length>0;
    case 'stones': return C.level(run.level).kind==='stones' ? run.progress>oldProgress : result.cells.some(p=>p[0]===guide.cell[0]&&p[1]===guide.cell[1])
      && !result.brokenIce.some(p=>p[0]===guide.cell[0]&&p[1]===guide.cell[1]);
    case 'area': return result.cells.some(([c,r])=>C.level(run.level).area.some(p=>p[0]===c&&p[1]===r));
    case 'cross': return result.completed.palaces.length>0 && result.completed.rows.length+result.completed.cols.length>0;
    default: return false;
  }
}
function rects(layout, guide, run) {
  if(guide.collapsed){
    const x=layout.horizontalPadding,width=layout.width-x*2,y=layout.goalY;
    return {panel:{x,y,width,height:44},skip:{x:x+width-56,y,width:56,height:44}};
  }
  const width=Math.min(330,layout.width-40);
  const next=move(guide,run),row=next?next.r:guide.cell[1];
  const rows=next?Math.max(...run.tray[next.slot].cells.map(p=>p[1]))+1:1;
  const above=row*layout.cellSize,below=(9-row-rows)*layout.cellSize;
  const height=Math.min(104,Math.max(above,below)-6);
  const x=(layout.width-width)/2;
  const y=below>=above?layout.boardY+layout.boardHeight-height-3:layout.boardY+3;
  return {panel:{x,y,width,height},skip:{x:x+width-56,y:y+2,width:52,height:44}};
}
module.exports={create,rects,move,experienced};
