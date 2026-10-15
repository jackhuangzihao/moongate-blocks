// Run: node docs/previews/check-preview.js
// Check the demo puzzle itself, without browser or build dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/three-directions.html', 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
const scope = vm.createContext({});
vm.runInContext(script.split("document.getElementById('comparisons')")[0] + '\nthis.models=data;this.makeBoard=board;this.makeScreen=render;', scope);
for (const model of scope.models) {
 const board = scope.makeBoard(model);
 const cells = [...board.matchAll(/class="cell ([^"]*)"/g)].map(match => match[1].trim().split(/\s+/));
 assert.equal(cells.length, 81);
 const row = cells.slice(36,45);
 assert.equal(row.filter(cell=>cell.includes('gap')).length, 3);
 assert.equal(row.filter(cell=>cell.includes('filled')).length, 6);
 assert.ok(row.slice(3,6).every(cell=>cell.includes('gap')));
 assert.equal(cells.filter(cell=>cell.includes('stone')).length, model.id==='c'?1:0);
 const rendered=scope.makeScreen(model,0);
 for (const page of ['home','game','result']) assert.ok(rendered.includes(`data-page="${page}"`));
}
assert.ok(html.includes('prefers-reduced-motion'));
assert.ok(!/<script[^>]+src=|https?:\/\//.test(html), 'Preview must work offline');
console.log('PASS: three demo puzzles, screen routes, offline assets, reduced motion and script syntax');
