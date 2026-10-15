const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { MODE_ORDER, MODES, COLORS } = require('../js/config');
const { createLayout } = require('../js/views/layout');
const { getRankingButton, getMenuActions } = require('../js/renderer');
const clone = value => JSON.parse(JSON.stringify(value));
const labels = [], reads = [], writes = [], friends = [];
let receive;
const ctx = new Proxy({}, { get: (o, k) => k === 'fillText' ? text => labels.push(text) : o[k] || (() => {}), set: (o,k,v) => (o[k]=v,true) });
const scope = vm.createContext({wx: {
  getSharedCanvas: () => ({getContext: () => ctx}), onMessage: fn => {receive=fn;},
  getUserCloudStorage: o => reads.push(o), setUserCloudStorage: o => writes.push(o),
  getFriendCloudStorage: o => friends.push(o)
}});
vm.runInContext(fs.readFileSync('open-data/index.js','utf8'),scope);
const key = MODES.easy.bestKey, other = MODES.long.bestKey;
const value = score => JSON.stringify({wxgame:{score}});
receive({type:'sync',scores:{[key]:100,[other]:50,bad:900}});
receive({type:'sync',scores:{[key]:200}});
assert.equal(reads.length,1); // Writes are serialized; a newer score waits.
reads.shift().success({KVDataList:[{key,value:value(150)}]});
assert.deepStrictEqual(clone(writes[0].KVDataList).map(x=>x.key),[other]);
writes.shift().success();
reads.shift().success({KVDataList:[{key,value:value(150)}]});
assert.equal(JSON.parse(writes[0].KVDataList[0].value).wxgame.score,200);
writes.shift().success();
function show(k){receive({type:'show',key:k,width:280,height:320,colors:COLORS});}
show(key);show(other);
assert.deepStrictEqual(clone(friends[1].keyList),[other]);
friends[0].success({data:[{nickname:'wrong-map',KVDataList:[{key,value:value(999)}]}]});
assert.ok(!labels.includes('wrong-map'));
const data=Array.from({length:18},(_,i)=>({nickname:'玩家'+i,KVDataList:[{key:other,value:value(i===0?17:i)}]}));
data.push({nickname:'坏数据',KVDataList:[{key:other,value:'not json'}]});
friends[1].success({data});
assert.equal(vm.runInContext('rows.length',scope),18);
assert.deepStrictEqual(clone(vm.runInContext('rows.slice(0,3).map(r=>r.rank)',scope)),[1,1,3]);
assert.ok(!labels.includes('坏数据'));
for(let i=0;i<20;i++)receive({type:'page',delta:1});
assert.equal(vm.runInContext('page',scope),3);
for(let i=0;i<20;i++)receive({type:'page',delta:-1});
assert.equal(vm.runInContext('page',scope),0);
show(key);const late=friends.at(-1);receive({type:'hide'});late.success({data:[]});
assert.equal(vm.runInContext('view',scope),null);
// Failed cloud reads never overwrite a possibly higher cloud score; retry later.
receive({type:'sync',scores:{[key]:250}});reads.shift().fail();assert.equal(writes.length,0);
show(key);reads.shift().success({KVDataList:[{key,value:value(300)}]});
assert.equal(writes.length,0);friends.at(-1).fail();assert.ok(labels.includes('加载失败，请点下方重试 / 刷新'));

const ranking=require('../js/platform/leaderboard');
const posts=[],toasts=[];let granted=false, settingOpened=0;
const api={getOpenDataContext:()=>({canvas:{},postMessage:m=>posts.push(m)}),
 getSetting:o=>o.success({authSetting:{'scope.WxFriendInteraction':granted}}),
 openSetting:o=>{settingOpened++;o.success({authSetting:{'scope.WxFriendInteraction':granted}})},
 authorize:o=>o.success(),showToast:o=>toasts.push(o)};
const layout=createLayout(390,844,{top:44,bottom:810},null);
ranking.open(api,layout,'easy',{easy:100,long:88});assert.equal(settingOpened,1);
assert.ok(!posts.some(p=>p.type==='show'));
granted=true;
function tap(name){const r=ranking.actions(layout)[name];ranking.hit({x:r.x+1,y:r.y+1},layout).action();}
tap('refresh');assert.equal(posts.at(-1).key,key);
const seen=[posts.at(-1).key];for(let i=1;i<MODE_ORDER.length;i++){tap('nextMap');seen.push(posts.at(-1).key);}
assert.equal(new Set(seen).size,3);assert.deepStrictEqual(seen,MODE_ORDER.map(id=>MODES[id].bestKey));
tap('close');assert.equal(ranking.isOpen(),false);
// A challenge invitation can dismiss the overlay while authorization is pending.
let pendingPermission;
ranking.open({ ...api, getSetting: request => { pendingPermission=request; } }, layout, 'easy', {easy:100});
assert.equal(ranking.isOpen(),true);
ranking.close(api);assert.equal(ranking.isOpen(),false);assert.equal(posts.at(-1).type,'hide');
ranking.open(api,layout,'easy',{easy:100});const beforeLatePermission=posts.length;
pendingPermission.success({authSetting:{'scope.WxFriendInteraction':true}});
assert.equal(posts.length,beforeLatePermission,'closing invalidates permission callbacks even after reopening');
ranking.close(api);assert.equal(ranking.isOpen(),false);
for(const [w,h] of [[320,568],[375,667],[390,844],[430,932]]){
 const l=createLayout(w,h,{top:20,bottom:h},null),a=ranking.actions(l),button=getRankingButton(l);
 assert.ok(button.y+button.height<=h);
 assert.ok(a.list.height>=100);assert.ok(a.list.y+a.list.height<=a.previousPage.y);
 assert.ok(a.close.y+a.close.height<=h);
}
assert.equal(JSON.parse(fs.readFileSync('game.json')).openDataContext,'open-data');
console.log('Leaderboard checks passed: map isolation, sync max/retry, races, ties, pages, permission and small screens');
