// Exercise the actual preview bundle with DOM/canvas fakes, without a browser.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const G=require('../docs/prototypes/gravity/engine');
require('./build-gravity-preview');
const listeners={},elements={},store={},raf=new Map();let sequence=0,hidden=false;
const context=new Proxy({}, {get:(obj,k)=>obj[k]||(()=>{}),set:(obj,k,v)=>(obj[k]=v,true)});
for(const id of ['board','mode','status','metrics','undo','retry','next','storage'])elements[id]={textContent:'',hidden:false,disabled:false,value:'',add(){},addEventListener:(event,fn)=>listeners[id+':'+event]=fn,getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,width:360,height:490}),setPointerCapture(){}};
const sandbox=vm.createContext({console,performance:{now:()=>100},matchMedia:()=>({matches:false}),Option:function(){},document:{querySelector:selector=>elements[selector.slice(1)],get hidden(){return hidden;},addEventListener:(event,fn)=>listeners[event]=fn},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},requestAnimationFrame:fn=>{raf.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>raf.delete(id)});
const html=fs.readFileSync(path.join(__dirname,'../docs/prototypes/gravity/lab.html'),'utf8');
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],sandbox);
const run=s=>vm.runInContext(s,sandbox),pointer=(event,x,y,id=7)=>listeners['board:'+event]({clientX:x,clientY:y,pointerId:id});
function tap(x,y){pointer('pointerdown',x,y);pointer('pointerup',x,y);}
function place(slot,c,r){tap(60+slot*118,420);tap(18+c*36+10,14+r*36+10);}
function finish(){for(let time=500;raf.size&&time<10000;time+=500){const callbacks=[...raf.values()];raf.clear();callbacks.forEach(fn=>fn(time));}}
for(const p of G.PUZZLES){
 run(`open(${p.id},true)`);
 for(const [slot,c,r] of p.solution){place(slot,c,r);finish();}
 assert.equal(run('state.won'),true,p.title);assert.equal(elements.next.hidden,false);
 const saved=JSON.parse(store['fangcunGravityPreviewV1:'+p.id]);assert.ok(G.restore(saved).won);
 elements.undo.onclick();assert.equal(run('state.undoUsed'),true);assert.equal(run('state.won'),false);
}
run('open(2,true)');place(0,3,8);assert.ok(run('animation'));assert.equal(elements.undo.disabled,true);
// Stable board was already committed before the visual chain began.
assert.equal(G.restore(JSON.parse(store['fangcunGravityPreviewV1:2'])).won,true);
hidden=true;listeners.visibilitychange();assert.equal(run('animation'),null);assert.equal(run('state.won'),true);assert.equal(raf.size,0);
run('open(0,true)');pointer('pointerdown',60,420);pointer('pointerdown',180,420,9);assert.equal(run('selected'),0);
pointer('pointercancel',60,420);assert.equal(run('gesture'),null);assert.equal(run('state.moves.length'),0);
// Drag a horizontal three-cell shape onto the bottom gap, compensating finger lift.
pointer('pointerdown',60,420);pointer('pointermove',18+4.5*36,14+8.5*36+38);pointer('pointerup',18+4.5*36,14+8.5*36+38);finish();assert.equal(run('state.won'),true);
run("open('free',true)");elements.retry.onclick();assert.equal(run('state.moves.length'),0);
console.log('PASS: built preview loads, all six puzzles via real controller events, drag/tap, animation save, hide, multi-touch and undo controls');
