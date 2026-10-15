// Canvas artwork mirrors the vector illustrations in the approved direction preview.
function oval(ctx,x,y,rx,ry,color) {
  ctx.save(); ctx.translate(x,y); ctx.scale(rx,ry); ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill(); ctx.restore();
}
function star(ctx,x,y,r,color) {
  ctx.fillStyle=color; ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.45:r;
    if(i)ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad);else ctx.moveTo(x,y-r);}
  ctx.closePath();ctx.fill();
}
// 庭院收藏的物件都画在同一套 300×190 坐标里；decor 是已解锁物件的 id 列表。
function stroke(ctx,color,width,points) {
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
}
function leaf(ctx,x,y,rx,ry,angle,color) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);oval(ctx,0,0,rx,ry,color);ctx.restore();
}
function bamboo(ctx) {
  [[256,178,86,'#7f9c6b'],[270,178,62,'#6d8b5d'],[283,178,98,'#86a374']].forEach(([x,bottom,top,color])=>{
    stroke(ctx,color,3.4,[[x,bottom],[x,top]]);
    for(let y=bottom-16;y>top+6;y-=17)stroke(ctx,'#c9d6b6',1.4,[[x-1.8,y],[x+1.8,y]]);
  });
  [[248,92,-.5],[262,80,.45],[276,66,-.4],[291,102,.5],[250,120,-.35],[288,78,.3],[265,104,.55]].forEach(([x,y,a],i)=>
    leaf(ctx,x,y,9,2.3,a,i%2?'#7fa37f':'#5f8a66'));
}
function pine(ctx) {
  ctx.strokeStyle='#8a6f55';ctx.lineWidth=5.5;ctx.lineCap='round';ctx.beginPath();
  ctx.moveTo(30,178);ctx.quadraticCurveTo(22,128,38,96);ctx.quadraticCurveTo(52,68,82,44);ctx.stroke();
  ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(34,118);ctx.quadraticCurveTo(22,106,16,99);ctx.stroke();
  [[19,96,14,6,'#4f7a5e'],[40,82,20,8,'#5c8768'],[58,62,19,7,'#4f7a5e'],[80,42,20,8,'#5c8768'],[92,35,10,4,'#6d9676']].forEach(p=>oval(ctx,...p));
}
function plum(ctx) {
  [[110,66],[126,56],[149,45],[167,53],[186,72],[178,92],[106,90],[137,70],[161,70],[121,82],[190,86],[155,58]].forEach(([x,y],i)=>{
    oval(ctx,x,y,3.1,3.1,i%3?'#e39ea6':'#eeb7bc');oval(ctx,x,y,1.1,1.1,'#fbe7d8');
  });
}
function lotus(ctx) {
  ctx.fillStyle='#7d8e97';ctx.beginPath();ctx.moveTo(77,152);ctx.lineTo(107,152);ctx.quadraticCurveTo(108,172,101,178);ctx.lineTo(83,178);ctx.quadraticCurveTo(76,172,77,152);ctx.fill();
  stroke(ctx,'#9aabb3',1.5,[[80,163],[104,163]]);
  oval(ctx,92,152,16,3.6,'#93a4ac');oval(ctx,92,152,13,2.4,'#5e7469');
  stroke(ctx,'#6a8f6e',1.6,[[92,151],[93,134]]);
  leaf(ctx,84,147,9,3.4,-.25,'#6a9275');leaf(ctx,101,145,8,3,.3,'#7fa586');
  ctx.fillStyle='#e8a2aa';[[-5,2],[0,0],[5,2]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(93+dx,136+dy);ctx.quadraticCurveTo(93+dx*1.6-3,128+dy,93+dx,122+dy+Math.abs(dx));ctx.quadraticCurveTo(93+dx*1.6+3,128+dy,93+dx,136+dy);ctx.fill();});
}
function lamp(ctx) {
  // 底座藏在山石后面，只露出灯身。
  ctx.fillStyle='#8f9486';ctx.fillRect(204,163,16,6);ctx.fillRect(209,146,6,18);
  ctx.fillStyle='#a8ac9d';ctx.fillRect(205,135,14,12);
  ctx.fillStyle='#f2d487';ctx.fillRect(208,138,8,7);
  ctx.fillStyle='#8f9486';ctx.beginPath();ctx.moveTo(199,135);ctx.quadraticCurveTo(212,124,225,135);ctx.closePath();ctx.fill();
  oval(ctx,212,125.5,2.4,2.4,'#8f9486');
}
function lantern(ctx) {
  stroke(ctx,'#8a3f33',1.2,[[150,14],[150,19]]);
  ctx.fillStyle='#8a3f33';ctx.fillRect(146,18,8,2.5);ctx.fillRect(146,35.5,8,2.5);
  oval(ctx,150,27,8,9,'#c95a4b');
  stroke(ctx,'#b04a3d',1,[[150,19],[150,36]]);
  stroke(ctx,'#d9a24a',1.4,[[150,38],[150,45]]);
}
function swallows(ctx) {
  // 月门上方没有留白，燕子画在门内的天空里，飞着比站着更不挡画面。
  [[113,44,1],[129,31,.8]].forEach(([x,y,k])=>{
    ctx.save();ctx.translate(x,y);ctx.scale(k,k);
    ctx.strokeStyle='#4f5550';ctx.lineWidth=1.8;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(-9,-1);ctx.quadraticCurveTo(-4,-5,0,0);ctx.quadraticCurveTo(4,-5,9,-1);ctx.stroke();
    oval(ctx,0,.6,1.8,1.4,'#4f5550');
    ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-1,2);ctx.lineTo(-2.2,5.2);ctx.moveTo(1,2);ctx.lineTo(2.2,5.2);ctx.stroke();
    ctx.restore();
  });
}
function moonGlow(ctx) {
  ctx.save();ctx.beginPath();ctx.moveTo(69,178);ctx.lineTo(69,95);ctx.arc(150,95,81,Math.PI,0);ctx.lineTo(231,178);ctx.clip();
  oval(ctx,198,57,31,31,'#f7efd6');oval(ctx,198,57,26,26,'#f3e6c0');ctx.restore();
  oval(ctx,198,57,21,21,'#efd99a');oval(ctx,191,52,4,4,'#e5cc88');oval(ctx,204,63,3,3,'#e5cc88');
  [[92,40],[118,26],[172,24],[224,86]].forEach(([x,y])=>oval(ctx,x,y,1.3,1.3,'#e2c883'));
}
function arbour(ctx) {
  // 花架在月门右侧，竹梢仍留在架顶上方。
  stroke(ctx,'#a18a6c',3,[[249,181],[249,134],[293,134],[293,181]]);
  stroke(ctx,'#b4a082',2,[[247,129],[295,129]]);
  for(const x of [258,270,282])stroke(ctx,'#b9aa91',1.3,[[x,137],[x,176]]);
  for(const y of [148,161,174])stroke(ctx,'#b9aa91',1.3,[[251,y],[291,y]]);
  [[252,135],[262,131],[273,134],[287,132],[293,142]].forEach(([x,y],i)=>{
    leaf(ctx,x,y,8,3.3,i%2?.5:-.4,'#87a185');
    stroke(ctx,'#7e9775',1.1,[[x,y],[x-1,y+15]]);
    for(let k=0;k<3;k++)oval(ctx,x-1,y+6+k*4,3.3-k*.6,2.7,'#c6a4bd');
  });
}
function plaque(ctx) {
  ctx.fillStyle='#79694f';ctx.fillRect(121,5,58,16);
  ctx.strokeStyle='#cbb382';ctx.lineWidth=1;ctx.strokeRect(124,8,52,10);
  ctx.fillStyle='#f2dfb2';ctx.textAlign='center';ctx.font='8px serif';ctx.fillText('庭间皆景',150,16);
}
function chime(ctx) {
  stroke(ctx,'#928977',1,[[229,81],[229,95]]);
  ctx.fillStyle='#8aa9a1';ctx.beginPath();ctx.moveTo(221,102);ctx.quadraticCurveTo(221,87,229,90);ctx.quadraticCurveTo(237,91,237,102);ctx.closePath();ctx.fill();
  oval(ctx,229,102,8,2,'#6f9288');
  stroke(ctx,'#9c9176',1,[[229,102],[228,116]]);
  ctx.fillStyle='#e0d2b0';ctx.beginPath();ctx.moveTo(225,113);ctx.lineTo(231,114);ctx.lineTo(229,128);ctx.lineTo(224,126);ctx.closePath();ctx.fill();
}
function keyCharm(ctx) {
  stroke(ctx,'#947b5b',1.2,[[73,94],[73,106]]);
  ctx.strokeStyle='#b59452';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(73,112,5,0,Math.PI*2);ctx.stroke();
  stroke(ctx,'#b59452',2.5,[[73,117],[73,133],[78,133],[78,129]]);
  stroke(ctx,'#b59452',2.5,[[73,125],[77,125]]);
}
function bridge(ctx) {
  oval(ctx,150,184,49,5,'#b7cfcb');
  ctx.strokeStyle='#a58d6e';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(113,184);ctx.quadraticCurveTo(150,165,187,184);ctx.stroke();
  ctx.strokeStyle='#bca17c';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(114,175);ctx.quadraticCurveTo(150,156,186,175);ctx.stroke();
  [[116,176,183],[132,169,177],[150,166,175],[168,169,177],[184,176,183]].forEach(([x,top,bottom])=>stroke(ctx,'#b09877',2,[[x,top],[x,bottom]]));
}
function garden(ctx,rect,decor=[],reveal=null,growth=null) {
  const has=id=>Array.isArray(decor)&&decor.includes(id);
  const item=(id,draw)=>{
    const growing=growth && growth.item.id===id && !growth.complete;
    if(!has(id) && !growing)return;
    if(growing){
      // An outline locates the future ornament; the solid portion shows its stage.
      ctx.save();ctx.globalAlpha*=.13;draw(ctx);ctx.restore();
      ctx.save();
      const bounds={bamboo:[62,181],pine:[30,181],plum:[40,98],lotus:[122,179],lamp:[123,170],lantern:[14,47],swallows:[24,50],moon:[24,90],arbour:[128,184],plaque:[5,21],chime:[81,130],bridge:[156,190],keyCharm:[94,135]};
      const [top,bottom]=bounds[id]||[0,190],fraction=growth.stage===0?.28:.65;
      ctx.beginPath();ctx.rect(0,bottom-(bottom-top)*fraction,300,(bottom-top)*fraction);ctx.clip();
      draw(ctx);ctx.restore();return;
    }
    const animated=reveal&&reveal.ids.includes(id),p=animated?1-Math.pow(1-reveal.progress,3):1;
    ctx.save();ctx.globalAlpha*=p;ctx.translate(0,(1-p)*12);draw(ctx);ctx.restore();
  };
  const scale=Math.min(rect.width/300,rect.height/190);
  ctx.save();ctx.translate(rect.x+(rect.width-300*scale)/2,rect.y+(rect.height-190*scale)/2);ctx.scale(scale,scale);
  item('bamboo',bamboo);
  ctx.fillStyle='#e1e1ca';ctx.beginPath();ctx.moveTo(56,178);ctx.lineTo(56,95);ctx.arc(150,95,94,Math.PI,0);ctx.lineTo(244,178);ctx.fill();
  ctx.fillStyle='#faf8f0';ctx.beginPath();ctx.moveTo(69,178);ctx.lineTo(69,95);ctx.arc(150,95,81,Math.PI,0);ctx.lineTo(231,178);ctx.fill();
  if(has('moon') || growth && growth.item.id==='moon')item('moon',moonGlow);else oval(ctx,198,57,21,21,'#dfc891');
  ctx.fillStyle='#d6ddca';ctx.beginPath();ctx.moveTo(70,157);ctx.quadraticCurveTo(125,100,166,139);ctx.quadraticCurveTo(204,161,230,124);ctx.lineTo(230,178);ctx.lineTo(70,178);ctx.fill();
  oval(ctx,147,172,56,7,'#c3c5af');
  ctx.strokeStyle='#6c7a56';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(140,146);ctx.quadraticCurveTo(159,105,143,73);ctx.moveTo(147,115);ctx.lineTo(176,90);ctx.moveTo(147,103);ctx.lineTo(118,81);ctx.stroke();
  [[122,69,35,17],[158,61,36,21],[178,86,33,16],[111,89,27,13]].forEach(p=>oval(ctx,...p,'#6a9275'));
  [[143,50,28,11],[180,76,23,9]].forEach(p=>oval(ctx,...p,'#85a18a'));
  item('plum',plum);
  ctx.fillStyle='#a38d70';ctx.beginPath();ctx.moveTo(112,141);ctx.lineTo(179,141);ctx.lineTo(171,166);ctx.lineTo(120,166);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c0aa88';ctx.fillRect(108,138,75,8);
  item('lamp',lamp);
  oval(ctx,202,168,17,8,'#9fa99b');oval(ctx,213,165,10,6,'#bbc1af');
  item('lotus',lotus);
  item('plaque',plaque);
  item('lantern',lantern);
  item('pine',pine);
  item('swallows',swallows);
  item('arbour',arbour);
  item('chime',chime);
  item('bridge',bridge);
  item('keyCharm',keyCharm);
  if(reveal){
    const centers={bamboo:[270,112],plum:[150,67],lotus:[92,150],pine:[48,85],lamp:[212,141],lantern:[150,29],swallows:[120,39],moon:[198,57],arbour:[271,151],plaque:[150,13],chime:[229,105],bridge:[150,177],keyCharm:[73,120]};
    ctx.save();ctx.globalAlpha*=Math.sin(Math.PI*reveal.progress)*.5;ctx.strokeStyle='#B38C46';ctx.lineWidth=1.3;
    reveal.ids.forEach(id=>{const p=centers[id];if(p){ctx.beginPath();ctx.arc(p[0],p[1],16+reveal.progress*10,0,Math.PI*2);ctx.stroke();}});ctx.restore();
  }
  ctx.restore();
}
function path(ctx,rect,level=1) {
  const scale=Math.min(rect.width/300,rect.height/190);
  ctx.save();ctx.translate(rect.x+(rect.width-300*scale)/2,rect.y+(rect.height-190*scale)/2);ctx.scale(scale,scale);
  ctx.strokeStyle='#c6d6f0';ctx.lineWidth=29;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(40,175);ctx.bezierCurveTo(53,83,142,133,174,111);ctx.quadraticCurveTo(226,97,236,28);ctx.stroke();
  ctx.strokeStyle='#fff';ctx.lineWidth=3;if(ctx.setLineDash)ctx.setLineDash([5,8]);ctx.stroke();if(ctx.setLineDash)ctx.setLineDash([]);
  [[67,132],[131,107],[206,88]].forEach(([x,y],i)=>{oval(ctx,x,y,i===2?32:26,i===2?32:26,'#fff');oval(ctx,x,y,i===2?26:21,i===2?26:21,i===2?'#edb451':'#82aa96');ctx.fillStyle=i===2?'#765117':'#fff';ctx.font='600 18px sans-serif';ctx.textAlign='center';ctx.fillText(String(i===2?level:level-2+i>0?level-2+i:'·'),x,y+6);});
  ctx.strokeStyle='#4365b9';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(244,28);ctx.lineTo(244,4);ctx.lineTo(269,11);ctx.lineTo(244,20);ctx.stroke();
  star(ctx,158,35,13,'#e8ac62');star(ctx,242,158,11,'#e8ac62');ctx.restore();
}
module.exports={garden,path,star};
