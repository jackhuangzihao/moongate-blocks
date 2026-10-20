// Fast creator-style trailer. Only generated files in this directory are written.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {spawn}=require('child_process'),{once}=require('events');
const deps=process.env.CODEX_VIDEO_DEPS||'/Users/huangzihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {createCanvas,GlobalFonts}=require(path.join(deps,'@napi-rs/canvas'));
const root=path.resolve(__dirname,'../../..');
const B=require(root+'/js/rules/board'),G=require(root+'/js/gravity/gravity-engine');
const C=require(root+'/js/challenge/challenges'),{SHAPES}=require(root+'/js/rules/shapes');
const config=require(root+'/js/config'),boardView=require(root+'/js/views/board-view');
const gravityView=require(root+'/js/gravity/gravity-view');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','VideoSans');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc','VideoSerif');
const W=1080,H=1920,FPS=60,DURATION=18;
const green={...config.COLORS},blue={...green,panel:'#FFFFFF',text:'#263E6A',block:'#7999D9',emptyCell:'#DEE5F3',boardEdge:'#BECBEA',palaceLine:'#ACBCD7'};
const copy=x=>JSON.parse(JSON.stringify(x)),clamp=x=>Math.max(0,Math.min(1,x));
const out=x=>1-(1-clamp(x))**3,lerp=(a,b,t)=>a+(b-a)*t;
const audioEvents=[];
function sound(time,id,gain=.65,rate=1){audioEvents.push({time,id,gain,rate});}
function rr(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=2;c.strokeStyle=stroke;c.stroke();}}
function text(c,s,x,y,size=36,color='#344E41',align='left',bold=false){
  c.font=`${bold?'900':'400'} ${size}px VideoSans`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';
  const width=c.measureText(s).width;
  assert(align!=='left'||x+width<=c.canvas.width-60,`Text exceeds safe width: ${s}`);
  c.fillText(s,x,y);
}
function bg(c,kind='green'){
  c.globalAlpha=1;c.fillStyle=kind==='blue'?'#EAF0FC':kind==='gold'?'#F7F3E5':'#F3F1E8';c.fillRect(0,0,W,H);
  c.fillStyle=kind==='blue'?'#DCE6FA':'#E6E9DA';c.beginPath();c.arc(1040,130,390,0,Math.PI*2);c.fill();
}
function badge(c,label,x,y,fill='#344E41',color='#FFF',size=26){
  c.font=`400 ${size}px VideoSans`;const w=c.measureText(label).width+36;
  rr(c,x,y-34,w,49,24,fill);text(c,label,x+18,y,size,color);return w;
}
function top(c,active){
  text(c,'方寸九宫',72,145,29,'#344E41','left',true);
  text(c,'独立开发日记',1008,145,26,'#697163','right');
  const entries=[['自由消除','garden'],['目标闯关','challenge'],['＋ 落玉庭连锁','gravity']];
  let x=72;
  for(const [label,key]of entries){x+=badge(c,label,x,232,key===active?(key==='challenge'?'#354FBE':'#344E41'):'#E2E5DA',key===active?'#FFF':'#64705F',28)+14;}
}
function title(c,a,b,local,mode='green',size=92){
  const p=out(local/.15),col=mode==='blue'?'#263E6A':'#344E41';
  c.save();c.translate((1-p)*36,0);c.globalAlpha=p;
  text(c,a,72,370,size,col,'left',true);text(c,b,72,482,size,col,'left',true);c.restore();
}
function sub(c,s,y=1705,kind='green'){
  c.font='400 33px VideoSans';const width=c.measureText(s).width+72;
  rr(c,(W-width)/2,y-48,width,77,38,kind==='blue'?'#FFF':'#FFFFFFCF');text(c,s,W/2,y+3,33,kind==='blue'?'#263E6A':'#344E41','center');
}
const BOARD={x:99,y:624,w:882,cell:98};
function drawBoard(c,board,mode='green',challenge=null){
  Object.assign(config.COLORS,mode==='blue'?blue:green);
  const {x,y,w}=BOARD;c.save();c.translate(x,y);c.scale(w/324,w/324);
  boardView.drawBoard(c,{boardX:0,boardY:0,boardWidth:324,boardHeight:324,cellSize:36},
    {mode:'easy',board,challenge,energyPalaces:[],piecesPlaced:1,clearingCells:[]});c.restore();
}
function piece(c,shape,x,y,size,col){for(const [a,b]of shape.cells)rr(c,x+a*size+4,y+b*size+4,size-8,size-8,size*.12,col);}
function pulse(c,t,land,fn){
  const dt=t-land,amount=dt>=0&&dt<.2?Math.sin(dt/.2*Math.PI)*.018:0;
  c.save();c.translate(540,1065);c.scale(1+amount,1+amount);c.translate(-540,-1065);fn();c.restore();
}
function clearedCells(before,after){const cells=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(before[r][c]===1&&after[r][c]!==1)cells.push([c,r]);return cells;}
function burst(c,cells,t,color='#C4A15B'){
  if(t<0||t>.46)return;const p=clamp(t/.46),{x,y,cell}=BOARD;
  c.save();
  for(let i=0;i<cells.length;i++){
    const [a,b]=cells[i],cx=x+(a+.5)*cell,cy=y+(b+.5)*cell;
    if(p<.6){c.globalAlpha=(1-p/.6)*.9;rr(c,cx-cell/2+4,cy-cell/2+4,cell-8,cell-8,13,'#FFE2A0');}
    c.globalAlpha=(1-p)*.85;
    for(let n=0;n<4;n++){
      const angle=n*Math.PI/2+i*.71,dist=18+p*(54+i%4*10),size=(8+i%3*3)*(1-p);
      rr(c,cx+Math.cos(angle)*dist-size/2,cy+Math.sin(angle)*dist-p*32-size/2,size,size,2,color);
    }
  }
  c.restore();
}
function labelPop(c,s,t,x=540,y=1130,color='#344E41'){
  if(t<0||t>.75)return;
  const p=out(t/.12),a=clamp((.75-t)/.19);
  c.save();c.globalAlpha=a;c.translate(x,y-16*clamp(t/.7));c.scale(.82+.18*p,.82+.18*p);
  c.font='900 68px VideoSans';const width=c.measureText(s).width+66;
  rr(c,-width/2,-73,width,110,28,'#FFF4D8',color);text(c,s,0,4,68,color,'center',true);c.restore();
}
function movePiece(c,shape,target,t,start,land,color,slot=0){
  const {x,y,cell}=BOARD,from=[150+slot*300,1560],to=[x+target[0]*cell,y+target[1]*cell];
  if(t<start){piece(c,shape,...from,64,color);return;}
  if(t>=land)return;
  const p=out((t-start)/(land-start)),size=lerp(64,cell,p);
  c.save();c.globalAlpha=.22;piece(c,shape,...to,cell,color);c.restore();
  c.save();c.shadowColor='#344E4130';c.shadowBlur=20;c.shadowOffsetY=9;
  piece(c,shape,lerp(from[0],to[0],p),lerp(from[1],to[1],p)-Math.sin(p*Math.PI)*60,size,color);c.restore();
}

// Three legal doubles on a prepared, initially settled garden board.
let gardenBoard=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>Number(r%3!==Math.floor(c/3))));
assert.deepStrictEqual(B.findCompletedRegions(gardenBoard),{rows:[],cols:[],palaces:[]});
const gardenInitial=copy(gardenBoard),gardenMoves=[];
const line=SHAPES.find(s=>s.id==='line3H');
for(const [col,row,land]of[[0,0,2.48],[3,4,3.48],[6,8,4.48]]){
  const before=copy(gardenBoard);assert(B.canPlace(gardenBoard,line,col,row));B.placeShape(gardenBoard,line,col,row);
  const full=copy(gardenBoard),regions=B.findCompletedRegions(gardenBoard);B.clearCompletedRegions(gardenBoard,regions);
  const cells=clearedCells(full,gardenBoard);assert.equal(regions.rows.length+regions.palaces.length,2);
  gardenMoves.push({shape:line,target:[col,row],before,full,after:copy(gardenBoard),cells,land,start:land-.34,regions});
  sound(land,'combo',.72,1+(land-2.48)*.04);
}
// Select a genuine fourth clearing move from the remaining position.
let fourth=null;
for(const shape of SHAPES)for(let r=0;r<9;r++)for(let c=0;c<9;c++){
  if(fourth||!B.canPlace(gardenBoard,shape,c,r))continue;
  const full=copy(gardenBoard);B.placeShape(full,shape,c,r);const regions=B.findCompletedRegions(full);
  if(!regions.rows.length&&!regions.cols.length&&!regions.palaces.length)continue;
  const after=copy(full);B.clearCompletedRegions(after,regions);
  fourth={shape,target:[c,r],before:copy(gardenBoard),full,after,cells:clearedCells(full,after),land:5.45,start:5.12,regions};
}
if(fourth){gardenMoves.push(fourth);sound(5.45,'clear',.7,1.12);}
function garden(c,t){
  bg(c);top(c,'garden');title(c,'我做了两个模式。','先来，自由消除。',t-2,'green',83);
  text(c,'不限时，填满行、列或九宫就消除',72,560,31,'#64705F');
  let current=gardenInitial,active=null;
  for(const m of gardenMoves){if(t<m.land)break;current=m.after;if(t<m.land+.46)active=m;}
  pulse(c,t,active?active.land:-10,()=>drawBoard(c,current));
  for(const m of gardenMoves){
    if(t>=m.start-.3&&t<m.land)movePiece(c,m.shape,m.target,t,m.start,m.land,green.block,Math.min(gardenMoves.indexOf(m),2));
    burst(c,m.cells,t-m.land);if(t>=m.land)labelPop(c,'消！',t-m.land,740,Math.max(840,BOARD.y+m.target[1]*98-35));
  }
  sub(c,'想放松，就自由消除。');
}

function challengeClip(id,lands,start,preplay=0){
  let run=C.start(id);for(const m of C.level(id).solution.slice(0,preplay))assert(C.play(run,...m));
  const initial=copy(run),moves=[];
  C.level(id).solution.slice(preplay).forEach((move,i)=>{
    const before=copy(run),shape=copy(run.tray[move[0]]),full=copy(run.board);B.placeShape(full,shape,move[1],move[2]);
    const result=C.play(run,...move);assert(result);
    const land=lands[i];assert(Number.isFinite(land));
    moves.push({before,shape,full,result,after:copy(run),land,start:land-.30,target:move.slice(1),slot:move[0]});
    sound(land,result.count?'combo':'place',result.count?.72:.5,1+i*.045);
    if(result.bloomedFlowers?.length||result.wateredFlowers.some(f=>f[2]===0))sound(land+.1,'bloom',.65);
  });
  assert(run.won);return{id,initial,moves,start,level:C.level(id)};
}
const cross=challengeClip(3,[6.53,7.23],6);
assert.equal(C.stars(cross.moves.at(-1).after),3);
const flower=challengeClip(36,[8.52,8.99,9.45],8.1,1);
function challenge(c,t){
  const clip=t<8.1?cross:flower;bg(c,'blue');top(c,'challenge');
  title(c,t<8.1?'另一个是目标闯关。':'这一关，',t<8.1?'每一步，都有目标。':'试着让花开。',t-clip.start,'blue',83);
  let current=clip.initial,active=null;
  for(const m of clip.moves){if(t<m.land)break;current=m.after;if(t<m.land+.42)active=m;}
  text(c,`第 ${clip.level.number} 关 · ${clip.level.title}`,72,560,30,'#263E6A');
  text(c,`${Math.max(0,clip.level.limit-current.history.length)} 步`,1008,560,29,'#354FBE','right');
  pulse(c,t,active?active.land:-10,()=>drawBoard(c,current.board,'blue',current));
  for(const m of clip.moves){
    if(t>=m.start-.15&&t<m.land)movePiece(c,m.shape,m.target,t,m.start,m.land,blue.block,m.slot);
    burst(c,m.result.cells,t-m.land,'#B99B54');
    if(m.after.won)labelPop(c,clip.id===3?'双消 · 三星':'开花了！',t-m.land,540,1080,'#354FBE');
  }
  sub(c,clip.id===3?'想动脑，就解一道消除题。':'清除、浇灌，让花圃开花。',1705,'blue');
}

const denseBoard=[[1,1,1,1,0,1,1,1,0],[1,1,1,1,1,0,0,1,1],[0,1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,0,1],[1,1,0,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,0],[1,0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0],[0,1,1,1,1,0,1,1,1]];
const settled=B.findCompletedRegions(denseBoard);assert(!settled.rows.length&&!settled.cols.length&&!settled.palaces.length);
function gravityClip(id,start,land,kind){
  let before=G.start(id==='dense'?'free':id);
  let move;
  if(id==='dense'){before.board=copy(denseBoard);before.tray=['dot','line3H','square2'];move=[0,8,5];}
  else move=G.PUZZLES[id].solution[0];
  assert(G.canPlay(before,...move));const result=G.play(before,...move);assert(result&&result.state.chain===2);
  let cursor=land;
  const frames=result.frames.map(f=>{const duration=f.kind==='fall'?.44:.20;const timed={...f,start:cursor,end:cursor+duration};cursor+=duration;
    if(f.kind==='clear')sound(timed.start,f.wave===1?'clear':'combo',.83,f.wave===1?1:1.16);
    else sound(timed.start,'fall',.34);
    return timed;});
  return{before,after:result.state,shape:G.shape(before.tray[move[0]]),target:move.slice(1),slot:move[0],frames,start,land,kind,id};
}
const opening=gravityClip('dense',0,.43,'teaser');
const gravityClips=[gravityClip(2,10,10.52,'lesson'),gravityClip('dense',12,12.52,'dense'),gravityClip(3,14,14.52,'layers')];
const sourceCanvas=createCanvas(1170,2532),sourceCtx=sourceCanvas.getContext('2d');
sourceCtx.scale(3,3);
const sourceLayout={width:390,height:844,settingsY:70,safeBottom:30};
function gravityBoard(c,clip,t){
  const f=clip.frames.find(f=>t>=f.start&&t<f.end),past=t>=clip.frames.at(-1).end;
  const state=t<clip.land?clip.before:clip.after;
  const model={run:state,best:0,drag:null,animation:f?{frames:clip.frames,index:clip.frames.indexOf(f),progress:clamp((t-f.start)/(f.end-f.start))}:null};
  // The production gravity view owns the fall interpolation and palace outlines.
  gravityView.draw(sourceCtx,sourceLayout,model,null);
  const geometry=gravityView.layoutFor(sourceLayout,state.mode!=='free');
  const {x,y,width,height}=geometry.board;
  pulse(c,t,f&&f.kind==='clear'?f.start:-10,()=>c.drawImage(sourceCanvas,(x-5)*3,(y-5)*3,(width+10)*3,(height+10)*3,BOARD.x-13,BOARD.y-13,BOARD.w+26,BOARD.w+26));
  if(t<clip.land)movePiece(c,clip.shape,clip.target,t,clip.land-.30,clip.land,'#7EAA91',1);
  let latest=null;
  for(const frame of clip.frames)if(frame.kind==='clear'){
    const cells=clearedCells(frame.before,frame.after);burst(c,cells,t-frame.start);
    if(t>=frame.start)latest=frame;
  }
  if(latest){labelPop(c,latest.wave===1?'消除！':'连锁 × 2',t-latest.start,540,1580);}
  return{frame:f,past,latest};
}
function gravity(c,t,teaser=false){
  const clip=teaser?opening:gravityClips.findLast(k=>t>=k.start)||gravityClips[0];
  bg(c,'gold');top(c,'gravity');
  if(teaser){title(c,'我做了个小游戏。','一块下去，连着消。',t,'green',83);}
  else title(c,'我还加了','落玉庭 · 下落连锁。',t-10,'green',83);
  text(c,teaser?'先给你看一手下落连锁':'消除 → 下落 → 再消除',72,560,32,'#706347');
  gravityBoard(c,clip,t);
  if(!teaser){
    const stage=t<12?'消除以后，玉块才会落下。':t<14?'落稳，再接着消！':'这一手，还没结束。';sub(c,stage);
    const x=74,y=1801,width=932,p=clamp((t-10)/6);rr(c,x,y,width,7,3,'#D9D6C7');rr(c,x,y,width*p,7,3,'#9C8046');
  }else sub(c,'这是我做的《方寸九宫》。');
}
function ending(c,t){
  bg(c);const p=out((t-16)/.16);
  c.save();c.translate(0,30*(1-p));c.globalAlpha=p;
  text(c,'这是我做的',72,328,61,'#64705F');text(c,'方寸九宫',65,498,144,'#344E41','left',true);
  text(c,'想请你来，消一局。',72,610,52,'#344E41');
  const xs=[72,394,716];
  const labels=['自由消除','目标闯关','落玉庭连锁'];
  [gardenInitial,cross.initial.board,opening.before.board].forEach((b,i)=>{
    const tile=createCanvas(1080,1920),tc=tile.getContext('2d');
    if(i===2)gravityBoard(tc,opening,0);else drawBoard(tc,b,i===1?'blue':'green',i===1?cross.initial:null);
    c.drawImage(tile,86,611,908,908,xs[i],805,292,292);text(c,labels[i],xs[i]+146,1156,33,'#344E41','center',true);
  });
  badge(c,'两个主模式',72,1288,'#344E41','#FFF',30);
  text(c,'自由消除 ＋ 目标闯关',72,1391,42,'#344E41','left',true);
  text(c,'还有「落玉庭」下落连锁',72,1465,39,'#697163');
  rr(c,72,1590,936,104,52,'#344E41');text(c,'微信小游戏 · 方寸九宫',540,1656,39,'#FFF','center',true);
  c.restore();
}

const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
function frame(t){
  if(t<2)gravity(ctx,t,true);else if(t<6)garden(ctx,t);else if(t<10)challenge(ctx,t);else if(t<16)gravity(ctx,t);else ending(ctx,t);
  return canvas;
}
function writePreviews(){
  const dir=path.join(__dirname,'制作预览');fs.mkdirSync(dir,{recursive:true});
  const times=[.2,.54,.85,1.15,2.5,3.5,4.5,6.6,7.3,8.6,9.5,10.8,11.15,12.9,13.2,14.9,15.2,17];
  const outCanvas=createCanvas(1620,Math.ceil(times.length/6)*524),c=outCanvas.getContext('2d');c.fillStyle='#E3E4DC';c.fillRect(0,0,outCanvas.width,outCanvas.height);
  for(let i=0;i<times.length;i++){
    frame(times[i]);const x=i%6*270,y=Math.floor(i/6)*524;c.drawImage(canvas,x,y,270,480);text(c,`${times[i]}s`,x+12,y+510,20);
  }
  fs.writeFileSync(path.join(__dirname,'分镜预览.jpg'),outCanvas.toBuffer('image/jpeg',92));
  for(const t of[.85,3.5,7.3,9.5,11.15,13.2,17])fs.writeFileSync(path.join(dir,`${t}s.png`),frame(t).toBuffer('image/png'));
  const cover=createCanvas(1080,1440),cc=cover.getContext('2d');bg(cc);text(cc,'独立开发日记',72,140,31,'#64705F');
  text(cc,'我做了个',67,330,116,'#344E41','left',true);text(cc,'越消越上头的',67,469,116,'#344E41','left',true);text(cc,'小游戏。',67,608,116,'#344E41','left',true);
  const b=createCanvas(W,H);gravityBoard(b.getContext('2d'),opening,.80);
  cc.drawImage(b,86,611,908,908,211,699,658,658);
  rr(cc,72,1270,936,100,50,'#344E41');text(cc,'双模式 ＋ 下落连锁｜方寸九宫',540,1336,38,'#FFF','center',true);
  fs.writeFileSync(path.join(__dirname,'方寸九宫-v2-小红书封面.png'),cover.toBuffer('image/png'));
}
function makeFallSound(){
  const rate=48000,n=rate*.19,buffer=Buffer.alloc(44+n*2);
  buffer.write('RIFF');buffer.writeUInt32LE(36+n*2,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);
  let random=1701,filtered=0;
  for(let i=0;i<n;i++){const t=i/rate;random=(Math.imul(random,1664525)+1013904223)>>>0;filtered=.86*filtered+.14*(random/4294967296*2-1);
    const envelope=Math.sin(Math.PI*i/n)**1.6;const value=(filtered*.38+Math.sin(2*Math.PI*(370*t-530*t*t))*.04)*envelope;
    buffer.writeInt16LE(Math.round(value*32767),44+i*2);}
  fs.writeFileSync(path.join(__dirname,'制作预览','fall.wav'),buffer);
}
async function render(){
  const silent=path.join(__dirname,'制作预览','画面.mp4');
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',`${W}x${H}`,'-r',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','inherit','inherit']});
  ff.stdin.on('error',e=>{if(e.code!=='EPIPE')throw e;});const done=once(ff,'close');
  for(let f=0;f<FPS*DURATION;f++){if(!ff.stdin.write(frame(f/FPS).data()))await once(ff.stdin,'drain');if(f%180===0)console.log(`Rendered ${f}/${FPS*DURATION}`);}
  ff.stdin.end();assert.equal((await done)[0],0);
  const effects=[...new Set(audioEvents.map(e=>e.id))];
  const effectFiles=effects.map(id=>id==='fall'?path.join(__dirname,'制作预览','fall.wav'):path.join(root,'assets/audio',id+'.wav'));
  const filters=['[1:a]atempo=1.0714285714,volume=0.70,atrim=0:18,afade=t=out:st=17.5:d=0.5[music]'];
  effects.forEach((id,i)=>{const uses=audioEvents.filter(e=>e.id===id);filters.push(`[${i+2}:a]asplit=${uses.length}`+uses.map((_,j)=>`[s${i}_${j}]`).join(''));
    uses.forEach((e,j)=>filters.push(`[s${i}_${j}]aresample=48000,asetrate=${Math.round(48000*e.rate)},aresample=48000,volume=${e.gain},adelay=${Math.round(e.time*1000)}:all=1[e${audioEvents.indexOf(e)}]`));});
  filters.push('[music]'+audioEvents.map((_,i)=>`[e${i}]`).join('')+`amix=inputs=${audioEvents.length+1}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.2:LRA=7,afade=t=out:st=17.7:d=0.3[a]`);
  const target=path.join(__dirname,'方寸九宫-v2-独立开发者爽感版.mp4');
  const mix=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',silent,'-i',root+'/assets/audio/bgm-v2.wav',...effectFiles.flatMap(f=>['-i',f]),'-filter_complex',filters.join(';'),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','18','-movflags','+faststart','-metadata','title=我做了个消除小游戏｜方寸九宫',target],{stdio:'inherit'});
  assert.equal((await once(mix,'close'))[0],0);fs.unlinkSync(silent);console.log('Finished:',target);
}
const files=['js/config.js','js/rules/board.js','js/challenge/challenges.js','js/views/board-view.js','js/gravity/gravity-engine.js','js/gravity/gravity-view.js'];
fs.mkdirSync(__dirname,{recursive:true});writePreviews();makeFallSound();
fs.writeFileSync(path.join(__dirname,'制作记录.json'),JSON.stringify({width:W,height:H,fps:FPS,seconds:DURATION,firstClearSeconds:.43,
  modes:['自由消除','目标闯关'],extraGameplay:'落玉庭下落连锁',voice:'第一人称画面字幕；无合成口播',
  scenes:[{from:0,to:2,content:'开发者自述＋高密度重力连锁钩子'},{from:2,to:6,content:'自由消除，连续合法落子'},{from:6,to:10,content:'目标闯关，第4关双晴＋第55关初蕊'},{from:10,to:16,content:'落玉庭，三次独立的消除/下落/再次消除'},{from:16,to:18,content:'双模式＋额外玩法回顾、游戏名'}],
  verified:{gardenLegalMoves:gardenMoves.length,crossWins:cross.moves.at(-1).after.won,flowerWins:flower.moves.at(-1).after.won,gravityChains:gravityClips.map(c=>c.after.chain),denseRegionsCleared:opening.after.clears,sourceGravityRenderer:true},
  audioEvents,sourceHashes:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]))},null,2));
if(process.argv.includes('--render'))render().catch(error=>{console.error(error);process.exitCode=1;});
