const assert = require('assert');
const C = require('../js/challenge/challenges');
const { MODES, MODE_ORDER } = require('../js/config');
const S = require('../js/platform/sharing');
const state = { screen: 'playing', gameOver: true, mode: 'easy', score: 321, startingBest: 300, challenge: null };
for (const mode of MODE_ORDER) {
  const card = S.resultCard({ ...state, mode });
  assert.ok(card.heading.includes(MODES[mode].title));
  assert.ok(card.title.includes('321')); assert.ok(card.detail.includes('刷新'));
}
assert.equal(S.resultCard({ ...state, gameOver: false }), null);
assert.equal(S.resultCard({ ...state, challenge: C.start(0) }), null);
const run = C.start(4); C.LEVELS[4].solution.forEach(move => C.play(run, ...move));
const card = S.resultCard({ ...state, challenge: run });
assert.equal(card.stars, 3); assert.equal(card.level, 5); assert.equal(card.stat, `${run.history.length} 步通关`);
const query = raw => Object.fromEntries(new URLSearchParams(raw));
const invitation = { level: 4, rule: C.LEVELS[4].rule, benchmarkSteps: run.history.length };
assert.deepStrictEqual(S.parseInvitation(query(card.query)), invitation);
// Display numbering follows expanded chapter order; deep links keep stable stored IDs.
const expandedRun=C.start(12);C.level(12).solution.forEach(move=>C.play(expandedRun,...move));
for(const visible of [S.resultCard({...state,challenge:expandedRun}),S.menuCard({...state,gameOver:false,challenge:expandedRun})]){
  assert.equal(visible.level,19);assert.ok(visible.heading.startsWith('第 19 关'));
  assert.equal(query(visible.query).level,'13');
  assert.equal(S.parseInvitation(query(visible.query)).level,12);
}
for(const dailyCard of [S.resultCard({...state,challenge:{...expandedRun,dailyDate:'2026-10-03'}}),S.menuCard({...state,gameOver:false,challenge:{...expandedRun,dailyDate:'2026-10-03'}})]){
  assert.equal(dailyCard.level,null,'Daily art has no chapter number');
  const artLabels=[],artCtx=new Proxy({}, {get:(_,key)=>key==='fillText'?value=>artLabels.push(String(value)):()=>{}});
  S.drawCard(artCtx,dailyCard);
  assert.ok(artLabels.includes('✓'));
  assert.ok(!artLabels.some(label=>/^\d+$/.test(label)),'Daily path nodes do not leak internal IDs');
}
const labels = [], calls = [], notices = [];
const ctx = new Proxy({}, { get: (_, k) => k === 'fillText' ? text => labels.push(text) : () => {} });
S.drawCard(ctx, card); assert.ok(labels.includes(`第 5 关 · ${C.LEVELS[4].title}`)); assert.ok(labels.includes(`${run.history.length} 步通关`));
let failExport = false;
const canvas = { getContext: () => ctx, toTempFilePathSync: options => {
  if (failExport) throw Error('export failed');
  assert.equal(options.width / options.height, 1.25); return '/tmp/share.png';
} };
const wx = { createCanvas: () => canvas, showToast: o => notices.push(o.title), shareAppMessage: o => calls.push(o) };
S.share(wx, state); assert.equal(calls.length, 1); assert.equal(calls[0].imageUrl, '/tmp/share.png');
failExport = true; S.share(wx, { ...state, challenge: run }); assert.equal(calls.length, 2);
assert.deepStrictEqual(calls[1], { title: card.title, query: card.query }, 'export failure keeps invitation usable');
S.share({ showToast: wx.showToast }, state); assert.equal(notices.at(-1), '请在微信中分享');
failExport = false; S.share({ ...wx, shareAppMessage() { throw Error('unavailable'); } }, state);
assert.ok(notices.at(-1).includes('重试'));
assert.equal(state.score, 321);

// Sharing invitations never transfer stars or unlocks, and old rule versions do not open a different puzzle.
const valid = query(card.query);
for (const bad of [null, [], 'level=5', Object.create(valid), { ...valid, challenge: 'true' },
  { ...valid, level: 5 }, { ...valid, level: ['5'] }, { ...valid, level: '05' },
  { ...valid, level: '0' }, { ...valid, level: String(C.LEVELS.length + 1) },
  { ...valid, level: '1e1' }, { ...valid, rule: String(C.LEVELS[4].rule + 1) },
  { ...valid, rule: '01' }, { ...valid, daily: '2026-02-29' }, { ...valid, daily: '2026-13-03' },
  { ...valid, daily: '' }, { ...valid, daily: ['2026-10-03'] }, { ...valid, daily: '2026-10-03&level=1' },
  JSON.parse(`{"challenge":"1","level":"5","rule":"${C.LEVELS[4].rule}","__proto__":{}}`),
  { ...valid, constructor: 'Object' }]) assert.equal(S.parseInvitation(bad), null, JSON.stringify(bad));
assert.deepStrictEqual(S.parseInvitation(Object.assign(Object.create(null), valid)), invitation);
assert.deepStrictEqual(S.parseInvitation({ ...valid, stars: '3', unlocked: '48' }), invitation);
assert.deepStrictEqual(S.parseInvitation({ ...valid, daily: '2028-02-29' }), { level: 4, rule: C.LEVELS[4].rule, dailyDate: '2028-02-29' });
const legacyQuery = { challenge: '1', level: '5', rule: String(C.LEVELS[4].rule) };
assert.deepStrictEqual(S.parseInvitation(legacyQuery), { level: 4, rule: C.LEVELS[4].rule }, 'old links remain usable without a comparison');
for (const steps of [undefined, null, 1, ['1'], {}, '', '0', '-1', '01', '+1', '1.0', '1e1', ' 1', '1 ', 'Infinity', 'NaN', '1&rule=1', '1000', String(C.LEVELS[4].limit + 1)]) {
  assert.deepStrictEqual(S.parseInvitation({ ...legacyQuery, steps }), { level: 4, rule: C.LEVELS[4].rule }, `invalid optional steps ${JSON.stringify(steps)} does not break the puzzle`);
}
assert.equal(S.parseInvitation({ ...legacyQuery, steps: String(C.LEVELS[4].limit) }).benchmarkSteps, C.LEVELS[4].limit);
assert.equal(S.parseInvitation({ ...legacyQuery, steps: '1' }).benchmarkSteps, 1);

let menuState = { ...state, gameOver: false, challenge: C.start(4) }, appShare, timelineShare;
S.enableMenuShare({ ...wx, onShareAppMessage: handler => { appShare = handler; }, onShareTimeline: handler => { timelineShare = handler; } }, () => menuState);
assert.ok(appShare().title.includes('第 5 关')); assert.deepStrictEqual(query(appShare().query), legacyQuery);
assert.deepStrictEqual(query(timelineShare().query), legacyQuery); assert.equal(timelineShare().imageUrl, undefined);
menuState = { ...state, challenge: { ...run, dailyDate: '2026-10-03' } };
assert.ok(appShare().title.includes('2026-10-03 每日精选'));
assert.ok(S.resultCard(menuState).heading.includes('10月03日'));
assert.deepStrictEqual(S.parseInvitation(query(appShare().query)), { level: 4, rule: C.LEVELS[4].rule, dailyDate: '2026-10-03' });
failExport = true;
assert.equal(appShare().imageUrl, undefined); assert.ok(appShare().query.includes('daily=2026-10-03'));
menuState.gameOver = false; assert.ok(appShare().title.includes('每日精选')); assert.ok(timelineShare().query.includes('daily='));

const garden = S.menuCard({ ...state, mode: 'long', bestScores: { easy: 999, long: 123 } });
assert.ok(garden.heading.includes('长庭')); assert.equal(garden.stat, '最高 123 分'); assert.ok(garden.title.includes('长庭'));
assert.equal(garden.query, undefined);
menuState = { ...menuState, screen: 'menu', homeMode: 'garden', freeMode: 'long', bestScores: { easy: 999, long: 123 } };
assert.equal(appShare().query, undefined, 'returning home does not keep sharing the previous challenge');
assert.ok(appShare().title.includes('长庭')); assert.ok(appShare().title.includes('123'));
menuState.screen = 'invitation'; menuState.invitation = { level: 0, rule: C.LEVELS[0].rule };
assert.deepStrictEqual(S.parseInvitation(query(appShare().query)), menuState.invitation, 'landing page shares the incoming puzzle');
menuState.screen = 'daily'; menuState.today = '2026-10-03';
const selected = require('../js/daily/daily').levelFor(menuState.today);
assert.deepStrictEqual(S.parseInvitation(query(appShare().query)), { level: selected, rule: C.LEVELS[selected].rule, dailyDate: menuState.today }, 'daily landing page shares today rather than the previous run');
console.log('Share cards: map-specific scores, challenge/daily invitations, strict query validation, menu/timeline and image/API fallback passed');

// A dedicated negative puzzle id is never a chapter invitation and must match its date.
const Daily=require('../js/daily/daily'),dedicatedDate='2026-10-05',dedicated=Daily.start(null,dedicatedDate);
for(const move of C.level(dedicated.level).solution)C.play(dedicated,...move);
const dedicatedCard=S.resultCard({...state,challenge:dedicated});
const dedicatedQuery=query(dedicatedCard.query);
assert.equal(dedicatedQuery.level,'-1');
assert.deepStrictEqual(S.parseInvitation(dedicatedQuery),{level:-1,rule:C.level(-1).rule,dailyDate:dedicatedDate,benchmarkSteps:dedicated.history.length});
for(const bad of [{...dedicatedQuery,daily:'2026-10-06'},{...dedicatedQuery,daily:'2026-10-04'},
  {...dedicatedQuery,daily:undefined},{...dedicatedQuery,level:'-29'},{...dedicatedQuery,level:'-0'},
  {challenge:'1',level:'-1',rule:'1'}])assert.equal(S.parseInvitation(bad),null);
const dedicatedMenu=S.menuCard({...state,gameOver:false,screen:'daily',today:dedicatedDate});
assert.deepStrictEqual(S.parseInvitation(query(dedicatedMenu.query)),{level:-1,rule:1,dailyDate:dedicatedDate});
assert.ok(dedicatedMenu.title.includes('每日精选'));assert.ok(!dedicatedMenu.title.includes('第 -'));
const dailyLanding = { ...state, gameOver: false, screen: 'daily', today: dedicatedDate,
  invitation: S.parseInvitation(dedicatedQuery) };
assert.equal(query(S.menuCard(dailyLanding).query).steps, String(dedicated.history.length));
assert.equal(query(S.menuCard({ ...dailyLanding, today: '2026-11-02' }).query).steps, undefined, 'same puzzle on another date does not forward an expired comparison');
assert.equal(query(S.menuCard({ ...dailyLanding, invitation: { ...dailyLanding.invitation, rule: 9999 } }).query).steps, undefined);
console.log('PASS: dedicated daily share round-trip, date/id binding and chapter invitation isolation');

// Only the same rule/date/puzzle is comparable; normal play cannot invent a completion.
const incoming = { ...C.start(4), benchmarkSteps: C.LEVELS[4].limit, invited: true };
assert.equal(S.benchmarkText(incoming), `这份挑战用 ${C.LEVELS[4].limit} 步完成`);
assert.equal(S.comparison(incoming), null);
assert.equal(query(S.menuCard({ screen: 'playing', challenge: incoming }).query).steps, String(incoming.benchmarkSteps));
assert.equal(query(S.menuCard({ screen: 'invitation', invitation }).query).steps, String(invitation.benchmarkSteps));
assert.equal(query(S.menuCard({ screen: 'playing', challenge: C.start(4) }).query).steps, undefined);
const finished = { ...run, benchmarkSteps: run.history.length + 1, invited: true };
assert.equal(S.comparison(finished), '比挑战成绩少用 1 步');
assert.equal(S.comparison({ ...finished, benchmarkSteps: run.history.length }), '追平挑战成绩');
assert.equal(S.comparison({ ...finished, benchmarkSteps: run.history.length - 1 }), '再少用 1 步即可追平');
assert.equal(query(S.resultCard({ ...state, challenge: finished }).query).steps, String(run.history.length), 'a returned challenge carries this player completion, not the incoming benchmark');
for (const benchmarkSteps of [null, 0, -1, '2', 1.5, Infinity, C.LEVELS[4].limit + 1]) {
  assert.equal(S.comparison({ ...finished, benchmarkSteps }), null);
  assert.equal(S.benchmarkText({ ...incoming, benchmarkSteps }), null);
}
assert.equal(S.comparison({ ...finished, rule: C.LEVELS[4].rule + 1 }), null);
assert.equal(S.comparison({ ...finished, dailyDate: '2026-10-05' }), null);
assert.equal(S.comparison({ ...dedicated, benchmarkSteps: dedicated.history.length }), '追平挑战成绩');
assert.equal(S.comparison({ ...dedicated, benchmarkSteps: dedicated.history.length, dailyDate: '2026-10-06' }), null);
assert.equal(S.benchmarkText({ ...dedicated, benchmarkSteps: dedicated.history.length, dailyDate: undefined }), null);
assert.equal(query(S.menuCard({ screen: 'playing', challenge: { ...dedicated, benchmarkSteps: dedicated.history.length } }).query).steps, String(dedicated.history.length));
assert.equal(query(S.menuCard({ screen: 'playing', challenge: { ...dedicated, benchmarkSteps: dedicated.history.length, dailyDate: '2026-10-06' } }).query).steps, undefined);
assert.deepStrictEqual(S.parseInvitation({ ...dedicatedQuery, steps: '01' }), { level: -1, rule: C.level(-1).rule, dailyDate: dedicatedDate });
assert.equal({}.benchmarkSteps, undefined, 'parsing and forwarding never pollute object prototypes');
console.log('PASS: optional bounded benchmark, old-link compatibility, personal result forwarding and same-puzzle comparison');

// Gravity shares describe the mode, never another garden's score or a chapter.
const gravityCard=S.menuCard({...state,screen:'gravity',score:999,bestScores:{easy:999},challenge:run});
assert.equal(gravityCard.heading,'方寸九宫 · 落玉庭');
assert.ok(!gravityCard.title.includes('999'));assert.ok(!gravityCard.stat.includes('999'));
assert.deepStrictEqual(S.parseInvitation(query(gravityCard.query)),{mode:'gravity'});
labels.length=0;S.drawCard(ctx,gravityCard);
assert.ok(labels.includes('方寸九宫 · 落玉庭'));
assert.ok(!labels.some(t=>String(t).includes('清雅庭院 /')));
menuState={...state,screen:'gravity'};failExport=true;
assert.equal(appShare().query,'mode=gravity');assert.equal(timelineShare().query,'mode=gravity');
assert.ok(appShare().title.includes('落玉庭'));
for(const bad of [{mode:['gravity']},{mode:'unknown'},{mode:'gravity',challenge:'1'},{mode:'gravity',level:'1'},
  {mode:'gravity',daily:'2026-10-16'},Object.create({mode:'gravity'}),JSON.parse('{"mode":"gravity","__proto__":{}}')])assert.equal(S.parseInvitation(bad),null);
assert.deepStrictEqual(S.parseInvitation({mode:'gravity',score:'999',reward:'999'}),{mode:'gravity'});
console.log('PASS: gravity share title/image labels, timeline, export fallback and isolated entry query');

// Challenge phrasing uses the player's actual result; help links keep initial-board semantics.
assert.ok(card.title.includes(`${run.history.length} 步`));
assert.ok(card.title.includes('更少'));
assert.ok(!S.resultCard({...state,score:120,startingBest:300}).title.includes('纪录'));
const failure=C.start(12);failure.ended=true;
const help=S.helpCard({...state,challenge:failure});
assert.ok(help.title.includes(`第 ${C.level(12).number} 关`));
assert.ok(help.detail.includes('初始棋盘'));
assert.equal(S.parseInvitation(query(help.query)).help,true);
const gravityResult=S.resultCard({...state,screen:'gravity',gravityResult:{score:3800,chain:4,over:true}});
assert.equal(gravityResult.stat,'3800 分');assert.ok(gravityResult.title.includes('4 连锁'));
assert.deepStrictEqual(S.parseInvitation(query(gravityResult.query)),{mode:'gravity'});
assert.equal(S.resultCard({...state,screen:'gravity',gravityResult:{score:3800,chain:4,over:false}}),null);
console.log('PASS: actual-result challenge copy, initial-board help and gravity result sharing');
