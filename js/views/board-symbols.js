// Shared by the playing board, rule examples and help cards.
const { roundedRect, text } = require('./canvas-ui');

// The goal card and board share the same target icon.
function drawTarget(ctx,x,y,size) {
  ctx.fillStyle='#9AACCE';roundedRect(ctx,x,y,size,size,4);ctx.fill();
  ctx.strokeStyle='#354F7E';ctx.lineWidth=1.7;ctx.beginPath();
  ctx.moveTo(x+size*.35,y+size*.22);ctx.lineTo(x+size*.65,y+size*.5);ctx.lineTo(x+size*.35,y+size*.78);ctx.stroke();
}
function drawFlower(ctx,x,y,size,remaining) {
  ctx.fillStyle=remaining?'#D6E6D4':'#FAE3D8';roundedRect(ctx,x,y,size,size,Math.min(7,size/4));ctx.fill();
  ctx.strokeStyle='#587854';ctx.lineWidth=1.2;ctx.stroke();
  const cx=x+size*.5,cy=y+size*.46;
  ctx.strokeStyle='#587854';ctx.beginPath();ctx.moveTo(cx,y+size*.78);ctx.lineTo(cx,cy);ctx.stroke();
  if(remaining){
    ctx.fillStyle='#668C64';ctx.beginPath();ctx.ellipse(cx-size*.09,cy,size*.13,size*.23,-.6,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+size*.09,cy,size*.13,size*.23,.6,0,Math.PI*2);ctx.fill();
  } else {
    ctx.fillStyle='#CA7E87';
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*size*.16,cy+Math.sin(a)*size*.16,size*.12,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#EDC46B';ctx.beginPath();ctx.arc(cx,cy,size*.1,0,Math.PI*2);ctx.fill();
  }
  if(size>=14){
    const w=Math.max(10,size*.43),h=Math.max(10,size*.31),bx=x+size-w-1,by=y+size-h-1;
    ctx.fillStyle='#FAF8F0';roundedRect(ctx,bx,by,w,h,3);ctx.fill();
    text(ctx,remaining?String(remaining):'✓',bx+w/2,by+h*.79,Math.max(9,size*.3),'#386551','center','600');
  }
}

// 钥匙与门共用字母配对，形状也有区别，避免只靠颜色识别机关。
function drawKey(ctx,x,y,size,id,frozen=false) {
  ctx.fillStyle=frozen?'#D0F2FA':'#FFF0CA';roundedRect(ctx,x,y,size,size,4);ctx.fill();
  ctx.strokeStyle=frozen?'#326D91':'#936B2E';ctx.lineWidth=Math.max(1,size*.07);
  ctx.beginPath();ctx.arc(x+size*.3,y+size*.32,size*.14,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+size*.4,y+size*.42);ctx.lineTo(x+size*.7,y+size*.73);
  ctx.lineTo(x+size*.8,y+size*.62);ctx.moveTo(x+size*.59,y+size*.61);ctx.lineTo(x+size*.68,y+size*.5);ctx.stroke();
  text(ctx,id,x+size*.79,y+size*.37,Math.max(8,size*.36),'#6C5125','center','700');
  if(frozen)text(ctx,'2',x+size*.2,y+size*.91,Math.max(8,size*.3),'#326D91','center','700');
}
function drawGate(ctx,x,y,size,id) {
  ctx.fillStyle='#D8C9AD';roundedRect(ctx,x,y,size,size,3);ctx.fill();
  ctx.strokeStyle='#82705A';ctx.lineWidth=1;
  for(const part of [.23,.77]){ctx.beginPath();ctx.moveTo(x+size*part,y+2);ctx.lineTo(x+size*part,y+size-2);ctx.stroke();}
  ctx.fillStyle='#F8F2E5';roundedRect(ctx,x+size*.29,y+size*.2,size*.42,size*.61,2);ctx.fill();
  text(ctx,id,x+size*.5,y+size*.66,Math.max(8,size*.45),'#685542','center','700');
}

module.exports = { drawTarget, drawFlower, drawKey, drawGate };
