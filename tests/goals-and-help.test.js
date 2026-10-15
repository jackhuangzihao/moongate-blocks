const assert=require('assert');
const C=require('../js/challenge/challenges'),K=require('../js/progression/collection'),D=require('../js/daily/daily'),Share=require('../js/platform/sharing'),Goals=require('../js/progression/goals');
const {boot,clone,protectedStore,protectedState,queryFor,INVITE}=require('./helpers/game-harness');
const moves=[[1,0,0],[2,8,7],[0,0,8],[0,3,0]];
// Rule cards explain every objective and do not alter the board, hint use, or undo budget.
for(const level of [...C.LEVELS,...C.DAILY_LEVELS]){
 const description=Goals.describe({challenge:C.start(level.id)});
 assert.equal(description.lines.length,4);assert.equal(description.goal,C.goal(level));
 assert.ok(description.caption.startsWith('例：'));
}
for(const size of [{w:320,h:568},{w:375,h:667},{w:390,h:844},{w:430,h:932}]){
 const app=boot({}, {size});app.run('startChallenge(48)');
 const before=clone(app.run('state.challenge')),saved=clone(app.store);
 app.tap(app.run('getGoalAction(layout)'));assert.equal(app.run('state.playPanel'),'goal');
 app.draw();const actions=app.run('getPlayPanelActions(layout,state)');
 assert.ok(actions.panel.y>=0 && actions.panel.y+actions.panel.height<=size.h);
 assert.ok(actions.confirm.height>=44 && actions.close.width>=44);
 app.move(C.LEVELS[48].solution[0]);assert.deepStrictEqual(clone(app.run('state.challenge')),before,'modal shields the board');
 assert.deepStrictEqual(clone(app.store),saved);
 if(app.run('state.playPanel'))app.tap(app.run('getPlayPanelActions(layout,state).confirm'));
 app.move(C.LEVELS[48].solution[0]);assert.equal(app.run('state.challenge.history.length'),1);
}
// Selected progress is real and consistent on home, in play and after completion.
const app=boot({[K.KEY]:{version:1,clears:19,target:'plum',seen:['bamboo'],hidden:[]},fangcunTutorialSeen:true});
assert.ok(app.draw().some(x=>x.text.includes('19/20 次消除')));
app.run('continueOrStartGame()');assert.equal(app.run('state.board.length'),9);assert.equal(app.run('state.board[0].length'),9);
assert.ok(app.draw().some(x=>x.text.includes('19/20 次消除')));
app.run('state.gameOver=true;state.gameOverProgress=1');
assert.ok(app.draw().some(x=>x.text.includes('19/20 次消除')));
assert.ok(app.draw().some(x=>x.text.includes('托盘方块都放不下')));
assert.equal(K.focus(K.normalize(null),0,'memorial').item.id,'chime','daily progress points at daily rewards');
// A help card contains an immutable actual board and only a same-level link, never a transferred state.
const sent=[],calls=[];
const failed=boot({}, {api:{shareAppMessage:card=>sent.push(card),reportEvent:(name,data)=>calls.push([name,data])}});
failed.run('startChallenge(0)');for(const move of moves)failed.move(move);
const before=clone(failed.run('state.challenge')),card=Share.helpCard(failed.run('state'));
assert.deepStrictEqual(card.board,before.board);assert.deepStrictEqual(card.tray,before.tray.map(piece=>piece&&piece.cells));
assert.ok(card.detail.includes('初始棋盘'));assert.ok(!card.query.includes('steps='));
assert.ok(!card.query.includes('history') && !card.query.includes('board'));
const query=Object.fromEntries(new URLSearchParams(card.query));assert.equal(Share.parseInvitation(query).help,true);
const redirected=boot();redirected.run('startChallenge(0)');redirected.tap(redirected.run('getGoalAction(layout)'));
redirected.run(`receiveInvitation(${JSON.stringify(query)})`);
assert.equal(redirected.run('state.screen'),'invitation');assert.equal(redirected.run('state.playPanel'),null,'external invitation clears the old modal');
card.board[0][0]=99;assert.notEqual(failed.run('state.board[0][0]'),99);
failed.tap(failed.run('getGameOverActions(layout,state).share'));assert.equal(sent.length,1);
assert.deepStrictEqual(clone(failed.run('state.challenge')),before);assert.ok(calls.some(([name,data])=>name==='result_action'&&data.action==='help_share'));
// Help opens from the initial position even if the recipient has a trial save for this same level.
const store=protectedStore(),preserved=protectedState(store),old=C.start(0);C.play(old,...moves[0]);store[INVITE]=C.checkpoint(old);
const recipient=boot(store,{query});recipient.run('startInvitation()');
assert.equal(recipient.run('state.challenge.history.length'),0);assert.equal(recipient.run('state.challenge.invited'),true);
assert.deepStrictEqual(clone(recipient.run('state.board')),C.start(0).board);recipient.complete();
assert.deepStrictEqual(protectedState(store),preserved);
// Daily help is also an independent initial-position trial; it cannot replace the recipient's daily save or award stamps.
const dailyStore=protectedStore(),normal=boot(dailyStore);normal.run('openDaily();startDaily()');const dailyId=normal.run('state.challenge.level');
normal.move(C.level(dailyId).solution[0]);const dailyBefore=clone(dailyStore[D.KEY]);
const dailyQuery={...queryFor(dailyId,'2026-10-03'),help:'1'};
const dailyFriend=boot(dailyStore,{query:dailyQuery});assert.equal(dailyFriend.run('state.screen'),'invitation');dailyFriend.run('startInvitation()');
assert.equal(dailyFriend.run('state.challenge.history.length'),0);assert.equal(dailyFriend.run('state.challenge.dailyDate'),'2026-10-03');
dailyFriend.complete();assert.deepStrictEqual(dailyStore[D.KEY],dailyBefore);
assert.ok(!dailyStore[K.KEY].dailyCompletions);
const dailyHelpResult=dailyFriend.draw().map(item=>item.text);
assert.ok(dailyHelpResult.includes('独立试玩完成 · 你的原有进度保留'));
assert.ok(!dailyHelpResult.some(text=>text.includes('印记已点亮')),'help must not claim a daily award');
assert.ok(dailyFriend.events.some(([name,data])=>name==='session_start'&&data.mode==='invite'));
console.log('PASS: contextual rules, four screen sizes, non-mutating modal, actual collection goals, help card snapshots and isolated chapter/daily invitations');
