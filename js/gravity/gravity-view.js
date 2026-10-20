const {roundedRect,text,drawSettingsIcon,pressedRect}=require('../views/canvas-ui');
const {getSettingsButton}=require('../views/panel-view');
const G=require('./gravity-engine');
const {celebration}=require('../views/art');
const dragPlacement=require('../views/drag-placement');
const themes=require('../views/themes');
function rect(x,y,width,height){return {x,y,width,height};}
function layoutFor(layout,demo=false){
 const width=Math.min(342,layout.width-40),x=(layout.width-width)/2,top=layout.settingsY,bottom=layout.height-layout.safeBottom-16;
 const cell=Math.min(width/9,(bottom-top-244)/9),boardSize=cell*9,board=rect((layout.width-boardSize)/2,top+72,boardSize,boardSize);
 const slot=(width-16)/3,trayY=board.y+board.height+12,controlsY=Math.min(bottom-44,trayY+124);
 const buttons={back:rect(12,top,64,44),undo:rect(x,controlsY,slot,44),retry:rect(x+slot+8,controlsY,slot,44),next:rect(x+(slot+8)*2,controlsY,slot,44)};
 if(demo){buttons.retry=rect(x,controlsY,(width-10)/2,44);buttons.next=rect(x+(width+10)/2,controlsY,(width-10)/2,44);}
 return {x,width,top,bottom,cell,board,buttons,placement:{boardX:board.x,boardY:board.y,boardWidth:board.width,boardHeight:board.height,cellSize:cell},trays:(demo?[1]:[0,1,2]).map(i=>rect(x+i*(slot+8),trayY,slot,64)),statusY:trayY+84,
  rules:rect(x,layout.height/2-112,width,224),rulesDemo:rect(x+12,layout.height/2+52,(width-36)/2,48),rulesClose:rect(x+24+(width-36)/2,layout.height/2+52,(width-36)/2,48),
  confirm:rect(x,layout.height/2-82,width,164),cancel:rect(x+12,layout.height/2+18,(width-36)/2,48),accept:rect(x+24+(width-36)/2,layout.height/2+18,(width-36)/2,48)};
}
function panel(ctx,r,color,radius=14){ctx.fillStyle=color;roundedRect(ctx,r.x,r.y,r.width,r.height,radius);ctx.fill();}
function button(ctx,r,label,pressed,id,C,primary=false,enabled=true){
 // Compact navigation visuals keep the existing, larger touch target.
 const p=pressedRect({pressedButton:pressed},id,id==='gravity-back'?{...r,height:32}:r);
 panel(ctx,p,enabled?(primary?C.primary:C.button):C.tray,16);
 text(ctx,label,p.x+p.width/2,p.y+p.height/2+6,13,enabled?(primary?C.onPrimary:C.text):C.muted,'center','600');
}
// Outline each playable 3×3 palace, so its boundary stays legible over occupied cells.
function drawPalaces(ctx, geometry, C, completed = []) {
 ctx.save();ctx.lineWidth=1.4;
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  ctx.strokeStyle=completed.some(([c,r])=>c===col&&r===row)?C.palaceActive:C.palaceLine;
  roundedRect(ctx,geometry.board.x+col*3*geometry.cell+.75,geometry.board.y+row*3*geometry.cell+.75,
   geometry.cell*3-1.5,geometry.cell*3-1.5,8);
  ctx.stroke();
 }
 ctx.restore();
}
function draw(ctx,layout,model,pressed,appearanceId='classic'){
 const C=themes.gravity(appearanceId);
 const run=model.run;if(!run)return;
 const demo=run.mode!=='free',v=layoutFor(layout,demo),center=layout.width/2;
 ctx.clearRect(0,0,layout.width,layout.height);ctx.globalAlpha=1;ctx.fillStyle=C.bg;ctx.fillRect(0,0,layout.width,layout.height);
 button(ctx,v.buttons.back,'‹ 返回',pressed,'gravity-back',C);
 drawSettingsIcon(ctx,pressedRect({pressedButton:pressed},'settings',getSettingsButton(layout)),C.muted);
 ctx.fillStyle=C.text;ctx.font='500 24px serif';ctx.textAlign='center';ctx.fillText('落玉庭',center,v.top+29);
 text(ctx,demo?'玩法演示 · 拖横条补齐底行':`${run.score} 分 · 最长 ${run.chain} 连锁 · 最佳 ${model.best}`,center,v.top+54,12,C.muted);
 if(!demo)button(ctx,v.buttons.undo,run.undoUsed?'撤回已用完':'撤回 · 1 次',pressed,'gravity-undo',C,false,!model.animation&&!run.over&&!run.undoUsed&&Boolean(run.previous));
 button(ctx,v.buttons.retry,demo?'重看演示':run.over?'再来一局':'重新开始',pressed,'gravity-retry',C,!demo&&run.over);
 button(ctx,v.buttons.next,demo?(run.won?'开始游戏':'跳过演示'):run.over?'挑战朋友':'玩法说明',pressed,'gravity-next',C,demo);
 panel(ctx,{x:v.board.x-5,y:v.board.y-5,width:v.board.width+10,height:v.board.height+10},C.edge,16);
 function tile(c,r,fill,alpha=1){ctx.save();ctx.globalAlpha=alpha;panel(ctx,rect(v.board.x+c*v.cell+2,v.board.y+r*v.cell+2,v.cell-4,v.cell-4),fill,Math.min(7,v.cell/5));ctx.restore();}
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)tile(c,r,(Math.floor(r/3)+Math.floor(c/3))%2?C.empty:C.alt);
 const frame=model.animation&&model.animation.frames[model.animation.index],t=frame?model.animation.progress:1,board=frame?frame.before:run.board;
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(board[r][c]){
  if(frame&&frame.kind==='fall'&&frame.movements.some(m=>m.c===c&&m.from===r))continue;
  tile(c,r,C.block,frame&&frame.kind==='clear'&&!frame.after[r][c]?1-t:1);
 }
 if(frame&&frame.kind==='fall')frame.movements.forEach(m=>tile(m.c,m.from+(m.to-m.from)*(1-(1-t)**2),C.block));
 const drag=model.drag;
 if(drag&&drag.target&&drag.preview){
  const {col,row}=drag.target;
  dragPlacement.drawLanding(ctx,v.placement,drag.shape.cells.map(([dx,dy])=>[col+dx,row+dy]),C.block);
  const regions=drag.preview.regions,cells=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(regions.rows.includes(y)||regions.cols.includes(x)||regions.palaces.some(([pc,pr])=>Math.floor(x/3)===pc&&Math.floor(y/3)===pr))cells.push([x,y]);
  dragPlacement.drawLanding(ctx,v.placement,cells,C.clearGlow,.6);
 }
 drawPalaces(ctx,v,C,drag&&drag.preview?drag.preview.regions.palaces:[]);
 v.trays.forEach((box,i)=>{
  panel(ctx,box,model.drag&&model.drag.slot===i?C.selected:C.tray,16);const id=run.tray[i];if(!id||(drag&&drag.slot===i))return;
  const unavailable=!model.animation&&model.unavailableTray&&model.unavailableTray[i];
  const areaHeight=unavailable?44:box.height;
  const shape=G.shape(id),w=Math.max(...shape.cells.map(p=>p[0]))+1,h=Math.max(...shape.cells.map(p=>p[1]))+1,size=Math.min(17,(box.width-12)/w,Math.min(48,areaHeight-8)/h);
  shape.cells.forEach(([c,r])=>panel(ctx,rect(box.x+(box.width-w*size)/2+c*size,box.y+(areaHeight-h*size)/2+r*size,size-2,size-2),unavailable?C.unavailable:C.piece,4));
  if(unavailable)text(ctx,'暂时无处可放',box.x+box.width/2,box.y+57,10,C.unavailable);
 });
 const message=model.message || (run.won?'消除 → 下落 → 再次消除':run.over?'方块都放不下了 · 本局结束':model.animation?`第 ${frame.wave} 次${frame.kind==='fall'?'下落':'消除'}`:drag?drag.preview?(drag.preview.falls?'松手消除，随后下落':'松手放置'):'请移到完整空位':demo?'方向固定，拖到框出的空位':'填满行、列或 3×3，消除后下落');
 text(ctx,message,center,v.statusY,12,C.text);
 if(model.savePending)text(ctx,'进度待保存，请稍候再退出',center,v.statusY+16,10,C.muted);
 else if(demo)text(ctx,'演示不计分，随时可跳过',center,v.statusY+16,10,C.muted);
 else if(run.over)text(ctx,`本局回顾 · ${run.steps} 次落子 · 最长 ${run.chain} 连锁`,center,v.statusY+16,10,C.muted);
 if(demo&&!run.steps&&!model.animation){
  const cells=G.shape(run.tray[0]).cells.map(([c,r])=>[c+3,r+8]);
  dragPlacement.drawLanding(ctx,v.placement,cells,C.primary,.3);
 }
 dragPlacement.drawHeld(ctx,v.cell,drag,C.piece);
 if(run.won || run.over)celebration(ctx,{x:v.board.x-8,y:v.board.y,width:v.board.width+16,height:v.board.height},model.resultProgress,true);
 if(model.rulesOpen){
  ctx.fillStyle='rgba(35,48,38,.45)';ctx.fillRect(0,0,layout.width,layout.height);panel(ctx,v.rules,C.panel);
  text(ctx,'落玉庭怎么玩',center,v.rules.y+36,19,C.text,'center','600');
  text(ctx,'填满行、列或 3×3 九宫即可消除',center,v.rules.y+72,12,C.text);
  text(ctx,'消除后下落，落稳后可能再次消除',center,v.rules.y+99,12,C.text);
  text(ctx,'普通落子不下落 · 全放不下时结束',center,v.rules.y+126,12,C.muted);
  text(ctx,'挑战高分和连锁 · 不进入庭院榜',center,v.rules.y+149,11,C.muted);
  button(ctx,v.rulesDemo,'看一次演示',pressed,'gravity-demo',C);
  button(ctx,v.rulesClose,'知道了',pressed,'gravity-rules-close',C,true);
 }
 if(model.confirmRestart){
  ctx.fillStyle='rgba(35,48,38,.45)';ctx.fillRect(0,0,layout.width,layout.height);panel(ctx,v.confirm,C.panel);
  text(ctx,'重新开始这一局？',center,v.confirm.y+35,18,C.text,'center','600');text(ctx,'本局进度将重置，撤回恢复为 1 次',center,v.confirm.y+63,11,C.muted);
  button(ctx,v.cancel,'继续这一局',pressed,'gravity-cancel',C);button(ctx,v.accept,'重新开始',pressed,'gravity-accept',C,true);
 }
}
module.exports={layoutFor,draw};
