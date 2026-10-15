const assert=require('assert');
const C=require('../js/challenge/challenges');
const {boot,clone}=require('./helpers/game-harness');
const app=boot({[C.KEY]:{version:1,stars:Array(C.LEVELS.length).fill(3)}});
let moves=0,watering=0,blooms=0,openings=0;
function hover([slot,c,r]) {
  const from=app.run(`({clientX:layout.horizontalPadding+layout.traySlotWidth*(${slot}+.5),clientY:layout.trayY,identifier:7})`);
  const to=app.run(`(()=>{const b=shapeBounds(state.tray[${slot}]);return {clientX:layout.boardX+(${c}+b.width/2)*layout.cellSize,clientY:layout.boardY+(${r}+b.height/2)*layout.cellSize+Math.min(86,layout.cellSize*2.2),identifier:7}})()`);
  app.handlers.TouchStart({touches:[from],changedTouches:[from]});
  app.handlers.TouchMove({touches:[to],changedTouches:[to]});
  return to;
}
// Actual touch handlers, across flowers and every key/gate combination.
for(const level of C.LEVELS.slice(36)) {
  app.run(`startChallenge(${level.id})`);app.settle();
  for(const move of level.solution) {
    const before=clone(app.run('state.challenge')),saved=clone(app.store);
    const expected=C.preview(before,...move),to=hover(move);
    const preview=app.run('state.drag.challengePreview');
    assert.deepStrictEqual(clone(preview),expected);
    assert.deepStrictEqual(clone(app.run('state.challenge')),before,'Hover never spends a move');
    assert.deepStrictEqual(app.store,saved,'Hover never writes a speculative state');
    app.handlers.TouchMove({touches:[to],changedTouches:[to]});
    assert.strictEqual(app.run('state.drag.challengePreview'),preview,'Same landing reuses the preview');
    const labels=app.draw().map(item=>item.text);
    assert.ok(labels.some(text=>text.startsWith('落子预览 · ')));
    if(preview.wateredFlowers.length)watering++;
    if(preview.bloomedFlowers.length){blooms++;assert.ok(labels.some(text=>text.includes('处开花')));}
    if(preview.openedGates.length){openings++;assert.ok(labels.some(text=>text.includes('机关')));}
    if(preview.won)assert.ok(labels.some(text=>text.includes('将完成目标')));
    app.handlers.TouchEnd({touches:[],changedTouches:[to]});app.settle();
    assert.equal(app.run('state.challenge.progress'),before.progress+expected.progressGain);
    moves++;
  }
  assert.ok(app.run('state.challenge.won'));
}
assert.ok(watering>0&&blooms>0&&openings>0);

// A closed door is not a prefilled square; no false glowing line in its preview.
app.run('startChallenge(51)');app.settle();hover([1,3,3]);
assert.equal(app.run('state.drag.previewClearingCells.length'),0);
assert.equal(app.run('state.drag.challengePreview.progressGain'),0);
const before=clone(app.run('state.challenge')),saved=clone(app.store);
const outside={clientX:0,clientY:0,identifier:7};
app.handlers.TouchMove({touches:[outside],changedTouches:[outside]});
assert.equal(app.run('state.drag.challengePreview'),null);
assert.deepStrictEqual(clone(app.run('state.drag.previewClearingCells')),[]);
app.handlers.TouchCancel({touches:[],changedTouches:[outside]});app.settle();
assert.deepStrictEqual(clone(app.run('state.challenge')),before);
assert.deepStrictEqual(app.store,saved);
assert.ok(!app.draw().some(item=>item.text.startsWith('落子预览 · ')));
console.log(`PASS: ${moves} actual touch previews; ${watering} watering, ${blooms} bloom and ${openings} gate moves; cache, cancellation and immutable saves`);
