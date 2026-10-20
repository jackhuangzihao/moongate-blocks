// Build an offline Canvas preview from the actual WeChat game sources.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const site=process.argv.includes('--site');
if(process.argv.slice(2).some(arg=>arg!=='--site'))throw new Error('Usage: node tests/build-playable-preview.js [--site]');
const { LEVELS, CHAPTERS }=require('../js/challenge/challenge-levels');
const { readModules, bundleModules }=require('./helpers/preview-bundle');
const modules=readModules(root);
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const feedback=modules['./js/platform/feedback'];
const audioSamples=site?'':[['tap','按钮'],['place','落子'],['undo','撤回'],['clear','普通消除'],['combo','连消'],['energy','充能'],['ice','破冰'],['bloom','开花'],['over','结束'],['win','通关']].map(([id,label])=>{
 const gain=Number(feedback.match(new RegExp("audio/"+id+"\\.wav', ([0-9.]+)"))[1]);
 return '<p>'+label+'</p><audio controls preload="metadata" data-volume="'+gain+'" style="width:100%" src="data:audio/wav;base64,'+fs.readFileSync(path.join(root,'assets/audio',id+'.wav')).toString('base64')+'"></audio>';
}).join('');
const reviewAudio=!site&&fs.existsSync(path.join(root,'docs/previews/audio-review/effects-after.wav'))?`<section><h2>听听整体搭配</h2><p>同一段操作、同一首原背景音乐，比较修改前后。试听统一放大，保留游戏内音量比例。</p><p>修改前</p><audio aria-label="修改前的整体音效" controls preload="metadata" style="width:100%" src="audio-review/effects-before.wav"></audio><p>修改后</p><audio aria-label="修改后的整体音效" controls preload="metadata" style="width:100%" src="audio-review/effects-after.wav"></audio><details><summary>背景音乐备选 · 尚未应用</summary><p>《庭间慢步》：更疏的木音与柔和和声，88 BPM，无鼓点。游戏仍使用原来的音乐。</p><p>备选音乐单独听</p><audio aria-label="背景音乐备选" controls preload="metadata" style="width:100%" src="audio-review/garden-bgm-proposal.wav"></audio><p>备选音乐配合新版音效</p><audio aria-label="备选音乐与音效搭配" controls preload="metadata" style="width:100%" src="audio-review/proposal-with-effects.wav"></audio></details></section>`:'';
const sidebar=site?`<small>MOONGATE BLOCKS · 方寸九宫</small><h1>方寸之间，<br>安放一座庭院。</h1><p>拖动方块，填满整行、整列或一个 3×3 宫格。</p><p>自由消除、限步闯关、每日精选与落玉庭，从首页选择你想玩的模式。</p><p>第一次来可以跟随练习，也可以跳过；玩法说明支持重看。</p><nav aria-label="试玩选项"><a href="?size=standard">标准屏</a><a href="?size=small">小屏</a><a href="https://github.com/jackhuangzihao/moongate-blocks" target="_blank" rel="noopener noreferrer">查看源码</a></nav><label id="lab-only" hidden>关卡试验<select id="lab-level" aria-label="选择试验关卡"></select></label><p id="status" role="status"></p><p class="toast" id="toast" role="status"></p><figure id="share-card" hidden><img alt="本局成绩分享卡片"><figcaption>分享卡片预览，实际发送请在微信中操作。</figcaption></figure><p>进度只保存在当前浏览器，与微信存档独立。微信好友榜、广告、分享发送和游戏音频需在微信中体验。</p><small>浏览器试玩 · <a href="LICENSE">PolyForm Noncommercial 1.0.0</a></small>`:`<small>正式游戏代码 · 浏览器试玩</small><h1>方寸之间，<br>安放一座庭院。</h1><p>拖动方块，填满行、列或 3×3 九宫。</p><p>自由消除冲高分，目标闯关限步达标。落玉庭消除后下落，再接连锁。</p><p>首次练习可跳过，玩法说明可重看演示。</p><a href="?size=standard">标准屏</a><a href="?size=small">小屏</a><a href="?size=small&lab=1">关卡试验室</a><a href="daily-week.html">每日精选</a><a href="gravity.html">落玉庭</a><label id="lab-only" hidden>关卡试验（不保存进度）<select id="lab-level" aria-label="选择试验关卡"></select></label><p id="status" role="status"></p>${reviewAudio}<details><summary>分别试听全部十种音效</summary><p>初始音量使用游戏配置，可以自行调整播放器音量。</p>${audioSamples}</details><p class="toast" id="toast" role="status"></p><figure id="share-card" hidden><img alt="本局成绩分享卡片"><figcaption>仅预览卡片，实际发送请在微信中操作。</figcaption></figure><small>这里运行当前源码的游戏逻辑。进度仅保存在当前浏览器，与微信存档独立。微信好友榜和音效需在微信中体验。</small>`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>方寸九宫 · 浏览器试玩</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f2ed;color:#344e41;font:14px/1.7 -apple-system,"PingFang SC",sans-serif;display:flex;gap:32px;align-items:flex-start;justify-content:center}main{flex-shrink:0}#share-card img{width:100%;border-radius:14px}#share-card{margin:16px 0}canvas{display:block;border-radius:23px;box-shadow:0 10px 36px #344e4115;touch-action:none;background:#eeeadd}aside{width:290px;max-width:100%}h1{font:500 27px serif}p{color:#606e64}#lab-only:not([hidden]){display:block;margin-top:12px}select{padding:10px;border:1px solid #becabb;border-radius:10px;width:100%;background:#fff;color:#344e41}a{color:#386551;display:inline-block;margin:6px 10px 6px 0;padding:8px 12px;border:1px solid #becabb;border-radius:10px;text-decoration:none}small{font-size:12px;color:#637264}.toast{background:#386551;color:#fff;border-radius:12px;padding:8px;min-height:0}.toast:empty{display:none}@media(max-width:760px){body{display:block;padding:16px}aside{margin:20px auto}main{width:fit-content;max-width:100%;margin:auto}canvas{max-width:100%;height:auto!important}}</style><main><canvas id="game" aria-label="方寸九宫游戏画布"></canvas></main><aside>${sidebar}</aside><script>
document.querySelectorAll('audio[data-volume]').forEach(el=>el.volume=Number(el.dataset.volume));
document.querySelectorAll('audio').forEach(el=>el.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==el)other.pause();})));
const labMode=${site?"''":"new URLSearchParams(location.search).get('lab') || (location.pathname.endsWith('daily-week.html')?'daily':'')"};
const lab=labMode==='1'||labMode==='daily',memory={};
const small=new URLSearchParams(location.search).get('size')==='small',W=small?320:390,H=small?568:844;
const display=document.getElementById('game');display.style.width=W+'px';display.style.height=H+'px';let firstCanvas=true;
const handlers={},pointers=new Map();
const wx={getWindowInfo:()=>({windowWidth:W,windowHeight:H,pixelRatio:2,safeArea:{top:small?20:44,bottom:H-(small?20:34)}}),getMenuButtonBoundingClientRect:()=>({bottom:small?54:80}),
createCanvas:()=>{if(firstCanvas){firstCanvas=false;return display;}const card=document.createElement('canvas');card.toTempFilePathSync=()=>card.toDataURL('image/png');return card;},
createOffscreenCanvas:()=>document.createElement('canvas'),getStorageSync:k=>{if(lab)return memory[k]||(k==='fangcunChallengesV1'?{version:1,stars:Array(${LEVELS.length}).fill(3),active:null}:null);try{return JSON.parse(localStorage.getItem('${site?'moongateBlocksWeb:':'fangcunPreview:'}'+k));}catch(_){return null;}},setStorageSync:(k,v)=>{if(lab)memory[k]=JSON.parse(JSON.stringify(v));else localStorage.setItem('${site?'moongateBlocksWeb:':'fangcunPreview:'}'+k,JSON.stringify(v));},
shareAppMessage:o=>{const f=document.getElementById('share-card');f.hidden=false;f.querySelector('img').src=o.imageUrl;document.getElementById('toast').textContent='已生成分享卡片预览';},
showToast:o=>{document.getElementById('toast').textContent=o.title;}};
for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Show','Hide'])wx['on'+name]=fn=>handlers[name]=fn;
function point(e){const r=display.getBoundingClientRect();return {identifier:e.pointerId,clientX:(e.clientX-r.x)*W/r.width,clientY:(e.clientY-r.y)*H/r.height};}
display.addEventListener('pointerdown',e=>{e.preventDefault();display.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);handlers.TouchStart({touches:[...pointers.values()],changedTouches:[p]});});
display.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);handlers.TouchMove({touches:[...pointers.values()],changedTouches:[p]});});
for(const [event,handler] of [['pointerup','TouchEnd'],['pointercancel','TouchCancel']])display.addEventListener(event,e=>{const p=point(e);pointers.delete(e.pointerId);handlers[handler]({touches:[...pointers.values()],changedTouches:[p]});});
document.addEventListener('visibilitychange',()=>{const fn=document.hidden?handlers.Hide:handlers.Show;if(fn)fn();});
${bundleModules(modules)}
(function(){${game}
if(location.pathname.endsWith('/gravity.html')){
 openGravity();document.title='落玉庭 · 自由消除';
 document.querySelector('aside h1').textContent='消除、下落、再连锁。';
}
if(lab){
 document.getElementById('lab-only').hidden=false;
 const select=document.getElementById('lab-level');
 const dailyLab=labMode==='daily',levels=dailyLab?daily.WEEKLY_IDS.map(id=>challenges.level(id)):challenges.LEVELS;
 const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
 levels.forEach((level,i)=>{const option=document.createElement('option');option.value=String(level.id);option.textContent=dailyLab?weekdays[i]+' · '+level.title+' · '+level.difficulty+' · 三星'+level.par+'步':'第 '+(level.chapter+1)+' 章 · 第 '+level.number+' 关 '+level.title;select.append(option);});
 let selectedDate;
 if(dailyLab){
   const originalDateKey=daily.dateKey;
   daily.dateKey=now=>originalDateKey(now===undefined?selectedDate:now);
   document.title='方寸九宫 · 7道新每日挑战试玩';
   document.querySelector('aside h1').textContent='每日一题，多想一步。';
 }
 function openLabLevel(){
   releaseStaleTouches();sceneTransition=null;state.transitionAlpha=0;
   if(!dailyLab){startChallenge(Number(select.value));return;}
   const first=Date.parse(daily.WEEKLY_FROM+'T04:00:00Z');
   const monday=first+(8-new Date(first).getUTCDay())%7*86400000;
   selectedDate=monday+daily.WEEKLY_IDS.indexOf(Number(select.value))*86400000;
   openDaily();startDaily();
 }
 select.addEventListener('change',openLabLevel);
 openLabLevel();
}
setInterval(()=>{const s=state.screen==='menu'?'首页':state.screen==='maps'?'选择棋盘':state.screen==='levels'?'关卡地图':state.screen==='daily'?'每日精选':state.screen==='invitation'?'好友挑战':state.screen==='collection'?'我的庭院':state.gameOver?(state.challenge&&state.challenge.won?'挑战成功':'本局结束'):'对局中';document.getElementById('status').textContent='当前：'+(state.homeMode==='challenge'?'闯关挑战':'清雅庭院')+' · '+s+(state.screen==='playing'?' · '+state.score+' 分':'');},200);
})();</script></html>`;
const output=path.join(root,site?'dist/browser':'docs/previews');
fs.mkdirSync(output,{recursive:true});
for(const file of site?['index.html']:['playable.html','daily-week.html','gravity.html'])fs.writeFileSync(path.join(output,file),html);
if(site)fs.copyFileSync(path.join(root,'LICENSE'),path.join(output,'LICENSE'));
console.log('Built '+(site?'dist/browser/index.html and LICENSE':'playable.html, daily-week.html and gravity.html')+' from actual game sources');
