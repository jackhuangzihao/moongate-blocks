const assert=require('assert');
const {boot,clone}=require('./helpers/game-harness');
const {celebration}=require('../js/views/art');
const {createLayout}=require('../js/views/layout');
const {MODES}=require('../js/config');
const {drawResultBoard}=require('../js/views/board-view');
const C=require('../js/challenge/challenges'),B=require('../js/rules/board');

// Drive legal moves to failure; rendering a recap must not change board, save or input targets.
for(const size of [{w:320,h:568},{w:390,h:844}]){
 const app=boot({fangcunTutorialSeen:true},{size});app.run('startChallenge(12);state.mechanicGuide=null');
 let run=app.run('state.challenge');
 while(!run.ended){
  let next=null;
  for(let slot=0;slot<3&&!next;slot++)if(run.tray[slot])for(let r=0;r<9&&!next;r++)for(let c=0;c<9&&!next;c++)if(B.canPlace(run.board,run.tray[slot],c,r))next=[slot,c,r];
  assert(next);app.move(next);run=app.run('state.challenge');
 }
 assert.equal(run.won,false,'greedy fixture fails rather than completes');
 const before=clone(app.run('state')),saved=clone(app.store),labels=app.draw();
 assert(labels.some(t=>t.text==='本关回顾'));assert(labels.some(t=>t.text==='请朋友解题'));
 assert(labels.some(t=>t.text.includes('初始棋盘')));
 assert(!labels.some(t=>t.text.includes('视频')),'unconfigured ad buttons stay absent');
 assert.deepStrictEqual(clone(app.run('state')),before);assert.deepStrictEqual(app.store,saved);
 for(const item of labels)assert(item.x>=0&&item.x<=size.w&&item.y>=0&&item.y<=size.h,'result labels fit screen');
 const actions=app.run('getGameOverActions(layout,state)');
 assert(labels.filter(t=>t.text==='请朋友解题').every(t=>t.y>=actions.share.y&&t.y<=actions.share.y+actions.share.height));
}

// Small recap tiles and symbols must remain valid Canvas dimensions and read-only.
const app=boot();app.run('startChallenge(24);state.mechanicGuide=null');
const snapshot=clone(app.run('state')),layout=createLayout(320,568,null,null,MODES.easy);
const ctx=new Proxy({}, {get:(o,k)=>k==='arc'?(x,y,r)=>assert(r>=0):k==='roundRect'?(x,y,w,h)=>assert(w>=0&&h>=0):o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
drawResultBoard(ctx,layout,snapshot,{x:20,y:160,width:280,height:90});
assert.deepStrictEqual(snapshot,clone(app.run('state')));
let paths=0;const fx=new Proxy({}, {get:(o,k)=>k==='beginPath'?()=>paths++:()=>{}});
for(const p of [undefined,NaN,0,1,2])celebration(fx,{x:0,y:0,width:300,height:200},p,true);
assert.equal(paths,0,'idle or finished effects do no drawing');
celebration(fx,{x:0,y:0,width:300,height:200},.5,true);assert(paths>0&&paths<=25,'effect work stays bounded');
console.log('PASS: legal failure recap, compact labels, unchanged state/saves and bounded celebration');
