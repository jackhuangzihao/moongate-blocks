// Promotional animation. Reads the game renderer/rules; never writes game state.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');
const { once } = require('events');
const crypto = require('crypto');
const deps = process.env.CODEX_VIDEO_DEPS || '/Users/huangzihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { createCanvas, GlobalFonts } = require(path.join(deps, '@napi-rs/canvas'));
const root = path.resolve(__dirname, '../..');
const { COLORS } = require(path.join(root, 'js/config'));
const rules = require(path.join(root, 'js/rules/board'));
const challenges = require(path.join(root, 'js/challenge/challenges'));
const { drawBoard, drawClearAnimation } = require(path.join(root, 'js/views/board-view'));
const art = require(path.join(root, 'js/views/art'));
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc', 'GardenSerif');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc', 'GardenSans');

const W = 1080, H = 1920, FPS = 30, SECONDS = 22, FRAMES = FPS * SECONDS;
const P = { cream: '#F5F1E7', green: '#344E41', muted: '#687060', gold: '#B69457' };
const gardenColors = { ...COLORS };
const blueColors = { ...COLORS, background: '#E8EFFB', panel: '#FFFFFF', text: '#263E6A',
  secondaryText: '#4D6081', primaryButton: '#354FBE', block: '#7999D9', emptyCell: '#DEE5F3',
  boardEdge: '#BECBEA', palaceLine: '#ACBCD7', energyEmptyCell: '#D9E3F6', clearGlow: '#FFF1CA' };
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, p) => a + (b - a) * p;
const clone = x => JSON.parse(JSON.stringify(x));
const sceneAlpha = (t, at) => ease((t - at) / 0.6);

function rr(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke(); }
}
function txt(c, s, x, y, size = 32, color = P.green, serif = false, align = 'left') {
  c.fillStyle = color; c.font = `${serif ? '900' : '400'} ${size}px ${serif ? 'GardenSerif' : 'GardenSans'}`;
  c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(s, x, y);
}
function rule(c, x, y, width, color = '#D9D3C2') {
  c.strokeStyle = color; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + width, y); c.stroke();
}
function mark(c, x, y, cell, color = P.green, p = 1) {
  const pattern = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]];
  for (let i = 0; i < pattern.length; i++) {
    const [a,b] = pattern[i], k = ease((p - i * .035) / .65);
    c.save(); c.globalAlpha *= k;
    rr(c, x + a * cell + 3, y + b * cell + (1-k)*16 + 3, cell-6, cell-6, cell*.15, i===4 ? P.gold : color);
    c.restore();
  }
}

// One fixed texture prevents flicker and keeps frame rendering deterministic.
const paper = createCanvas(W, H), pc = paper.getContext('2d');
let seed = 701031;
for (let i=0; i<19000; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed % W;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = seed % H;
  pc.fillStyle = i%2 ? '#FFFFFF12' : '#695A3610'; pc.fillRect(x,y,1.5,1.5);
}
function background(c, blue = false) {
  const g = c.createLinearGradient(0,0, W,H);
  g.addColorStop(0,blue ? '#F0F4FC' : '#F9F6EE');
  g.addColorStop(1,blue ? '#E4EBF8' : '#EDE8D9');
  c.fillStyle=g;c.fillRect(0,0,W,H);c.drawImage(paper,0,0);
  c.save();c.globalAlpha=.33;c.strokeStyle=blue?'#CED9ED':'#DAD7C7';c.lineWidth=2;
  c.beginPath();c.arc(1040,260,420,0,Math.PI*2);c.stroke();
  c.beginPath();c.arc(1040,260,442,0,Math.PI*2);c.stroke();c.restore();
}
function header(c, blue = false, label = '清雅庭院 · 方块消除') {
  const color=blue?blueColors.text:P.green;
  mark(c,92,132,14,color);
  txt(c,'方寸九宫',150,163,28,color,true);
  txt(c,label,92,250,26,blue?blueColors.secondaryText:P.muted);
}
function heading(c, lines, t, start=0, blue=false) {
  const color=blue?blueColors.text:P.green;
  lines.forEach((line,i)=>{
    const p=sceneAlpha(t,start+i*.11);
    c.save();c.globalAlpha*=p;
    txt(c,line,88,385+i*118+(1-p)*35,94,color,true);c.restore();
  });
}
function footer(c, blue=false) {
  rule(c,92,1762,816,blue?'#C5D1E4':'#D5D0C0');
  txt(c,'方寸之间，自在消除',92,1815,25,blue?blueColors.secondaryText:P.muted);
  mark(c,860,1783,13,blue?blueColors.text:P.green);
}

const line3={cells:[[0,0],[1,0],[2,0]]};
const square={cells:[[0,0],[1,0],[0,1],[1,1]]};
const corner={cells:[[0,0],[0,1],[1,1]]};
const initial= ['111001000','111001110','000111111','011000010','011100010','000000000','100110000','100110110','111000110'].map(s=>[...s].map(Number));
const demoSteps=[];
let nextBoard=clone(initial);
for (const [shape,col,row,start,land] of [[line3,0,2,1.05,2.30],[square,1,6,5.15,6.40]]) {
  assert(rules.canPlace(nextBoard,shape,col,row), 'Promotional move must be legal');
  const before=clone(nextBoard); rules.placeShape(nextBoard,shape,col,row);
  const full=clone(nextBoard),regions=rules.findCompletedRegions(full);
  const cells=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(full[y][x]===1 &&
    (regions.rows.includes(y)||regions.cols.includes(x)||regions.palaces.some(([a,b])=>Math.floor(x/3)===a&&Math.floor(y/3)===b)))cells.push([x,y]);
  assert(cells.length>0,'Demonstration must actually clear');
  rules.clearCompletedRegions(nextBoard,regions);
  demoSteps.push({shape,col,row,start,land,before,full,after:clone(nextBoard),cells,regions});
}
assert.deepStrictEqual(demoSteps[0].regions.rows,[2]);
assert.deepStrictEqual(demoSteps[0].regions.palaces,[[0,0]]);
assert.deepStrictEqual(demoSteps[1].regions.palaces,[[0,2]]);

// Actual level 4, after the first move of its reference solution.
const run=challenges.start(3), level=challenges.level(3);
assert(challenges.play(run,...level.solution[0]));
const challengeBefore=clone(run), [challengeSlot,cc,cr]=level.solution[1];
const challengeShape=clone(run.tray[challengeSlot]);
const challengeResult=challenges.play(run,...level.solution[1]);
assert(challengeResult && run.won && challengeResult.count===2);
const challengeAfter=clone(run);

function board(c, b, x, y, width, options={}) {
  Object.assign(COLORS,options.blue?blueColors:gardenColors);
  const k=width/324, l={boardX:0,boardY:0,boardWidth:324,boardHeight:324,cellSize:36};
  const state={mode:'easy',board:b,energyPalaces:[],piecesPlaced:1,clearingCells:options.cells||[],
    clearProgress:options.progress||0,challenge:options.challenge||null};
  c.save();c.translate(x,y);c.scale(k,k);
  drawBoard(c,l,state);
  if(options.cells)drawClearAnimation(c,l,state);
  c.restore();
}
function piece(c,shape,x,y,size,color=P.green,alpha=1) {
  c.save();c.globalAlpha*=alpha;
  for(const [a,b]of shape.cells)rr(c,x+a*size+4,y+b*size+4,size-8,size-8,size*.13,color);
  c.restore();
}
function sparks(c,cells,x,y,cell,t,blue=false) {
  if(t<0||t>.9)return;
  const p=clamp(t/.9);
  c.save();c.globalAlpha=(1-p)*.72;
  for(let i=0;i<cells.length;i++) {
    const [a,b]=cells[i],ang=i*2.39996,r=20+75*p;
    const px=x+(a+.5)*cell+Math.cos(ang)*r,py=y+(b+.5)*cell+Math.sin(ang)*r-60*p;
    art.star(c,px,py,(3+4*(1-p)),blue?'#B89A56':'#BFA15D');
  }
  c.restore();
}
function drag(c,shape,from,to,start,land,t,color) {
  const p=smooth((t-start)/(land-start-.20));
  const size=mix(66,85,p), x=mix(from[0],to[0],p), y=mix(from[1],to[1],p)-Math.sin(p*Math.PI)*92;
  c.save();c.shadowColor='#344E412B';c.shadowBlur=25;c.shadowOffsetY=14;
  piece(c,shape,x,y,size,color);c.restore();
  // A small contact ring makes the gesture readable without a drawn hand.
  if(t>start+.1&&t<land-.06){
    c.save();c.globalAlpha=.44; c.strokeStyle='#FAF8F0';c.lineWidth=4;
    c.beginPath();c.arc(x+size*1.5,y+size*.72,18,0,Math.PI*2);c.stroke();c.restore();
  }
}
function tag(c,s,cy,blue=false,opacity=1) {
  c.save();c.globalAlpha*=opacity;
  c.font='400 30px GardenSans'; const width=c.measureText(s).width+66;
  rr(c,(W-width)/2,cy-42,width,64,32,blue?'#FFFFFFD9':'#FAF8F0D9');
  txt(c,s,W/2,cy,30,blue?blueColors.text:P.green,false,'center');c.restore();
}

function playScene(c,t) {
  background(c);header(c);
  const change=smooth((t-3.65)/.4);
  if(change<1){c.save();c.globalAlpha=1-change;heading(c,['脑袋有点满？','先消一小块。'],t);c.restore();}
  if(change>0){c.save();c.globalAlpha=change;heading(c,['放下这一块，','刚刚好。'],t,3.65);c.restore();}
  txt(c,t<3.85?'一款清雅的方块消除小游戏':'填满行、列或九宫，即可消除',92,573,31,P.muted);
  const x=157.5,y=672,w=765,cell=85;
  let current=initial, active=null;
  for(const step of demoSteps){
    if(t>=step.land+.66)current=step.after;
    else if(t>=step.land){current=step.full;active=step;break;}
    else break;
  }
  const progress=active?clamp((t-active.land)/.66):0;
  board(c,current,x,y,w,active?{cells:active.cells,progress}:{});
  for(let i=0;i<demoSteps.length;i++){
    const s=demoSteps[i],from=i===0?[193,1524]:[505,1490];
    if(t<s.start)piece(c,s.shape,...from,66,gardenColors.block);
    else if(t<s.land){
      c.save();c.globalAlpha=.3*clamp((t-s.start)/.25);
      piece(c,s.shape,x+s.col*cell,y+s.row*cell,cell,gardenColors.block);c.restore();
      drag(c,s.shape,from,[x+s.col*cell,y+s.row*cell],s.start,s.land,t,gardenColors.block);
    }
    sparks(c,s.cells,x,y,cell,t-s.land);
  }
  piece(c,corner,806,1490,66,gardenColors.block);
  const step=demoSteps.find(s=>t>=s.land && t<s.land+1.65);
  if(step){
    const p=clamp((t-step.land)/.18)*clamp((step.land+1.65-t)/.3);
    tag(c,step===demoSteps[0]?'一行 + 一宫，同时消除':'再清一宫，留点空',1469,false,p);
  }
  txt(c,'自由摆放 · 不限时',W/2,1695,28,P.muted,false,'center');footer(c);
}

function gardenScene(c,t) {
  background(c);header(c,false,'给自己 · 一点留白');
  heading(c,['没有倒计时，','慢慢来就好。'],t,9.2);
  txt(c,'清雅庭院 · 不限时自由消除',92,573,31,P.muted);
  c.save();c.globalAlpha=.5;c.strokeStyle='#D6CDB6';c.lineWidth=2;
  c.beginPath();c.arc(540,1030,370,0,Math.PI*2);c.stroke();c.restore();
  const k=.96+.04*ease((t-9.2)/3.5);
  c.save();c.translate(540,1100);c.scale(k,k);c.translate(-540,-1100);
  art.garden(c,{x:75,y:765,width:930,height:590},['bamboo','lotus','plum','lamp','swallows']);
  c.restore();
  for(let i=0;i<7;i++){
    const a=i*1.7+t*.11, xx=540+Math.cos(a)*(300+i*12), yy=1060+Math.sin(a)*(290+i*5);
    c.save();c.globalAlpha=.22;art.star(c,xx,yy,3+i%3,P.gold);c.restore();
  }
  tag(c,'一小局，也是一小段自己的时间',1535);footer(c);
}

const CHALLENGE_START=13.5, CHALLENGE_DRAG=14.85, CHALLENGE_LAND=16.15;
function challengeScene(c,t) {
  background(c,true);header(c,true,'闯关挑战 · 换一种乐趣');
  heading(c,['想认真一点？','下一步，听你的。'],t,CHALLENGE_START,true);
  txt(c,'有限步数，想好每一次落子',92,573,31,blueColors.secondaryText);
  const x=157.5,y=711,w=765,cell=85;
  txt(c,`第 ${level.number} 关 · ${level.title}`,157,651,28,blueColors.text);
  txt(c,'行 / 列 + 九宫',922,651,25,blueColors.secondaryText,false,'right');
  const dt=t-CHALLENGE_LAND,anim=dt>=0&&dt<.66;
  const full=clone(challengeBefore.board);
  rules.placeShape(full,challengeShape,cc,cr);
  board(c,dt<0?challengeBefore.board:anim?full:challengeAfter.board,x,y,w,
    {blue:true,challenge:dt<.66?challengeBefore:challengeAfter,...(anim?{cells:challengeResult.cells,progress:clamp(dt/.66)}:{})});
  challengeBefore.tray.forEach((p,i)=>{
    if(!p)return;
    const from=[190+i*306,1551];
    if(i!==challengeSlot||t<CHALLENGE_DRAG)piece(c,p,...from,66,blueColors.block);
    else if(t<CHALLENGE_LAND)drag(c,p,from,[x+cc*cell,y+cr*cell],CHALLENGE_DRAG,CHALLENGE_LAND,t,blueColors.block);
  });
  sparks(c,challengeResult.cells,x,y,cell,dt,true);
  if(dt>.08)tag(c,'刚好，一手双消。',1640,true,ease((dt-.08)/.2));
  footer(c,true);
}

function endScene(c,t) {
  background(c);
  const p=ease((t-18.4)/.9);
  c.save();c.globalAlpha=p;
  mark(c,432,390+(1-p)*30,72,P.green,p);
  txt(c,'方寸九宫',540,790+(1-p)*22,124,P.green,true,'center');
  rule(c,472,861,136,P.gold);
  txt(c,'方寸之间，自在消除',540,954,44,P.green,false,'center');
  art.garden(c,{x:235,y:1040,width:610,height:386},['bamboo','lotus','swallows']);
  rr(c,223,1500,634,104,52,P.green);
  txt(c,'来庭院里，消一局',540,1567,37,'#FAF8F0',false,'center');
  txt(c,'微信小游戏 · 方寸九宫',540,1685,29,P.muted,false,'center');
  c.restore();
}

const canvas=createCanvas(W,H), ctx=canvas.getContext('2d');
const layers=[createCanvas(W,H),createCanvas(W,H)];
const scenes=[{start:0,draw:playScene},{start:9.2,draw:gardenScene},{start:13.5,draw:challengeScene},{start:18.4,draw:endScene}];
function frame(t){
  let i=scenes.findLastIndex(s=>t>=s.start);if(i<0)i=0;
  const current=scenes[i],p=i?smooth((t-current.start)/.40):1;
  ctx.globalAlpha=1;
  if(i&&p<1){
    scenes[i-1].draw(layers[0].getContext('2d'),t);ctx.drawImage(layers[0],0,0);
    current.draw(layers[1].getContext('2d'),t);ctx.globalAlpha=p;ctx.drawImage(layers[1],0,0);ctx.globalAlpha=1;
  } else current.draw(ctx,t);
  return canvas;
}

function cover(){
  const out=createCanvas(1080,1440),c=out.getContext('2d');
  background(c);header(c,false,'清雅庭院 · 方块消除');
  txt(c,'脑袋有点满？',88,393,99,P.green,true);
  txt(c,'先消一小块。',88,517,99,P.green,true);
  txt(c,'不用赶时间的消除小游戏',92,601,31,P.muted);
  board(c,initial,202,701,676);
  // The cover depicts a legal hover before the first clearing move.
  c.save();c.globalAlpha=.42;piece(c,line3,202,701+676/9*2,676/9,'#C4AD71');c.restore();
  rr(c,710,1162,274,152,22,'#F7F3E7','#DBD3BF');
  txt(c,'方寸九宫',847,1225,43,P.green,true,'center');
  txt(c,'方寸之间 · 自在消除',847,1271,23,P.muted,false,'center');
  fs.writeFileSync(path.join(__dirname,'方寸九宫-小红书封面-1080x1440.png'),out.toBuffer('image/png'));
}

function previews(){
  const previewDir=path.join(__dirname,'制作预览');fs.mkdirSync(previewDir,{recursive:true});
  const times=[0.7,2.5,4.4,6.6,9.9,12.0,14.3,16.4,17.5,19.5,21.5];
  const sheet=createCanvas(1350,Math.ceil(times.length/5)*526),s=sheet.getContext('2d');
  s.fillStyle='#E7E2D7';s.fillRect(0,0,sheet.width,sheet.height);
  for(let i=0;i<times.length;i++){
    frame(times[i]);
    s.drawImage(canvas,(i%5)*270,Math.floor(i/5)*526,270,480);
    txt(s,`${times[i].toFixed(1)} s`,(i%5)*270+14,Math.floor(i/5)*526+511,19);
  }
  fs.writeFileSync(path.join(__dirname,'分镜预览.jpg'),sheet.toBuffer('image/jpeg',90));
  for(const t of [0.7,2.5,9.9,16.4,21.5]){
    frame(t);fs.writeFileSync(path.join(previewDir,`预览-${t}s.png`),canvas.toBuffer('image/png'));
  }
  cover();
}

async function render(){
  const silent=path.join(__dirname,'画面.mp4');
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgba',
    '-s',`${W}x${H}`,'-r',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium',
    '-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','inherit','inherit']});
  ff.stdin.on('error',error=>{if(error.code!=='EPIPE')throw error;});
  const done=once(ff,'close');
  for(let f=0;f<FRAMES;f++){
    if(!ff.stdin.write(frame(f/FPS).data()))await once(ff.stdin,'drain');
    if(f%90===0)console.log(`Rendered ${f}/${FRAMES}`);
  }
  ff.stdin.end();const [code]=await done;assert.equal(code,0,'Video encoding failed');
  const audio=path.join(root,'docs/previews/audio-review/garden-bgm-proposal.wav');
  const inputs=[audio,...['place','clear','place','clear','place','combo'].map(id=>path.join(root,'assets/audio',id+'.wav'))];
  const delays=[2.30,2.35,6.40,6.45,CHALLENGE_LAND,CHALLENGE_LAND+.05];
  const fx=['[1:a]volume=1.65,apad,atrim=0:22,afade=t=in:d=0.8,afade=t=out:st=20.3:d=1.7[music]'];
  delays.forEach((d,i)=>fx.push(`[${i+2}:a]volume=${i%2?.48:.38},adelay=${Math.round(d*1000)}:all=1[a${i}]`));
  fx.push('[music]'+delays.map((_,i)=>`[a${i}]`).join('')+'amix=inputs=7:duration=first:normalize=0,alimiter=limit=0.92,loudnorm=I=-18:TP=-1.5:LRA=8[a]');
  const target=path.join(__dirname,'方寸九宫-小红书宣传片-清雅治愈版.mp4');
  const mixProcess=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',silent,...inputs.flatMap(f=>['-i',f]),
    '-filter_complex',fx.join(';'),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000',
    '-t','22','-movflags','+faststart','-metadata','title=方寸九宫｜先消一小块',target],{stdio:'inherit'});
  const [mixCode]=await once(mixProcess,'close');assert.equal(mixCode,0,'Audio mix failed');
  fs.unlinkSync(silent);
  console.log('Finished:',target);
}

const sources=['js/config.js','js/views/board-view.js','js/views/art.js','js/rules/board.js','js/challenge/challenges.js'];
fs.writeFileSync(path.join(__dirname,'制作记录.json'),JSON.stringify({width:W,height:H,fps:FPS,seconds:SECONDS,frames:FRAMES,
  rendering:'Canvas 2D + FFmpeg; actual game board artwork and rules',
  sourceHashes:Object.fromEntries(sources.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])),
  verified:{gardenMovesLegal:true,firstMoveClearsRowAndPalace:true,secondMoveClearsPalace:true,challengeLevel:level.number,challengeReferenceSolutionWins:true},
  music:'docs/previews/audio-review/garden-bgm-proposal.wav',
  effects:['assets/audio/place.wav','assets/audio/clear.wav','assets/audio/combo.wav'],
  scenes:[{from:0,to:9.2,content:'自由消除示意局面；两次落子均通过真实规则验证'},{from:9.2,to:13.5,content:'庭院美术与不限时玩法'},
    {from:13.5,to:18.4,content:'实际第4关双晴的参考解收尾'},{from:18.4,to:22,content:'游戏名与邀请'}]},null,2));
previews();
if(process.argv.includes('--render'))render().catch(error=>{console.error(error);process.exitCode=1;});
