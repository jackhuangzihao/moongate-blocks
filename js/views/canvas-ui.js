const { COLORS } = require('../config');

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, size=14, color=COLORS.text, align='center', weight='400') {
  ctx.font = `${weight} ${size}px sans-serif`; ctx.fillStyle=color; ctx.textAlign=align;
  ctx.fillText(String(value),x,y);
}

function pressedRect(state, id, rect) {
  if (!state || state.pressedButton !== id) return rect;
  const scale = 0.95;
  const width = rect.width * scale;
  const height = rect.height * scale;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2 + 1.5,
    width,
    height
  };
}

function button(ctx,rect,label,primary=false,state=null,id='',fontSize=16) {
  rect = pressedRect(state, id, rect);
  ctx.fillStyle=primary?COLORS.primaryButton:COLORS.panel;
  roundedRect(ctx,rect.x,rect.y,rect.width,rect.height,16);ctx.fill();
  text(ctx,label,rect.x+rect.width/2,rect.y+rect.height/2+6,fontSize,primary?'#FFFFFF':COLORS.text,'center','600');
}

function drawSettingsIcon(ctx, rect, color) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  [-7, 0, 7].forEach((offset, index) => {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + offset);
    ctx.lineTo(cx + 10, cy + offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + [-3, 5, -1][index], cy + offset, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function wrapText(ctx,value,x,y,width,size=12) {
  ctx.font=`${size}px sans-serif`;
  let line='';
  for(const char of value){
    const measured=ctx.measureText(line+char),length=measured&&Number.isFinite(measured.width)?measured.width:(line.length+1)*size;
    if(line && length>width){text(ctx,line,x,y,size,COLORS.secondaryText,'left');y+=18;line='';}
    line+=char;
  }
  if(line)text(ctx,line,x,y,size,COLORS.secondaryText,'left');
  return y+24;
}

module.exports = { roundedRect, text, pressedRect, button, drawSettingsIcon, wrapText };
