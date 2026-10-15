const G=require('./js/gravity/gravity-engine'),canvas=document.querySelector('#board'),ctx=canvas.getContext('2d');
ctx.scale(2,2);
const selector=document.querySelector('#mode'),status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state,selected=0,gesture=null,animation=null,frameId=0;
const cell=36,left=18,top=14,trayY=410;
const key=mode=>'fangcunGravityPreviewV1:'+mode;
G.PUZZLES.forEach(p=>selector.add(new Option(`${p.id+1}. ${p.title}`,String(p.id))));selector.add(new Option('自由试验局','free'));
function persist(){try{localStorage.setItem(key(state.mode),JSON.stringify(G.save(state)));document.querySelector('#storage').textContent='';}catch(error){console.warn('[gravity-preview] save failed',error);document.querySelector('#storage').textContent='预览进度未保存，请保持页面打开。';}}
function open(mode,reset=false){
 cancelAnimation();gesture=null;selected=0;
 let stored=null;try{stored=reset?null:JSON.parse(localStorage.getItem(key(mode)));}catch(error){console.warn('[gravity-preview] read failed',error);}
 state=G.restore(stored);if(!state || state.mode!==mode)state=G.start(mode);
 selector.value=String(mode);
 try{localStorage.setItem('fangcunGravityPreviewModeV1',JSON.stringify(mode));}catch(error){console.warn('[gravity-preview] mode save failed',error);}
 update();
}
function cancelAnimation(){cancelAnimationFrame(frameId);frameId=0;animation=null;}
function round(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function tile(c,r,color='#7eaa91',alpha=1){ctx.save();ctx.globalAlpha=alpha;round(left+c*cell+2,top+r*cell+2,cell-4,cell-4,7,color);ctx.restore();}
function draw(now=0){
 ctx.clearRect(0,0,360,490);round(left-5,top-5,334,334,16,'#dce2d2');
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)tile(c,r,(Math.floor(c/3)+Math.floor(r/3))%2?'#edf0e3':'#f6f5e9');
 let board=state.board,frame=null,t=1;
 if(animation){frame=animation.frames[animation.index];t=Math.min(1,Math.max(0,(now-animation.start)/(frame.kind==='clear'?200:300)));board=frame.before;}
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(board[r][c]){
  if(frame && frame.kind==='fall' && frame.movements.some(m=>m.c===c&&m.from===r))continue;
  const alpha=frame&&frame.kind==='clear'&&!frame.after[r][c]?1-t:1;tile(c,r,'#7eaa91',alpha);
 }
 if(frame && frame.kind==='fall')frame.movements.forEach(m=>tile(m.c,m.from+(m.to-m.from)*(1-(1-t)**2)));
 if(gesture && gesture.target){const {c,r}=gesture.target,piece=G.shape(state.tray[selected]);if(piece)piece.cells.forEach(([dx,dy])=>{if(c+dx>=0&&c+dx<9&&r+dy>=0&&r+dy<9)tile(c+dx,r+dy,gesture.valid?'#bd9f65':'#bd7770',.65);});}
 ctx.fillStyle='#718272';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('拖动方块，或点选后点击落点',180,365);
 state.tray.forEach((id,i)=>{round(7+i*118,381,110,92,16,i===selected?'#e2e8d7':'#f0f0e7');if(!id)return;const piece=G.shape(id),w=Math.max(...piece.cells.map(c=>c[0]))+1,h=Math.max(...piece.cells.map(c=>c[1]))+1,size=Math.min(19,75/w,70/h);piece.cells.forEach(([x,y])=>round(62+i*118-w*size/2+x*size,trayY-h*size/2+y*size+14,size-2,size-2,4,'#6c9b83'));});
 if(animation){if(t===1){animation.index++;animation.start=now;if(animation.index===animation.frames.length){animation=null;update();return;}}
 frameId=requestAnimationFrame(draw);}
}
function update(message){
 const p=state.mode==='free'?null:G.PUZZLES[state.mode];
 document.querySelector('#metrics').textContent=`${state.steps} 步 · 消除 ${state.clears} 处 · 最长 ${state.chain} 连锁 · ${state.score} 分`;
 status.textContent=message || (state.won?'体验完成！可以重玩、撤回观察，或试试下一题。':state.over?'当前方块都放不下了。本局结束，可以重新开始。':p?`${p.description} 目标：消除 ${p.goal.clears} 处，至少 ${p.goal.chain} 连锁并触发下落。`:'自由试验：尽量腾出空间，试着触发连续消除。');
 const undo=document.querySelector('#undo');undo.textContent=state.undoUsed?'撤回 · 已用完':'撤回 · 1 次';undo.disabled=Boolean(animation)||state.over||state.undoUsed||!state.previous;
 document.querySelector('#next').hidden=!state.won;draw();
}
function position(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*360/rect.width,y:(event.clientY-rect.top)*490/rect.height};}
function target(p,drag){const piece=G.shape(state.tray[selected]);if(!piece)return null;const w=Math.max(...piece.cells.map(c=>c[0]))+1,h=Math.max(...piece.cells.map(c=>c[1]))+1;return {c:Math.floor((p.x-left)/cell-(drag?(w-1)/2:0)),r:Math.floor((p.y-top-(drag?38:0))/cell-(drag?(h-1)/2:0))};}
function track(p){gesture.target=target(p,gesture.fromTray);const t=gesture.target;gesture.valid=Boolean(t && G.canPlay(state,selected,t.c,t.r));if(!animation)draw();}
canvas.addEventListener('pointerdown',e=>{
 if(gesture||animation||state.won||state.over)return;const p=position(e);let fromTray=p.y>=381;
 if(fromTray){const slot=Math.floor(p.x/118);if(slot<0||slot>2||!state.tray[slot])return;selected=slot;}
 else if(p.x<left||p.x>=left+324||p.y<top||p.y>=top+324)return;
 gesture={id:e.pointerId,fromTray,start:p,target:null,valid:false};canvas.setPointerCapture(e.pointerId);if(!fromTray)track(p);else draw();
});
canvas.addEventListener('pointermove',e=>{if(gesture&&gesture.id===e.pointerId)track(position(e));});
canvas.addEventListener('pointerup',e=>{
 if(!gesture||gesture.id!==e.pointerId)return;const p=position(e),g=gesture;gesture=null;
 if(g.fromTray&&Math.hypot(p.x-g.start.x,p.y-g.start.y)<8){update('已选方块：点击棋盘落点，或按住方块拖动。');return;}
 const t=target(p,g.fromTray),result=t&&G.play(state,selected,t.c,t.r);
 if(!result){update('这里放不下，请换一处完整空位。');return;}
 state=result.state;persist();selected=state.tray.findIndex(Boolean);
 if(result.frames.length&&!reduced.matches){animation={frames:result.frames,index:0,start:performance.now()};document.querySelector('#undo').disabled=true;status.textContent='玉块正在落稳，随后检查连锁…';frameId=requestAnimationFrame(draw);}
 else update();
});
function cancelGesture(e){if(!gesture || e&&gesture.id!==e.pointerId)return;gesture=null;draw();}
canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',cancelGesture);
selector.addEventListener('change',()=>open(selector.value==='free'?'free':Number(selector.value)));
document.querySelector('#retry').onclick=()=>{open(state.mode,true);persist();};
document.querySelector('#undo').onclick=()=>{if(animation)return;const restored=G.undo(state);if(restored){state=restored;gesture=null;persist();update('已恢复落子前的棋盘、分数和发牌，连锁一并撤回。');}};
document.querySelector('#next').onclick=()=>open(state.mode===5?'free':state.mode+1);
document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;cancelAnimation();update();}});
let lastMode=0;
try{const mode=JSON.parse(localStorage.getItem('fangcunGravityPreviewModeV1'));if(mode==='free'||Number.isInteger(mode)&&G.PUZZLES[mode])lastMode=mode;}catch(error){console.warn('[gravity-preview] mode read failed',error);}
open(lastMode);
