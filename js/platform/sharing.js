const { MODES, COLORS } = require('../config');
const challenges = require('../challenge/challenges');
const daily = require('../daily/daily');
const art = require('../views/art');
const { roundedRect } = require('../views/canvas-ui');
const { drawTarget, drawFlower, drawKey, drawGate } = require('../views/board-symbols');
const themes = require('../views/themes');
const GARDEN_COLORS = { ...COLORS };
let cardCanvas;

function validDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 分享成绩仅用于同题切磋，不携带星数、奖励或解锁状态，也不是服务器认证成绩。
function parseInvitation(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return null;
  const proto = Object.getPrototypeOf(query), own = key => Object.prototype.hasOwnProperty.call(query, key);
  if ((proto !== null && Object.getPrototypeOf(proto) !== null) || ['__proto__', 'constructor', 'prototype'].some(own)) return null;
  // A mode entry carries no board, score, rewards or chapter identifiers.
  if (own('mode')) return query.mode === 'gravity'
    && !['challenge','level','rule','daily','steps','help'].some(own) ? { mode: 'gravity' } : null;
  if (!['challenge', 'level', 'rule'].every(own) || query.challenge !== '1'
    || typeof query.level !== 'string' || !/^-?[1-9]\d{0,2}$/.test(query.level)
    || typeof query.rule !== 'string' || !/^[1-9]\d{0,3}$/.test(query.rule)) return null;
  const encoded = Number(query.level), level = encoded < 0 ? encoded : encoded - 1, rule = Number(query.rule);
  if (!challenges.level(level) || challenges.level(level).rule !== rule
    || (own('daily') && !validDate(query.daily))
    || (level < 0 && (!own('daily') || !daily.matchesDate(query.daily,level)))) return null;
  const invitation = { level, rule, ...(own('daily') ? { dailyDate: query.daily } : {}) };
  if (own('help') && query.help === '1') invitation.help = true;
  if (!invitation.help && own('steps') && typeof query.steps === 'string' && /^[1-9]\d{0,2}$/.test(query.steps)) {
    const steps = benchmarkSteps({ ...invitation, benchmarkSteps: Number(query.steps) });
    if (steps !== null) invitation.benchmarkSteps = steps;
  }
  return invitation;
}

function benchmarkSteps(run) {
  const level = run && challenges.level(run.level), steps = run && run.benchmarkSteps;
  return level && Number.isInteger(steps) && steps > 0 && steps <= level.limit
    && (run.rule === undefined || run.rule === level.rule)
    && (run.dailyDate === undefined || (validDate(run.dailyDate) && daily.levelFor(run.dailyDate) === run.level))
    && (run.level >= 0 || run.dailyDate !== undefined) ? steps : null;
}

function benchmarkText(run) {
  const steps = benchmarkSteps(run);
  return steps === null ? null : `这份挑战用 ${steps} 步完成`;
}

function comparison(run) {
  const steps = benchmarkSteps(run), used = run && Array.isArray(run.history) ? run.history.length : 0;
  if (!run || !run.won || steps === null || used < 1 || used > challenges.level(run.level).limit) return null;
  return used < steps ? `比挑战成绩少用 ${steps - used} 步`
    : used === steps ? '追平挑战成绩' : `再少用 ${used - steps} 步即可追平`;
}

function challengeQuery(run, steps = benchmarkSteps(run)) {
  const level = challenges.level(run.level);
  const benchmark = benchmarkSteps({ ...run, benchmarkSteps: steps });
  return `challenge=1&level=${run.level < 0 ? run.level : run.level + 1}&rule=${level.rule}${validDate(run.dailyDate) ? `&daily=${run.dailyDate}` : ''}${benchmark !== null ? `&steps=${benchmark}` : ''}`;
}

function resultCard(state) {
  if (state.screen === 'gravity' && state.gravityResult && state.gravityResult.over) {
    const result = state.gravityResult;
    return { challenge: false, gravity: true, decor: (state.decor || []).slice(), query: 'mode=gravity',
      heading: '落玉庭 · 连锁挑战', stat: `${result.score} 分`, detail: `最长 ${result.chain} 连锁 · 你能超过吗？`,
      title: `落玉庭这局 ${result.score} 分、${result.chain} 连锁，你能超过吗？` };
  }
  if (state.screen !== 'playing' || !state.gameOver || (state.challenge && !state.challenge.won)) return null;
  const run = state.challenge, level = run && challenges.level(run.level);
  const daily = run && validDate(run.dailyDate) ? run.dailyDate : '';
  return run ? {
    challenge: true, level: daily ? null : level.number, stars: challenges.stars(run),
    query: challengeQuery(run, run.history.length),
    heading: daily ? `每日精选 · ${daily.slice(5).replace('-', '月')}日` : `第 ${level.number} 关 · ${level.title}`,
    stat: `${run.history.length} 步通关`, detail: `${challenges.stars(run)} 星达成 · 你能用更少步吗？`,
    title: daily ? `${daily} 每日精选，我用 ${run.history.length} 步完成，你能更少吗？`
      : `第 ${level.number} 关，${run.history.length} 步 ${challenges.stars(run)} 星，你能比我更少吗？`
  } : {
    challenge: false, heading: `清雅庭院 · ${MODES[state.mode].title}`, decor: (state.decor || []).slice(),
    stat: `${state.score} 分`, detail: state.score > state.startingBest ? '刷新个人纪录 · 方寸之间再进一步' : '落子成局 · 来庭院里坐一会儿',
    title: `这局${MODES[state.mode].title} ${state.score} 分，你能超过吗？`
  };
}

function helpCard(state) {
  const run=state.challenge;
  if(state.screen!=='playing' || !state.gameOver || !run || !run.ended || run.won)return null;
  const level=challenges.level(run.level);
  return {challenge:true,help:true,heading:run.dailyDate?`${run.dailyDate} · 每日精选`:`第 ${level.number} 关 · ${level.title}`,
    query:challengeQuery(run,null)+'&help=1',title:run.dailyDate?`${run.dailyDate} 每日精选把我难住了，你能找到解法吗？`:`第 ${level.number} 关把我难住了，你能找到解法吗？`,
    stat:challenges.goal(level),detail:'朋友从初始棋盘尝试 · 图片为我的局面',
    progress:`目标 ${Math.min(run.progress,level.target)}/${level.target} · 剩余 ${Math.max(0,level.limit-run.history.length)} 步`,
    board:run.board.map(row=>row.slice()),ice:run.ice.map(p=>p.slice()),stones:run.stones.map(p=>p.slice()),
    flowers:run.flowers.map(p=>p.slice()),keys:run.keys.map(p=>p.slice()),
    gates:run.gates.map(g=>({id:g.id,cells:g.cells.map(p=>p.slice())})),area:level.area || [],
    tray:run.tray.map(piece=>piece?piece.cells.map(p=>p.slice()):null)};
}

// Render only on share. Snapshot data keeps the card stable if play resumes.
function drawHelpCard(ctx,card) {
  ctx.fillStyle='#E8EFFB';ctx.fillRect(0,0,600,480);ctx.fillStyle='#263E6A';ctx.textAlign='center';
  ctx.font='600 24px sans-serif';ctx.fillText(card.heading,300,37);
  ctx.font='18px sans-serif';ctx.fillText(card.stat,300,65);
  const size=30,x=165,y=81,has=(list,c,r)=>list.some(p=>p[0]===c&&p[1]===r);
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const value=card.board[r][c],flower=card.flowers.find(p=>p[0]===c&&p[1]===r);
    const gate=card.gates.find(g=>has(g.cells,c,r)),key=card.keys.find(p=>p[0]===c&&p[1]===r);
    const ice=has(card.ice,c,r),marked=has(card.stones,c,r);
    const xx=x+c*size+2,yy=y+r*size+2,cell=size-4;
    ctx.fillStyle=value===1?'#7999D9':'#DEE5F3';roundedRect(ctx,xx,yy,cell,cell,4);ctx.fill();
    if(flower)drawFlower(ctx,xx,yy,cell,flower[2]);
    else if(gate)drawGate(ctx,xx,yy,cell,gate.id);
    else if(key)drawKey(ctx,xx,yy,cell,key[2],ice);
    else if(value===2){ctx.fillStyle=COLORS.stone;ctx.beginPath();ctx.arc(xx+cell/2,yy+cell/2,cell*.36,0,Math.PI*2);ctx.fill();}
    else if(ice){ctx.fillStyle='#D0F2FA';roundedRect(ctx,xx,yy,cell,cell,4);ctx.fill();ctx.strokeStyle='#326D91';ctx.lineWidth=1;ctx.stroke();
      if(marked){ctx.fillStyle='#263E6A';ctx.font='600 17px sans-serif';ctx.fillText('2',xx+cell/2,yy+cell*.76);}
      else {ctx.beginPath();ctx.moveTo(xx+cell*.2,yy+cell*.5);ctx.lineTo(xx+cell*.8,yy+cell*.5);
        ctx.moveTo(xx+cell*.5,yy+cell*.2);ctx.lineTo(xx+cell*.5,yy+cell*.8);ctx.stroke();}
    } else if(marked)drawTarget(ctx,xx,yy,cell);
    if(has(card.area,c,r)){ctx.strokeStyle='#354FBE';ctx.setLineDash([3,2]);ctx.strokeRect(x+c*size+1,y+r*size+1,size-2,size-2);ctx.setLineDash([]);}
  }
  ctx.strokeStyle='#ACBCD7';ctx.lineWidth=1.5;ctx.beginPath();
  for(const i of [3,6]){ctx.moveTo(x+i*size,y);ctx.lineTo(x+i*size,y+9*size);ctx.moveTo(x,y+i*size);ctx.lineTo(x+9*size,y+i*size);}ctx.stroke();
  card.tray.forEach((piece,i)=>{if(!piece)return;ctx.fillStyle='#7999D9';
    const w=Math.max(...piece.map(p=>p[0]))+1;
    for(const [c,r] of piece)ctx.fillRect(240+i*60-w*4+c*8,362+r*8,7,7);
  });
  ctx.fillStyle='#263E6A';ctx.font='16px sans-serif';ctx.fillText(card.progress,300,418);
  ctx.font='18px sans-serif';ctx.fillText(card.detail,300,446);
  ctx.font='17px sans-serif';ctx.fillText('请你看看，还能怎么摆？',300,472);
}

// A dedicated 5:4 card keeps buttons and system UI out of the shared image.
function drawCard(ctx, card) {
  const previous = { ...COLORS };
  // Shared cards keep their established colors; never leak a temporary palette into gameplay.
  Object.assign(COLORS, themes.palette('classic', Boolean(card.challenge || card.help)));
  try { drawCardContent(ctx, card); }
  finally { Object.assign(COLORS, previous); }
}
function drawCardContent(ctx, card) {
  if(card.help){drawHelpCard(ctx,card);return;}
  const ink = card.challenge ? '#263E6A' : GARDEN_COLORS.text;
  ctx.fillStyle = card.challenge ? '#E8EFFB' : GARDEN_COLORS.background;
  ctx.fillRect(0, 0, 600, 480);
  ctx.textAlign = 'center'; ctx.fillStyle = ink; ctx.font = '600 24px sans-serif';
  ctx.fillText(card.heading, 300, 48);
  (card.challenge ? art.path : art.garden)(ctx, { x: 150, y: 65, width: 300, height: 170 }, card.challenge ? card.level : card.decor);
  ctx.fillStyle = ink; ctx.font = '600 52px sans-serif'; ctx.fillText(card.stat, 300, 300);
  if (card.challenge) for (let i = 0; i < 3; i++) art.star(ctx, 300 + (i - 1) * 40, 336, 13, i < card.stars ? '#B47D26' : '#ACBCD7');
  ctx.fillStyle = ink; ctx.font = '22px sans-serif'; ctx.fillText(card.detail, 300, 392);
  ctx.font = '18px sans-serif'; ctx.fillText(card.gravity ? '方寸九宫 · 落玉庭' : '方寸九宫 · 清雅庭院 / 闯关挑战', 300, 449);
}

function renderCard(wx, card) {
  if (!cardCanvas) cardCanvas = wx.createCanvas();
  cardCanvas.width = 600; cardCanvas.height = 480;
  drawCard(cardCanvas.getContext('2d'), card);
  const imageUrl = cardCanvas.toTempFilePathSync({ x: 0, y: 0, width: 600, height: 480, destWidth: 600, destHeight: 480, fileType: 'png' });
  if (!imageUrl) throw Error('Empty share image');
  return imageUrl;
}

function share(wx, state) {
  const card = helpCard(state) || resultCard(state);
  if (!card) return;
  const notice = title => { if (wx.showToast) wx.showToast({ title, icon: 'none' }); };
  if (!wx.shareAppMessage) { notice('请在微信中分享'); return; }
  try { wx.shareAppMessage(shareContent(wx, card)); }
  catch (_) { notice('暂时无法分享，请稍后重试'); }
}

// 不在结算页时，右上角转发用的卡片：展示玩家自己的庭院和最好成绩。
function menuCard(state) {
  if (state.screen === 'gravity') return {
    challenge: false, gravity: true, decor: (state.decor || []).slice(), query: 'mode=gravity',
    heading: '方寸九宫 · 落玉庭', stat: '消除后下落', detail: '填满行、列或九宫 · 落稳再连锁',
    title: '落玉庭：消除后下落，来试试连锁消除？'
  };
  const dailyLevel = state.screen === 'daily' ? daily.entryLevel(state.dailyProgress,state.today) : null;
  const dailyInvitation = state.invitation && state.invitation.dailyDate === state.today
    && state.invitation.level === dailyLevel ? state.invitation : null;
  const run = !state.screen || state.screen === 'playing' ? state.challenge
    : dailyLevel !== null ? { level: dailyLevel, dailyDate: state.today, benchmarkSteps: benchmarkSteps(dailyInvitation) }
    : state.screen === 'invitation' ? state.invitation : null;
  if (run && challenges.level(run.level)) {
    const level = challenges.level(run.level), daily = validDate(run.dailyDate) ? run.dailyDate : '';
    return { challenge: true, level: daily ? null : level.number, stars: 0, query: challengeQuery(run),
      heading: daily ? `每日精选 · ${daily.slice(5).replace('-', '月')}日` : `第 ${level.number} 关 · ${level.title}`,
      stat: benchmarkText(run) || (daily ? '今天，一起解这一题' : '同一题，试试你的解法'), detail: challenges.goal(level),
      title: daily ? `${daily} 每日精选，来试试你的解法？` : `方寸九宫第 ${level.number} 关 · ${level.title}，来试试你的解法？` };
  }
  const mode = MODES[(state.screen && state.screen !== 'playing' && state.freeMode) || state.mode] || MODES.easy;
  const best = Math.max(0, Number((state.bestScores || {})[mode.id]) || 0);
  return { challenge: false, decor: (state.decor || []).slice(), heading: `方寸九宫 · ${mode.title}`,
    stat: best ? `最高 ${best} 分` : '来摆一局', detail: '落子成局 · 方寸之间',
    title: best ? `我在${mode.title}最高拿到 ${best} 分，来庭院里摆一局？` : '方寸九宫 · 落子成局，来庭院里摆一局？' };
}

function shareContent(wx, card) {
  const content = { title: card.title, ...(card.query ? { query: card.query } : {}) };
  // 图片导出失败仍能邀请到同一题，微信使用当前画面作为转发图。
  try { content.imageUrl = renderCard(wx, card); } catch (_) {}
  return content;
}

// 右上角"…"菜单里的转发和分享到朋友圈。不调用 showShareMenu，微信会把这两项置灰。
function enableMenuShare(wx, getState) {
  try { if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] }); }
  catch (_) { /* 旧客户端不支持朋友圈时，至少保留转发。 */ }
  const currentCard = () => {
    const state = getState(), card = helpCard(state) || resultCard(state) || menuCard(state);
    return card;
  };
  if (wx.onShareAppMessage) wx.onShareAppMessage(() => shareContent(wx, currentCard()));
  // 朋友圈用小游戏头像做封面，只需要标题。
  if (wx.onShareTimeline) wx.onShareTimeline(() => {
    const card = currentCard(); return { title: card.title, ...(card.query ? { query: card.query } : {}) };
  });
}

module.exports = { resultCard, helpCard, drawCard, share, menuCard, enableMenuShare, parseInvitation, benchmarkText, comparison };
