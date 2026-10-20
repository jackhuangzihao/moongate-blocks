// Records the running browser preview through normal pointer input.
// No board, tray, score, animation or game save is injected or edited.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {spawn}=require('child_process'),{once}=require('events');
const deps=process.env.CODEX_VIDEO_DEPS||'/Users/huangzihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(deps+'/playwright');
const root=path.resolve(__dirname,'../..'),G=require(root+'/js/gravity/gravity-engine');
const {readModules,bundleModules}=require(root+'/tests/helpers/preview-bundle');
const out=__dirname,work=path.join(out,'制作记录');fs.mkdirSync(work,{recursive:true});
const FPS=60,W=1080,H=1920;
const route=[[1,1,2],[0,7,3],[2,4,1],[0,4,7],[1,0,5],[2,1,0],[1,4,3],[2,5,3],[0,2,4],[1,2,1],[2,5,0],[0,2,2],[2,2,0],[0,2,4],[1,0,0],[0,2,5],[2,0,2],[1,7,0],[1,5,3],[0,0,4],[2,2,5],[0,7,0],[1,3,1],[2,0,1],[2,2,0],[0,5,0],[1,4,3],[1,7,0],[2,0,4],[0,0,2],[1,6,4],[2,0,1],[0,2,3],[0,4,6]];
const selected=[9,18,24,33],CLIP_FRAMES=126,TAIL_FRAMES=36;
let check=G.start('free',400);const expected=[],highlights=[];
route.forEach((move,index)=>{
  const result=G.play(check,...move);assert(result,`Illegal route move ${index}`);check=result.state;expected.push(JSON.parse(JSON.stringify(check)));
  if(selected.includes(index)){
    assert.equal(Math.max(...result.frames.map(f=>f.wave)),2);
    highlights.push({move:index+1,clearedCells:result.frames.filter(f=>f.kind==='clear').reduce((n,f)=>n+f.before.flat().filter(Boolean).length-f.after.flat().filter(Boolean).length,0),frames:result.frames.map(f=>({kind:f.kind,wave:f.wave}))});
  }
});
const modules=readModules(root),gameSource=fs.readFileSync(root+'/game.js','utf8');
const hashes=Object.fromEntries([['game.js',gameSource],...Object.entries(modules)].map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>方寸九宫 · 落玉庭实录</title>
<style>html,body{margin:0;background:#FAF9F2;overflow:hidden}#game{display:block;width:405px;height:720px;touch-action:none}#film{display:none}</style>
<canvas id="game"></canvas><canvas id="film" width="1080" height="1920"></canvas>
<script>
let captureClock=Date.parse('2026-10-19T04:00:00Z');const baseClock=captureClock,callbacks=[],handlers={},memory={},audioLog=[];
const NativeDate=Date;class PreviewDate extends NativeDate{constructor(...args){super(...(args.length?args:[captureClock]));}static now(){return captureClock;}}window.Date=PreviewDate;
window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length;};
// Fix one ordinary random seed, so every recorded position can be replayed from empty.
Math.random=()=>400/4294967296;
const display=document.getElementById('game');let first=true;
const wx={getWindowInfo:()=>({windowWidth:405,windowHeight:720,pixelRatio:2,safeArea:{top:20,bottom:700}}),getMenuButtonBoundingClientRect:()=>({bottom:54}),
 createCanvas:()=>{if(first){first=false;return display;}return document.createElement('canvas');},createOffscreenCanvas:()=>document.createElement('canvas'),
 getStorageSync:k=>memory[k],setStorageSync:(k,v)=>{memory[k]=JSON.parse(JSON.stringify(v));},getLaunchOptionsSync:()=>({query:{}}),
 createInnerAudioContext:()=>({src:'',volume:1,playbackRate:1,loop:false,stop(){},pause(){},onError(){},play(){audioLog.push({clock:captureClock,src:this.src,gain:this.volume,rate:this.playbackRate,loop:this.loop});}})};
for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Show','Hide'])wx['on'+name]=fn=>handlers[name]=fn;
const pointers=new Map();function point(e){return{identifier:e.pointerId,clientX:e.clientX,clientY:e.clientY};}
display.addEventListener('pointerdown',e=>{e.preventDefault();display.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);handlers.TouchStart({touches:[...pointers.values()],changedTouches:[p]});});
display.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);handlers.TouchMove({touches:[...pointers.values()],changedTouches:[p]});});
for(const[event,name]of[['pointerup','TouchEnd'],['pointercancel','TouchCancel']])display.addEventListener(event,e=>{const p=point(e);pointers.delete(e.pointerId);handlers[name]({touches:[...pointers.values()],changedTouches:[p]});});
${bundleModules(modules)}
(function(){${gameSource}
const film=document.getElementById('film'),fc=film.getContext('2d');
window.capture={
 advance(ms){captureClock+=ms;const q=callbacks.splice(0);q.forEach(fn=>fn(captureClock));},
 open(){openGravity();},
 read(){const m=gravityMode.model;return{run:JSON.parse(JSON.stringify(m.run)),animation:!!m.animation,layout:require('./js/gravity/gravity-view').layoutFor(layout,m.run.mode!=='free'),clock:captureClock};},
 coordinates(move){const m=gravityMode.model,v=require('./js/gravity/gravity-view').layoutFor(layout,m.run.mode!=='free'),s=require('./js/gravity/gravity-engine').shape(m.run.tray[move[0]]),bounds={width:Math.max(...s.cells.map(p=>p[0]))+1,height:Math.max(...s.cells.map(p=>p[1]))+1},box=v.trays[move[0]];
  return{from:[box.x+box.width/2,box.y+box.height/2],to:[v.board.x+(move[1]+bounds.width/2)*v.cell,v.board.y+(move[2]+bounds.height/2)*v.cell+Math.min(86,v.cell*2.2)]};},
 audio(){return audioLog;},
 raw(){return display.toDataURL('image/png').split(',')[1];},
 film(caption){fc.fillStyle='#FAF9F2';fc.fillRect(0,0,1080,1920);fc.drawImage(display,0,0,1080,1920);
  // Added captions occupy the game's empty top/bottom margins; game pixels are otherwise unchanged.
  fc.fillStyle='#355849';fc.textAlign='center';fc.font='600 49px "PingFang SC",sans-serif';fc.fillText(caption,540,94);
  fc.fillStyle='#637464';fc.font='27px "PingFang SC",sans-serif';fc.fillText('方寸九宫 · 同一局片段剪辑',540,1818);
  fc.font='23px "PingFang SC",sans-serif';fc.fillText('当前开发版 · 浏览器试玩实录',540,1863);
  return film.toDataURL('image/png').split(',')[1];},
 cover(){fc.fillStyle='#F3F1E8';fc.fillRect(0,0,1080,1920);fc.drawImage(display,0,0,1080,1920);
  fc.fillStyle='#355849';fc.textAlign='center';fc.font='600 69px "PingFang SC",sans-serif';fc.fillText('落下来，还能接着消',540,102);
  fc.font='32px "PingFang SC",sans-serif';fc.fillText('方寸九宫 · 落玉庭',540,1828);
  const cover=document.createElement('canvas');cover.width=1080;cover.height=1440;const cc=cover.getContext('2d');cc.fillStyle='#F3F1E8';cc.fillRect(0,0,1080,1440);
  cc.drawImage(film,0,160,1080,1440,0,0,1080,1440);
  cc.fillStyle='#F3F1E8';cc.fillRect(0,0,1080,185);cc.fillStyle='#355849';cc.textAlign='center';cc.font='600 70px "PingFang SC",sans-serif';cc.fillText('落下来，还能接着消',540,99);cc.font='32px "PingFang SC",sans-serif';cc.fillText('方寸九宫 · 落玉庭',540,157);
  return cover.toDataURL('image/png').split(',')[1];}
};
})();</script></html>`;
fs.writeFileSync(path.join(work,'试玩实录.html'),html);
function encode(file,width,height){const p=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','pipe:0','-an','-vf',`scale=${width}:${height}:flags=lanczos`,'-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','inherit','inherit']});p.stdin.on('error',e=>{if(e.code!=='EPIPE')throw e;});return{p,done:once(p,'close')};}
async function write(encoder,b64){if(!encoder.p.stdin.write(Buffer.from(b64,'base64')))await once(encoder.p.stdin,'drain');}
async function main(){
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:405,height:720},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent(html,{waitUntil:'load'});
  assert.equal(errors.length,0,errors.join('\n'));
  const advance=ms=>page.evaluate(ms=>capture.advance(ms),ms);
  await advance(100);await page.evaluate(()=>capture.open());await advance(50);
  let info=await page.evaluate(()=>capture.read());assert.equal(info.run.mode,2);
  // Use the real first-entry "skip demonstration" button, then play from empty.
  const next=info.layout.buttons.next;await page.mouse.click(next.x+next.width/2,next.y+next.height/2);await advance(150);
  info=await page.evaluate(()=>capture.read());assert.equal(info.run.mode,'free');assert.equal(info.run.seed,400);assert.equal(info.run.steps,0);
  const edited=encode(path.join(work,'剪辑画面.mp4'),W,H),raw=encode(path.join(work,'原始游戏画面.mp4'),810,1440);
  const clips=[],captions=['放一块，连着消','落稳了，再来一次','这一块，还没结束','看它一路落下来'];
  let frame=0;
  for(let index=0;index<route.length;index++){
   const move=route[index],coords=await page.evaluate(m=>capture.coordinates(m),move),record=selected.includes(index),clipIndex=selected.indexOf(index);
   if(record){
    const start=(await page.evaluate(()=>capture.read())).clock;clips.push({move:index+1,sourceStart:start,outputStart:frame/FPS,duration:CLIP_FRAMES/FPS});
    await page.mouse.move(...coords.from);await page.mouse.down();
    const dragFrames=24;
    for(let k=0;k<CLIP_FRAMES;k++){
     if(k<dragFrames){const p=1-(1-(k+1)/dragFrames)**3;await page.mouse.move(coords.from[0]+(coords.to[0]-coords.from[0])*p,coords.from[1]+(coords.to[1]-coords.from[1])*p);}
     if(k===dragFrames)await page.mouse.up();
     await advance(1000/FPS);
     const caption=k<dragFrames?captions[clipIndex]:'消除 → 下落 → 再消除';
     const buffers=await page.evaluate(c=>({raw:capture.raw(),film:capture.film(c)}),caption);
     await Promise.all([write(raw,buffers.raw),write(edited,buffers.film)]);frame++;
     if(index===33&&k===dragFrames-1)fs.writeFileSync(path.join(out,'落玉庭连消-小红书封面.png'),Buffer.from(await page.evaluate(()=>capture.cover()),'base64'));
     if(k===48||k===72)fs.writeFileSync(path.join(work,`第${index+1}手-${k}帧.png`),Buffer.from(buffers.film,'base64'));
    }
    console.log(`Recorded actual move ${index+1}, ${frame} frames`);
   }else{
    await page.mouse.move(...coords.from);await page.mouse.down();await page.mouse.move(...coords.to);await page.mouse.up();await advance(1100);
   }
   const current=(await page.evaluate(()=>capture.read())).run;
   for(const key of['board','tray','score','chain','steps','clears','falls','random'])assert.deepStrictEqual(current[key],expected[index][key],`Browser/pure rules mismatch ${index+1}: ${key}`);
  }
  for(let k=0;k<TAIL_FRAMES;k++){
   await advance(1000/FPS);const buffers=await page.evaluate(()=>({raw:capture.raw(),film:capture.film('我做的小游戏，想听听你的建议')}));
   await Promise.all([write(raw,buffers.raw),write(edited,buffers.film)]);frame++;
  }
  edited.p.stdin.end();raw.p.stdin.end();assert.equal((await edited.done)[0],0);assert.equal((await raw.done)[0],0);assert.equal(frame,540);
  const logs=await page.evaluate(()=>capture.audio()),events=[];
  for(const clip of clips)for(const event of logs)if(!event.loop&&event.clock>=clip.sourceStart&&event.clock<clip.sourceStart+clip.duration*1000)events.push({...event,time:clip.outputStart+(event.clock-clip.sourceStart)/1000});
  assert(events.length>=8);assert.equal(errors.length,0,errors.join('\n'));
  const record={seed:400,width:W,height:H,fps:FPS,seconds:frame/FPS,route,selectedMoves:selected.map(i=>i+1),clips,highlights,audioEvents:events,sourceHashes:hashes,
   verification:'Every browser pointer move replayed from the empty free board, board/tray/score/chain/steps/clears/falls/random asserted after every move',
   capture:'Actual current game.js running in Chrome through the offline WeChat API preview bridge; no board/score/tray edits. Not a WeChat phone recording.'};
  fs.writeFileSync(path.join(work,'实录与重放验证.json'),JSON.stringify(record,null,2));
  // Keep the game's exact effect selection, gain and pitch; lift the complete mix for video playback.
  const sources=[...new Set(events.map(e=>e.src))],filters=['[1:a]volume=0.22,atrim=0:9,afade=t=out:st=8.5:d=0.5[music]'];
  sources.forEach((src,i)=>{const uses=events.filter(e=>e.src===src);filters.push(`[${i+2}:a]asplit=${uses.length}`+uses.map((_,j)=>`[s${i}_${j}]`).join(''));
   uses.forEach((e,j)=>filters.push(`[s${i}_${j}]aresample=48000,asetrate=${Math.round(48000*e.rate)},aresample=48000,volume=${e.gain*2.3},adelay=${Math.round(e.time*1000)}:all=1[e${events.indexOf(e)}]`));});
  filters.push('[music]'+events.map((_,i)=>`[e${i}]`).join('')+`amix=inputs=${events.length+1}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.3:LRA=7,afade=t=out:st=8.8:d=0.2[a]`);
  const mix=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',path.join(work,'剪辑画面.mp4'),'-i',root+'/assets/audio/bgm-v2.wav',...sources.flatMap(s=>['-i',path.join(root,s)]),'-filter_complex',filters.join(';'),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','9','-movflags','+faststart','-metadata','title=方寸九宫·落玉庭｜开发版试玩实录',path.join(out,'落玉庭连消-小红书实录版.mp4')],{stdio:'inherit'});
  assert.equal((await once(mix,'close'))[0],0);
  console.log('Finished: actual browser gameplay, four real two-wave chains, 9 seconds.');
 }finally{if(browser)await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
