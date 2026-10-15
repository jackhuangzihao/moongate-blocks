const assert=require('assert');
const {boot}=require('./helpers/game-harness');
function open(size={w:320,h:568}){
  const app=boot({}, {size});
  app.run("state.screen='levels';state.levelChapter=0;state.levelScroll=0");
  return app;
}
function point(x,y,id=8){return {clientX:x,clientY:y,identifier:id};}
function event(app,name,p,touches=name==='TouchEnd'?[]:[p]){app.handlers[name]({touches,changedTouches:[p]});}
function card(app,id=0){const r=app.run(`getLevelActions(layout,0,state.levelScroll)[${id}]`);return point(r.x+r.width/2,r.y+r.height/2);}
for(const size of [{w:320,h:568},{w:390,h:844},{w:430,h:932}]){
  const app=open(size),p=card(app),end=point(p.clientX,p.clientY-60);
  event(app,'TouchStart',p);assert.ok(app.run('pressAnimation'));
  event(app,'TouchMove',end);assert.equal(app.run('pressAnimation'),null);
  assert.equal(app.run('state.levelScroll'),Math.min(60,app.run('getLevelViewport(layout,0).maxScroll')));
  event(app,'TouchEnd',end);app.settle();assert.equal(app.run('state.screen'),'levels');assert.equal(app.notices.length,0);
  // Drag from the gap too; never overscroll either boundary.
  const view=app.run('getLevelViewport(layout,0)'),r=app.run('getLevelActions(layout,0,0)[0]');
  const gap=point(r.x+r.width+5,view.y+30);
  event(app,'TouchStart',gap);event(app,'TouchMove',point(gap.clientX,-2000));
  assert.equal(app.run('state.levelScroll'),view.maxScroll);
  event(app,'TouchEnd',point(gap.clientX,-2000));
  event(app,'TouchStart',gap);event(app,'TouchEnd',point(gap.clientX,3000));
  assert.equal(app.run('state.levelScroll'),0);
  // The clipped last row must not react in the fixed footer.
  app.tap({x:view.x,y:view.y+view.height+2,width:view.width,height:10});app.settle();
  assert.equal(app.notices.length,0);assert.equal(app.run('state.screen'),'levels');
  // A small finger jitter is still a deliberate tap.
  event(app,'TouchStart',p);event(app,'TouchMove',point(p.clientX+2,p.clientY+2));
  event(app,'TouchEnd',point(p.clientX+2,p.clientY+2));app.settle();
  assert.equal(app.run('state.challenge.level'),0);
}
{
 const app=open(),p=card(app),other=point(p.clientX,p.clientY,9);
 event(app,'TouchStart',p);event(app,'TouchStart',other,[p,other]);
 event(app,'TouchEnd',other,[p]);event(app,'TouchCancel',other,[p]);
 assert.equal(app.run('levelScrollGesture.touchId'),8);
 // Horizontal drags cancel taps too, even when still inside the same card.
 event(app,'TouchMove',point(p.clientX+12,p.clientY));event(app,'TouchEnd',p);app.settle();
 assert.equal(app.run('state.screen'),'levels');assert.equal(app.run('state.levelScroll'),0);
 event(app,'TouchStart',p);app.handlers.Hide();assert.equal(app.run('levelScrollGesture'),null);
 assert.equal(app.run('pressAnimation'),null);app.handlers.Show({});
 event(app,'TouchStart',p);event(app,'TouchCancel',p);assert.equal(app.run('levelScrollGesture'),null);
 // Lost touchend: a new sole finger recovers rather than leaving the list stuck.
 event(app,'TouchStart',p);event(app,'TouchStart',other);assert.equal(app.run('levelScrollGesture.touchId'),9);
 event(app,'TouchEnd',point(other.clientX,other.clientY-80,9));app.settle();
 assert.equal(app.run('state.screen'),'levels');assert.ok(app.run('state.levelScroll')>0);
 app.tap(app.run('getChapterActions(layout)[1]'));assert.equal(app.run('state.levelChapter'),1);assert.equal(app.run('state.levelScroll'),0);
 app.draw();app.run('pendingPresents=0;sceneDirty=false;stepAnimations(Date.now()+5000)');
 assert.equal(app.run('pendingPresents'),0,'a resting list should not keep redrawing');
}
console.log('PASS: vertical list bounds, fixed headers/footer, drag-vs-tap, gaps, multi-touch, background/cancel recovery and idle rendering');
