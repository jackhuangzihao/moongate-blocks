const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');

function boot(html, file, search) {
  const events = {}, elements = {}, store = {}, frames = [], intervals = [], labels = [];
  let painted = 0;
  function element(id) {
    return elements[id] || (elements[id] = {
      style: {}, value: '', hidden: false, textContent: '', children: [],
      append(child) { this.children.push(child); if (this.children.length === 1) this.value = child.value; },
      addEventListener(event, fn) { events[id + ':' + event] = fn; },
      querySelector(selector) { return element(id + selector); }
    });
  }
  // A drawing/API smoke check, not a pixel-accuracy or real-browser test.
  function canvas(id) {
    const ctx = new Proxy({}, {
      get(object, key) {
        if (key in object) return object[key];
        if (key === 'measureText') return text => ({ width: String(text).length * 7 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (key === 'fillText') return text => labels.push(String(text));
        if (key === 'drawImage') return () => painted++;
        return () => {};
      },
      set(object, key, value) { object[key] = value; return true; }
    });
    return { style: {}, getContext: () => ctx, setPointerCapture() {},
      addEventListener(event, fn) { events[id + ':' + event] = fn; },
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 390, height: 844 }) };
  }
  elements.game = canvas('game');
  const sandbox = vm.createContext({
    console, URLSearchParams, location: { pathname: '/previews/' + file, search },
    document: {
      getElementById: element, querySelector: element, querySelectorAll: () => [],
      createElement: type => type === 'canvas' ? canvas('offscreen') : { value: '', textContent: '' },
      addEventListener: (event, fn) => { events[event] = fn; }
    },
    localStorage: { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; } },
    requestAnimationFrame: fn => frames.push(fn), setInterval: fn => intervals.push(fn), setTimeout() {}
  });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'Expected one complete inline preview script');
  vm.runInContext(scripts[0][1], sandbox, { filename: file, timeout: 5000 });
  for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    assert.equal(typeof events['game:' + event], 'function', event + ' listener');
  }
  assert.equal(typeof events.visibilitychange, 'function');
  assert.ok(frames.length, 'Game must schedule a frame');
  sandbox.firstFrame = frames.shift();
  vm.runInContext('firstFrame(Date.now())', sandbox, { timeout: 5000 });
  for (const callback of intervals) {
    sandbox.statusTick = callback;
    vm.runInContext('statusTick()', sandbox, { timeout: 5000 });
  }
  assert.ok(labels.length > 0 && painted > 0, 'First frame must draw labels and present the scene');
  return { elements, labels };
}

// Always build from current sources; never overwrite the user's generated previews.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fangcun-playable-test-'));
try {
  for (const relative of ['game.js', 'js', 'assets/audio', 'tests/build-playable-preview.js', 'tests/helpers/preview-bundle.js']) {
    const destination = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(root, relative), destination, { recursive: true });
  }
  fs.mkdirSync(path.join(temporary, 'docs/previews'), { recursive: true });
  execFileSync(process.execPath, ['tests/build-playable-preview.js'], { cwd: temporary, timeout: 30000, stdio: 'pipe' });
  const home = fs.readFileSync(path.join(temporary, 'docs/previews/playable.html'), 'utf8');
  const broken = home.replace('"./js/config":', '"./js/missing-config":');
  assert.notEqual(broken, home, 'Failure fixture must remove the shared config module');
  assert.throws(() => boot(broken, 'playable.html', ''), /Missing preview module/, 'Broken imports must fail startup');
  for (const [file, search, status, label] of [
    ['playable.html', '', '首页', '方寸九宫'],
    ['playable.html', '?size=small', '首页', '方寸九宫'],
    ['playable.html', '?lab=1', '对局中', null],
    ['daily-week.html', '', '对局中', null],
    ['gravity.html', '', '对局中', '落玉庭']
  ]) {
    const result = boot(fs.readFileSync(path.join(temporary, 'docs/previews', file), 'utf8'), file, search);
    assert.ok(result.elements.status.textContent.includes(status), file + search + ': expected ' + status);
    if (label) assert.ok(result.labels.some(text => text.includes(label)), file + ': missing ' + label);
    if (file === 'daily-week.html') assert.equal(result.elements['lab-level'].children.length, 7);
    if (search === '?lab=1') assert.ok(result.elements['lab-level'].children.length > 0);
  }
  console.log('PASS: freshly built home, small screen, challenge, daily and gravity previews boot, bind input and draw a frame');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
