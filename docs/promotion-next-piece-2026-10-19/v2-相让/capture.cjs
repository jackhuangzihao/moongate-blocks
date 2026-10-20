// Quiz clip captured from the actual running game, using normal pointer controls.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {spawn}=require('child_process'),{once}=require('events');
const deps=process.env.CODEX_VIDEO_DEPS||'/Users/huangzihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(deps+'/playwright');
const root=path.resolve(__dirname,'../../..'),C=require(root+'/js/challenge/challenges');
const {readModules,bundleModules}=require(root+'/tests/helpers/preview-bundle');
const work=path.join(__dirname,'制作记录');fs.mkdirSync(work,{recursive:true});
const FPS=60,FRAMES=600,THINK_FRAMES=180,LEVEL=61;
const level=C.level(LEVEL),expected=[];let trial=C.start(LEVEL);
for(const move of level.solution){const result=C.play(trial,...move);assert(result);expected.push(JSON.parse(JSON.stringify(trial)));}
assert(trial.won);assert.equal(C.stars(trial),3);assert.equal(trial.history.length,5);
assert.equal(C.level(LEVEL).number,14);
const B=require(root+'/js/rules/board');
let opening=C.start(LEVEL);const finalMove=level.solution.at(-1),lastShape=expected[3].tray[finalMove[0]];
assert(!B.canPlace(opening.board,lastShape,finalMove[1],finalMove[2]),'The final piece must require space freed by an earlier clear');
assert(B.canPlace(expected[2].board,lastShape,finalMove[1],finalMove[2]));
const modules=readModules(root),game=fs.readFileSync(root+'/game.js','utf8');
const sourceHashes=Object.fromEntries([['game.js',game],...Object.entries(modules)].map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>下一块放哪里 · 相让实录</title>
<style>html,body{margin:0;background:#E8EFFB;overflow:hidden}#game{display:block;width:405px;height:720px;touch-action:none}#film{display:none}</style>
<canvas id="game"></canvas><canvas id="film" width="1080" height="1920"></canvas><script>
let clock=Date.parse('2026-10-19T05:00:00Z');const callbacks=[],handlers={},memory={},audioLog=[];
const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length;};
const display=document.getElementById('game');let first=true;
const wx={getWindowInfo:()=>({windowWidth:405,windowHeight:720,pixelRatio:2,safeArea:{top:20,bottom:700}}),getMenuButtonBoundingClientRect:()=>({bottom:54}),
 createCanvas:()=>{if(first){first=false;return display;}return document.createElement('canvas');},createOffscreenCanvas:()=>document.createElement('canvas'),
 getStorageSync:k=>memory[k],setStorageSync:(k,v)=>{memory[k]=JSON.parse(JSON.stringify(v));},getLaunchOptionsSync:()=>({query:{}}),
 createInnerAudioContext:()=>({src:'',volume:1,playbackRate:1,loop:false,stop(){},pause(){},onError(){},play(){audioLog.push({clock,src:this.src,gain:this.volume,rate:this.playbackRate,loop:this.loop});}})};
for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Show','Hide'])wx['on'+name]=fn=>handlers[name]=fn;
const pointers=new Map();function point(e){return{identifier:e.pointerId,clientX:e.clientX,clientY:e.clientY};}
display.addEventListener('pointerdown',e=>{e.preventDefault();display.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);handlers.TouchStart({touches:[...pointers.values()],changedTouches:[p]});});
display.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);handlers.TouchMove({touches:[...pointers.values()],changedTouches:[p]});});
for(const[event,name]of[['pointerup','TouchEnd'],['pointercancel','TouchCancel']])display.addEventListener(event,e=>{const p=point(e);pointers.delete(e.pointerId);handlers[name]({touches:[...pointers.values()],changedTouches:[p]});});
${bundleModules(modules)}
(function(){${game}
const film=document.getElementById('film'),fc=film.getContext('2d');
window.capture={
 advance(ms){clock+=ms;const q=callbacks.splice(0);q.forEach(fn=>fn(clock));},
 open(id){startChallenge(id);},
 read(){return{clock,run:JSON.parse(JSON.stringify(state.challenge)),guide:state.mechanicGuide?mechanicGuide.rects(layout,state.mechanicGuide,state.challenge).skip:null,layout,over:state.gameOver};},
 coordinates(move){const shape=state.tray[move[0]],bounds=shapeBounds(shape);return{
  from:[layout.horizontalPadding+layout.traySlotWidth*(move[0]+.5),layout.trayY],
  to:[layout.boardX+(move[1]+bounds.width/2)*layout.cellSize,layout.boardY+(move[2]+bounds.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2)]};},
 audio(){return audioLog;},raw(){return display.toDataURL('image/png').split(',')[1];},
 film(t){fc.fillStyle='#E8EFFB';fc.fillRect(0,0,1080,1920);fc.drawImage(display,0,0,1080,1920);
  const caption=t<3?'这次，下一块先放哪里？':t<3.83?'① 先落竖条，接好这一行':t<4.73?'② 用拐角接上中间':t<5.83?'③ 补齐左边，先消一行':t<6.73?'④ 拐角先补左上':t<7.5?'⑤ 再放拐角，行和九宫一起消':t<8.3?'一行 ＋ 一宫，完成目标':'5步完成，三星通关';
  fc.textAlign='center';fc.fillStyle='#263E6A';fc.font='600 46px "PingFang SC",sans-serif';fc.fillText(caption,540,72);
  fc.font='29px "PingFang SC",sans-serif';fc.fillStyle='#4D6081';
  fc.fillText(t<3?'目标：3次区域消除 · 先想3秒 · '+Math.max(1,3-Math.floor(t)):t<8.3?'先布局 → 消一行腾位置 → 最后一手双消':'第一组，你会先放哪一块？',540,130);
  // Only the blank bottom safe area carries a provenance label.
  fc.font='22px "PingFang SC",sans-serif';fc.fillText('方寸九宫 · 第14关相让｜开发版浏览器试玩实录',540,1885);
  return film.toDataURL('image/png').split(',')[1];},
 cover(){const cc=document.createElement('canvas');cc.width=1080;cc.height=1440;const c=cc.getContext('2d');c.fillStyle='#E8EFFB';c.fillRect(0,0,1080,1440);
  c.drawImage(display,layout.boardX*2-10,layout.boardY*2-10,layout.boardWidth*2+20,layout.boardHeight*2+20,120,300,840,840);
  c.textAlign='center';c.fillStyle='#263E6A';c.font='600 76px "PingFang SC",sans-serif';c.fillText('下一块，先放哪里？',540,111);
  c.font='36px "PingFang SC",sans-serif';c.fillStyle='#4D6081';c.fillText('目标：完成3次区域消除',540,194);
  c.fillText('先想3秒，再看5步解法',540,253);
  const trayTop=(layout.trayY-44)*2,trayHeight=88*2;
  c.drawImage(display,0,trayTop,display.width,trayHeight,0,1168,1080,trayHeight/display.width*1080);
  c.font='28px "PingFang SC",sans-serif';c.fillText('方寸九宫 · 目标闯关 · 第14关「相让」',540,1418);
  return cc.toDataURL('image/png').split(',')[1];}
};})();</script></html>`;
fs.writeFileSync(path.join(work,'录制页面.html'),html);
function encode(file,width,height){const p=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','pipe:0','-an','-vf',`scale=${width}:${height}:flags=lanczos`,'-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','inherit','inherit']});p.stdin.on('error',e=>{if(e.code!=='EPIPE')throw e;});return{p,done:once(p,'close')};}
async function write(e,b64){if(!e.p.stdin.write(Buffer.from(b64,'base64')))await once(e.p.stdin,'drain');}
async function main(){
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:405,height:720},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.setContent(html,{waitUntil:'load'});assert.equal(errors.length,0,errors.join('\n'));
  const advance=ms=>page.evaluate(ms=>capture.advance(ms),ms);
  await advance(100);
  async function skipGuide(){const info=await page.evaluate(()=>capture.read());if(info.guide){const r=info.guide;await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await advance(150);}}
  async function assertRun(expectedRun){const actual=(await page.evaluate(()=>capture.read())).run;for(const key of['board','tray','history','progress','score','won','totalClears'])assert.deepStrictEqual(actual[key],expectedRun[key],`Level ${C.level(actual.level).number}, move ${expectedRun.history.length}: actual game differs: ${key}`);}
  // Unlock in public chapter order, completing all preceding levels through normal controls.
  for(const preceding of C.chapterLevels(level.chapter).filter(item=>item.order<level.order)){
   const id=preceding.id;
   await page.evaluate(id=>capture.open(id),id);await advance(250);await skipGuide();const check=C.start(id);
   for(const move of C.level(id).solution){const points=await page.evaluate(m=>capture.coordinates(m),move);await page.mouse.move(...points.from);await page.mouse.down();await page.mouse.move(...points.to);await page.mouse.up();await page.evaluate(()=>{for(let i=0;i<75;i++)capture.advance(1000/60);});assert(C.play(check,...move));await assertRun(check);}
   assert(check.won);
  }
  await page.evaluate(id=>capture.open(id),LEVEL);await advance(250);await skipGuide();
  const initial=await page.evaluate(()=>capture.read());assert.equal(initial.run.level,LEVEL);assert.equal(initial.run.history.length,0);assert.equal(initial.guide,null);
  await assertRun(C.start(LEVEL));
  fs.writeFileSync(path.join(__dirname,'下一块放哪里-小红书封面.png'),Buffer.from(await page.evaluate(()=>capture.cover()),'base64'));
  const edited=encode(path.join(work,'剪辑画面.mp4'),1080,1920),raw=encode(path.join(work,'原始游戏画面.mp4'),810,1440);
  const moveSpecs=[{move:level.solution[0],start:180,arrive:204,release:210},{move:level.solution[1],start:230,arrive:254,release:264},{move:level.solution[2],start:284,arrive:308,release:324},{move:level.solution[3],start:350,arrive:374,release:384},{move:level.solution[4],start:404,arrive:428,release:450}];
  const coordinates=new Map();let thinkingRawHash=null;const started=initial.clock;
  for(let f=0;f<FRAMES;f++){
   for(let i=0;i<moveSpecs.length;i++){
    const m=moveSpecs[i];
    if(f===m.start){const points=await page.evaluate(m=>capture.coordinates(m),m.move);coordinates.set(i,points);await page.mouse.move(...points.from);await page.mouse.down();}
    if(f>=m.start&&f<=m.arrive){const points=coordinates.get(i),p=1-(1-(f-m.start+1)/(m.arrive-m.start+1))**3;await page.mouse.move(points.from[0]+(points.to[0]-points.from[0])*p,points.from[1]+(points.to[1]-points.from[1])*p);}
    if(f===m.release){await page.mouse.up();await assertRun(expected[i]);}
   }
   await advance(1000/FPS);
   const buffers=await page.evaluate(t=>({raw:capture.raw(),film:capture.film(t)}),f/FPS);
   if(f<THINK_FRAMES){const hash=crypto.createHash('sha256').update(buffers.raw).digest('hex');if(f===0)thinkingRawHash=hash;else assert.equal(hash,thinkingRawHash,'Thinking interval revealed or changed the board');}
   await Promise.all([write(raw,buffers.raw),write(edited,buffers.film)]);
   if([0,150,207,270,330,390,440,454,495,570].includes(f))fs.writeFileSync(path.join(work,`第${f}帧.png`),Buffer.from(buffers.film,'base64'));
   if(f%120===0)console.log(`Captured ${f}/${FRAMES}; real level 14, three-second pause then five moves`);
  }
  edited.p.stdin.end();raw.p.stdin.end();assert.equal((await edited.done)[0],0);assert.equal((await raw.done)[0],0);
  await assertRun(expected.at(-1));assert.equal(C.stars((await page.evaluate(()=>capture.read())).run),3);assert.equal(errors.length,0,errors.join('\n'));
  const events=(await page.evaluate(()=>capture.audio())).filter(e=>!e.loop&&e.clock>=started&&e.clock<started+FRAMES/FPS*1000).map(e=>({...e,time:(e.clock-started)/1000}));
  assert(events.some(e=>e.src.endsWith('win.wav')));
  fs.writeFileSync(path.join(work,'实录与重放验证.json'),JSON.stringify({width:1080,height:1920,fps:FPS,seconds:FRAMES/FPS,level:level.number,title:level.title,goal:C.goal(level),thinkingSeconds:THINK_FRAMES/FPS,thinkingBoardUnchanged:true,solution:level.solution,actualStars:3,moveFrames:moveSpecs,audioEvents:events,sourceHashes,
   capture:'Current game.js in browser WeChat preview bridge. All preceding first-chapter levels completed through normal inputs; level 14 recorded continuously with an unchanged three-second puzzle interval, normal drag input and native win animation. The final piece initially overlaps an occupied cell, freed by move three. No board, tray, score, guide, progress or save injection.'},null,2));
  const duration=FRAMES/FPS,sources=[...new Set(events.map(e=>e.src))];
  const filters=[`[1:a]volume=0.18,atrim=0:${duration},afade=t=out:st=${duration-.5}:d=0.5[music]`];
  sources.forEach((src,i)=>{const uses=events.filter(e=>e.src===src);filters.push(`[${i+2}:a]asplit=${uses.length}`+uses.map((_,j)=>`[s${i}_${j}]`).join(''));
   uses.forEach((e,j)=>filters.push(`[s${i}_${j}]aresample=48000,asetrate=${Math.round(48000*e.rate)},aresample=48000,volume=${e.gain*2.3},adelay=${Math.round(e.time*1000)}:all=1[e${events.indexOf(e)}]`));});
  filters.push('[music]'+events.map((_,i)=>`[e${i}]`).join('')+`amix=inputs=${events.length+1}:duration=first:normalize=0,loudnorm=I=-17:TP=-1.3:LRA=7,afade=t=out:st=${duration-.2}:d=0.2[a]`);
  const mix=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',path.join(work,'剪辑画面.mp4'),'-i',root+'/assets/audio/bgm-v2.wav',...sources.flatMap(s=>['-i',path.join(root,s)]),'-filter_complex',filters.join(';'),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),'-movflags','+faststart','-metadata','title=下一块放哪里｜方寸九宫第14关相让',path.join(__dirname,'下一块放哪里-小红书闯关实录.mp4')],{stdio:'inherit'});
  assert.equal((await once(mix,'close'))[0],0);console.log('Finished: 10-second real gameplay quiz, 3 seconds thinking, five-move three-star solution.');
 }finally{if(browser)await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
