const assert=require('assert'),K=require('../js/progression/collection'),{boot}=require('./helpers/game-harness');
for(const item of K.ITEMS){
 for(const [fraction,stage] of [[0,0],[.49,0],[.5,1],[.99,1],[1,2],[2,2]]){
  const n=Math.floor(item.need*fraction),data=K.normalize({version:1,clears:n,target:item.id,chapterCounts:{[item.id]:Math.min(n,item.need)},dailyCompletions:n});
  const before=JSON.stringify(data),g=K.growth(data,n);
  assert.equal(g.stage,n>=item.need?2:n/item.need>=.5?1:0);assert.ok(g.ratio>=0&&g.ratio<=1);
  assert.equal(g.complete,n>=item.need);assert.equal(JSON.stringify(data),before,'growth does not award or mutate');
 }
}
const data=K.normalize({version:1,clears:12,target:'plum',seen:['bamboo']});
assert.equal(K.growthResult(data,0,5).text,'梅花 7 → 12/20 · 渐渐成形');
assert.equal(K.growthResult(data,0,-1),null);assert.equal(K.growthResult(data,0,0),null);
assert.equal(K.growthResult({...data,clears:20},0,4).complete,true);
assert.equal(K.growth({...data,clears:9},0).stage,0,'undo can roll back the displayed stage');
assert.equal(K.growthResult({...data,target:'lamp'},0,5),null,'unrelated goals do not claim gain');
for(const size of [{w:320,h:568},{w:390,h:844}]){
 const app=boot({[K.KEY]:data},{size});
 assert.ok(app.draw().some(x=>x.text.includes('渐渐成形')));
 app.run("state.screen='playing';state.challenge=null;state.gameOver=true;state.gameOverProgress=1;state.sessionClears=5;state.maxCombo=1");
 assert.ok(app.draw().some(x=>x.text==='梅花 7 → 12/20 · 渐渐成形'));
 app.run('state.savePending=true');assert.ok(app.draw().some(x=>x.text==='进度待保存，请稍候再退出'));
 app.run("state.collection.clears=20;refreshDecor(false);openCollection()");
 assert.ok(app.run("state.decor.includes('plum')"));
 assert.equal(app.run('state.collection.target'),null,'completed target acknowledgement retained');
}
console.log('PASS: all collection stages are derived, undo-safe, capped and mutation-free; actual home/results and save warnings');
