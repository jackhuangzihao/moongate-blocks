const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { readModules } = require('./helpers/preview-bundle');

function checkModules(sources) {
  const graph = new Map();
  for (const [id, source] of Object.entries(sources)) {
    new vm.Script('(function(require,module,exports){\n' + source + '\n})', { filename: id + '.js' });
    const dependencies = [];
    // The game's imports are literal relative CommonJS paths; dynamic imports need explicit review.
    for (const call of source.matchAll(/\brequire\s*\(([^)]*)\)/g)) {
      const literal = call[1].trim().match(/^(['"])([^'"]+)\1$/);
      assert.ok(literal, `${id}: unsupported dynamic require: ${call[0]}`);
      const name = literal[2];
      assert.ok(name.startsWith('./') || name.startsWith('../'), `${id}: non-relative import ${name}`);
      const target = './' + path.posix.normalize(path.posix.join(path.posix.dirname(id), name)).replace(/\.js$/, '');
      // Compare actual directory-entry names, including case even on macOS.
      assert.ok(Object.hasOwn(sources, target), `${id}: missing module or wrong case: ${name} -> ${target}`);
      dependencies.push(target);
    }
    graph.set(id, dependencies);
  }
  const done = new Set(), visiting = new Set();
  function visit(id, chain) {
    assert.ok(!visiting.has(id), `Circular dependency: ${[...chain, id].join(' -> ')}`);
    if (done.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id)) visit(next, [...chain, id]);
    visiting.delete(id);
    done.add(id);
  }
  for (const id of graph.keys()) visit(id, []);
  return graph.size;
}

// Ensure the guard itself rejects regressions, without editing project files.
const valid = {
  './game': "require('./js/a');require('./js/b.js');",
  './js/a': "require('./shared/config');",
  './js/b': "require('./shared/config');",
  './js/shared/config': 'module.exports={};'
};
assert.equal(checkModules(valid), 4);
assert.throws(() => checkModules({ ...valid, './js/a': "require('./missing');" }), /missing module/);
assert.throws(() => checkModules({ ...valid, './js/a': "require('./shared/Config');" }), /wrong case/);
assert.throws(() => checkModules({ './a': "require('./b');", './b': "require('./a');" }), /Circular dependency/);
assert.throws(() => checkModules({ './a': "require('./a');" }), /Circular dependency/);
assert.throws(() => checkModules({ './a': 'const x = ;' }), SyntaxError);
assert.throws(() => checkModules({ './a': 'require(name);' }), /dynamic require/);
assert.throws(() => checkModules({ './a': "require('unknown-package');" }), /non-relative import/);

const root = path.resolve(__dirname, '..');
const sources = readModules(root);
sources['./game'] = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const openData = JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8')).openDataContext;
assert.ok(openData && !path.isAbsolute(openData) && !openData.split(/[\\/]/).includes('..'), 'Invalid open-data directory');
function readOpenData(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = directory + '/' + entry.name;
    if (entry.isDirectory()) readOpenData(file);
    else if (entry.name.endsWith('.js')) sources['./' + file.slice(0, -3)] = fs.readFileSync(path.join(root, file), 'utf8');
  }
}
readOpenData(openData);
assert.ok(sources['./' + openData + '/index'], 'Missing open-data entry');
console.log(`PASS: ${checkModules(sources)} runtime modules parse, resolve with exact case and have no dependency cycles`);
