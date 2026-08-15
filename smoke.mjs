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

// ---- tiny assertion helper (T00): failures exit non-zero ----
let failures = 0;
let checks = 0;
const assert = (cond, message) => {
  checks++;
  if (!cond) { failures++; console.error(`  ✗ ASSERT FAILED: ${message}`); }
  else console.log(`  ✓ ${message}`);
};
const isFiniteNum = v => typeof v === 'number' && Number.isFinite(v);

const { Game2D } = await import('./js/2d/game.js');
const { CONFIG } = await import('./js/2d/config.js');
const canvas = { width: 0, height: 0, style: {}, getContext: () => ctxProxy };
const game = new Game2D(canvas);

let t = 0;
const frames = n => { for (let i = 0; i < n; i++) { t += 16.7; const cb = rafCb; rafCb = null; cb(t); } };

frames(30); // menu
game.startGame();
console.log('after start: state =', game.state, '| wave =', game.wave);

// --- invariant: game starts in playing state at wave 1 ---
assert(game.state === 'playing', 'game starts in playing state');
assert(game.wave === 1, 'wave starts at 1');
// --- T01 invariant: metrics start zeroed ---
assert(game.runStats && game.runStats.enemiesKilled === 0 && game.runStats.elapsed === 0 && game.runStats.hitsTaken === 0, 'run metrics start zeroed');
assert(game.waveStats && game.waveStats.enemiesKilled === 0 && game.waveStats.hitsTaken === 0, 'wave metrics start zeroed');

// --- invariant: boost fuel decreases while Shift is held ---
const fuelBefore = game.boostFuel;
const keydown = handlers.keydown[0];
const keyup = handlers.keyup[0];
const press = code => { keydown({ code, preventDefault() {} }); };
const release = code => { keyup({ code }); };
press('ShiftLeft');
frames(60); // 1s of boost
release('ShiftLeft');
assert(game.boostFuel < fuelBefore, `boost fuel decreases while Shift is held (${fuelBefore} -> ${game.boostFuel.toFixed(1)})`);

// simulate movement + boost for a while
press('KeyD'); press('ShiftLeft');
frames(60 * 20); // 20s of play
console.log('after 20s: state =', game.state, '| enemies =', game.enemies.length,
  '| pBullets =', game.playerBullets.length, '| particles =', game.particles.length,
  '| score =', Math.floor(game.score), '| pending =', game.pendingSpawns.length);
release('KeyD'); release('ShiftLeft');

// fast-forward: kill all enemies repeatedly to walk through waves & upgrade screen
let reachedUpgrade = false;
for (let w = 0; w < 10; w++) {
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
    reachedUpgrade = true;
    // pick first upgrade card path via nextWave button handler
    game.ui.el.nextWave.onclick();
  }
}
// --- invariant: player can reach an upgrade screen ---
assert(reachedUpgrade, 'player can reach an upgrade screen');
// --- T01 invariant: player kills are counted in run metrics ---
assert(game.runStats.enemiesKilled > 0, `run kill metric counts player kills (${game.runStats.enemiesKilled})`);
assert(game.runStats.enemiesKilled >= game.waveStats.enemiesKilled, 'run kill metric accumulates across waves');

// --- T02 invariant: fuel depletion + fuel pickup restore ---
game.state = 'playing';
game.waveState = 'playing';
game.health = game.maxHealth;
game.ship.invuln = 2;
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.pickups.length = 0; game.enemyBullets.length = 0;
game.waveRemainingToSpawn = 0; game.waveSpawnComplete = false;
game.boostFuelMax = 100; game.boostFuel = 4; game.boostLocked = false;
const depBefore = game.runStats.fuelDepletedCount;
press('ShiftLeft'); frames(40); release('ShiftLeft');
assert(game.runStats.fuelDepletedCount === depBefore + 1, 'fuel depletion counted exactly once (no spam while holding Shift at empty)');
assert(['empty', 'low'].includes(game.fuelState), 'fuel state reports the depleted zone (low/empty)');
// recovery: passive regen re-engages boost after crossing the recover threshold
frames(300);
assert(game.boostFuel >= game.boostFuelMax * CONFIG.fuelRecoverRatio && !game.boostLocked, `boost re-engages once fuel recovers (fuel ${game.boostFuel.toFixed(1)})`);
assert(game.fuelState === 'normal', 'fuel state recovers to normal');
// fuel pickup restores, capped at max
game.boostFuel = 0; game.fuelState = 'empty'; game.boostLocked = false;
game.spawnPickup(game.ship.x + 5, game.ship.y, 'fuel');
frames(30);
assert(game.boostFuel > 0 && game.boostFuel <= game.boostFuelMax, `fuel pickup restores fuel, capped at max (${game.boostFuel.toFixed(1)})`);

// boss wave check (diagnostic only)
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

// --- invariant: game over updates/persists best score ---
game.health = 5;
const scoreAtDeath = Math.floor(game.score);
game.damagePlayer(999);
console.log('after lethal hit: state =', game.state, '| best stored =', store['sw2d_best']);
assert(game.state === 'gameover', 'game over triggers on lethal damage');
assert(store['sw2d_best'] !== undefined, 'best score persisted to localStorage on game over');
assert(isFiniteNum(game.best) && parseInt(store['sw2d_best'], 10) === game.best, 'stored best matches in-memory best');
assert(game.best >= scoreAtDeath, 'best is at least the final run score');

// --- invariant: restart restores wave, health, and run state ---
press('KeyR');
frames(5);
release('KeyR');
console.log('after R: state =', game.state, '| wave =', game.wave, '| health =', game.health);
assert(game.state === 'playing', 'restart returns to playing state');
assert(game.wave === 1, 'restart resets wave to 1');
assert(game.health === game.maxHealth && game.maxHealth === 100, 'restart restores full health');
assert(game.score < 1, 'restart resets score (only survival drip accumulates after)');
assert(game.enemies.length === 0 && game.pendingSpawns.length === 0, 'restart clears enemies and pending spawns');
// --- T01 invariant: restart resets all run metrics ---
assert(game.runStats.enemiesKilled === 0 && game.runStats.hitsTaken === 0 && game.runStats.pickupsCollected === 0 && game.runStats.elapsed < 1, 'restart resets all run metrics');
assert(game.waveStats.enemiesKilled === 0 && game.waveStats.hitsTaken === 0, 'restart resets wave metrics');

// pause toggle via P (diagnostic only)
press('KeyP'); frames(2); release('KeyP');
console.log('after P: state =', game.state);
press('KeyP'); frames(2); release('KeyP');
console.log('after P again: state =', game.state);

frames(60);
console.log(`\n${checks - failures}/${checks} assertions passed`);
if (failures > 0) {
  console.error(`SMOKE TEST FAILED (${failures} assertion(s))`);
  process.exit(1);
}
console.log('SMOKE TEST PASSED');
