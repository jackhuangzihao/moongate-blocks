// Run every test file in its own process: wx mocks and module caches stay isolated.
// Usage: node tests/run.js
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter(name => name.endsWith('.test.js')).sort();
const failed = [];
if (!files.length) throw Error('No test files found');
for (const file of files) {
  console.log(`\nRunning ${file}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit'
  });
  if (result.status !== 0) {
    failed.push(file);
    if (result.error) console.error(result.error.message);
    if (result.signal) console.error(`${file} terminated by ${result.signal}`);
  }
}
console.log(`\n${files.length - failed.length}/${files.length} test suites passed.`);
if (failed.length) console.error(`Failed: ${failed.join(', ')}`);
process.exitCode = failed.length ? 1 : 0;
