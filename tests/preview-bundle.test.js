const assert = require('assert'), vm = require('vm'), path = require('path');
const { readModules, bundleModules } = require('./helpers/preview-bundle');
const sources = {
  './js/config': 'module.exports={count:0};',
  './js/a/value': "module.exports=require('../config');module.exports.count++;",
  './js/b/value': "module.exports={other:true};",
  './js/a/main': "module.exports=[require('./value'),require('../a/value.js'),require('../b/value')];",
  './js/broken': "throw Error('broken');",
  './js/text': "module.exports='</script>';"
};
const sandbox = vm.createContext({});
vm.runInContext(bundleModules(sources), sandbox);
const run = code => vm.runInContext(code, sandbox);
const values = run("require('./js/a/main')");
assert.strictEqual(values[0], values[1]);
assert.strictEqual(values[0], run("require('./js/config')"));
assert.equal(values[0].count, 1);
assert.equal(values[2].other, true);
assert.equal(run("require('./js/text')"), '</script>');
assert.ok(!bundleModules(sources).includes('</script>'));
assert.throws(() => run("require('./js/missing')"), /Missing preview module/);
assert.throws(() => run("require('./js/broken')"), /broken/);
assert.throws(() => run("require('./js/broken')"), /broken/);
assert.throws(() => run("require('fs')"), /Unsupported preview module/);
const actual = readModules(path.resolve(__dirname, '..'));
vm.runInContext(bundleModules(actual), vm.createContext({}));
assert.ok(actual['./js/renderer']);
console.log('PASS: preview relative paths, distinct filenames, shared cache, failed loads and script escaping');
