// Headless smoke test: stubs DOM/canvas, runs the real game loop.
const handlers = {};
globalThis.addEventListener = (t, fn) => { (handlers[t] ||= []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.window = globalThis;
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };

const gradient = () => ({ addColorStop() {} });
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return gradient;
    return (..._a) => undefined;
  },
  set() { return true; },
});
const elStub = () => ({
  style: {}, textContent: '', innerHTML: '', className: '',
  appendChild() {}, onclick: null, display: '',
});
globalThis.document = {
  getElementById: () => elStub(),
  createElement: tag => tag === 'canvas'
    ? { width: 0, height: 0, getContext: () => ctxProxy }
    : elStub(),
  hidden: false,
  addEventListener: () => {},
};
const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};

const { Game2D } = await import('./js/2d/game.js');
const canvas = { width: 0, height: 0, style: {}, getContext: () => ctxProxy };
const game = new Game2D(canvas);

let t = 0;
const frames = n => { for (let i = 0; i < n; i++) { t += 16.7; const cb = rafCb; rafCb = null; cb(t); } };

frames(30); // menu
game.startGame();
console.log('after start: state =', game.state, '| wave =', game.wave);

// simulate input: move + boost for a while
handlers.keydown.forEach(fn => {});
const keydown = handlers.keydown[0];
const keyup = handlers.keyup[0];
const press = code => { keydown({ code, preventDefault() {} }); };
const release = code => { keyup({ code }); };
press('KeyD'); press('ShiftLeft');
frames(60 * 20); // 20s of play
console.log('after 20s: state =', game.state, '| enemies =', game.enemies.length,
  '| pBullets =', game.playerBullets.length, '| particles =', game.particles.length,
  '| score =', Math.floor(game.score), '| pending =', game.pendingSpawns.length);
release('KeyD'); release('ShiftLeft');

// fast-forward: kill all enemies repeatedly to walk through waves & upgrade screen
for (let w = 0; w < 8; w++) {
  frames(60 * 6); // let batches spawn
  if (game.state !== 'playing') break;
  while (game.enemies.length && game.state === 'playing') {
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      game.enemies[i].hp = 0;
      game.killEnemy(game.enemies[i], i);
    }
  }
  frames(10);
  console.log(`loop ${w}: state = ${game.state}, waveState = ${game.waveState}, wave = ${game.wave}`);
  if (game.waveState === 'upgrade') {
    // pick first upgrade card path via nextWave button handler
    game.ui.el.nextWave.onclick();
  }
}

// boss wave check
if (game.state === 'playing') {
  game.wave = 5;
  game.waveState = 'playing';
  game.spawnWave();
  frames(60 * 3);
  const boss = game.enemies.find(e => e.type === 'boss');
  console.log('boss wave: boss present =', !!boss, boss ? `(hp ${Math.floor(boss.hp)})` : '');
  frames(60 * 5); // let it attack
  console.log('boss attacks: enemyBullets =', game.enemyBullets.length, 'attackMode =', boss && boss.attackMode);
}

// game over check
game.health = 5;
game.damagePlayer(999);
console.log('after lethal hit: state =', game.state, '| best stored =', store['sw2d_best']);

// restart via R
press('KeyR');
frames(5);
release('KeyR');
console.log('after R: state =', game.state, '| wave =', game.wave, '| health =', game.health);

// pause toggle via P
press('KeyP'); frames(2); release('KeyP');
console.log('after P: state =', game.state);
press('KeyP'); frames(2); release('KeyP');
console.log('after P again: state =', game.state);

frames(60);
console.log('SMOKE TEST PASSED');
