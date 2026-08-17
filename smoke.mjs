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
const elStub = (tagName = 'div') => ({
  tagName, type: '', style: {}, textContent: '', innerHTML: '', className: '',
  children: [], setAttribute() {}, addEventListener() {}, focus() {},
  appendChild(child) { this.children.push(child); }, onclick: null, display: '',
});
globalThis.document = {
  getElementById: () => elStub(),
  createElement: tag => tag === 'canvas'
    ? { width: 0, height: 0, getContext: () => ctxProxy }
    : elStub(tag),
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
const { CONFIG, ENEMY_TYPES, WAVE_FAMILIES } = await import('./js/2d/config.js');
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

// --- T03 invariant: typed upgrades apply to run state without mutating CONFIG ---
const configBeforeUpgrades = JSON.stringify(CONFIG);
game.selectedUpgradeIds = new Set();
game.playerDamage = CONFIG.playerDamage;
game.autoFireRate = CONFIG.autoFireRate;
game.maxHealth = CONFIG.maxHealth;
game.health = game.maxHealth;
game.upgradeDefinitions = game.createUpgradeDefinitions();
const hull = game.upgradeDefinitions.find(o => o.id === 'hull-reinforcement');
const hullHealthBefore = game.maxHealth;
hull.apply(game);
game.selectedUpgradeIds.add(hull.id);
assert(hull.role === 'Survival' && hull.kind === 'reward', 'pure upgrade exposes its role and reward kind');
assert(game.maxHealth === hullHealthBefore + CONFIG.upgradeHullMaxHealth && game.health === game.maxHealth, 'hull reward increases and repairs max health');
const cannon = game.createUpgradeDefinitions().find(o => o.id === 'heavy-cannon');
const damageBeforeCannon = game.playerDamage;
const fireIntervalBeforeCannon = game.autoFireRate;
cannon.apply(game);
assert(cannon.role === 'Precision' && cannon.kind === 'tradeoff', 'tradeoff exposes its role and tradeoff kind');
assert(game.playerDamage > damageBeforeCannon && game.autoFireRate > fireIntervalBeforeCannon, 'Heavy Cannon trades slower firing for more damage');
assert(JSON.stringify(CONFIG) === configBeforeUpgrades, 'upgrade application does not mutate CONFIG');

// T03 UI matrix: three choices, keyboard-native buttons, and bounded limited choices.
const uiOptions = game.createUpgradeDefinitions().filter(o => o.isEligible(game)).slice(0, 4);
game.ui.el.upgrades.children.length = 0;
game.ui.showWaveComplete(1, 4, uiOptions, () => {});
assert(game.ui.el.upgrades.children.length === 3, 'upgrade UI shows exactly three choices when four are eligible');
assert(game.ui.el.upgrades.children.every(card => card.tagName === 'button' && card.innerHTML.includes('upgradeMeta') && (card.innerHTML.includes('REWARD') || card.innerHTML.includes('TRADEOFF'))), 'upgrade cards are keyboard buttons with visible role/kind metadata');
game.ui.el.upgrades.children.length = 0;
let uiPicked = 0;
game.ui.showWaveComplete(1, 4, uiOptions.slice(0, 1), () => { uiPicked++; });
assert(game.ui.el.upgrades.children.length === 1, 'upgrade UI safely renders fewer than three choices');
game.ui.el.upgrades.children[0].onclick();
assert(uiPicked === 1, 'keyboard-native upgrade card invokes the selection callback');

// Matrix coverage: a real choice advances once, and the same upgrade is then ineligible.
game.state = 'playing';
game.waveState = 'upgrade';
game.upgradeChoiceResolved = false;
game.upgradeDefinitions = game.createUpgradeDefinitions();
const selectable = game.upgradeDefinitions.find(o => o.id === 'ion-reserve');
const waveBeforeChoice = game.wave;
game.selectUpgrade(selectable);
game.selectUpgrade(selectable);
assert(game.wave === waveBeforeChoice + 1 && game.selectedUpgradeIds.has(selectable.id), 'selecting an eligible upgrade applies it and advances exactly once');
assert(!game.createUpgradeDefinitions().find(o => o.id === selectable.id).isEligible(game), 'selected upgrade is excluded from repeat choices');
game.waveState = 'upgrade';
game.upgradeChoiceResolved = false;
const waveBeforeSkip = game.wave;
game.skipUpgrade();
assert(game.wave === waveBeforeSkip + 1, 'skip safely advances when a limited choice set is exhausted');

// --- T04 invariant: skill-based scoring & Perfect Clears ---
// Helper: drive the game to a clean, controlled end-of-wave state so startUpgradeScreen can be exercised deterministically.
const resetForClear = () => {
  game.state = 'playing';
  game.waveState = 'playing';
  game.enemies.length = 0;
  game.pendingSpawns.length = 0;
  game.playerBullets.length = 0;
  game.enemyBullets.length = 0;
  game.pickups.length = 0;
  game.waveRemainingToSpawn = 0;
  game.waveSpawnComplete = true;
  game.waveStats.hitsTaken = 0;
  game.waveStats.enemiesKilled = 0;
};
// eligible: a no-hit wave awards exactly one Perfect Clear bonus
resetForClear();
let waveT4 = 3;
let scoreBeforeClear = game.score;
let perfectBeforeClear = game.runStats.perfectWaves;
game.wave = waveT4;
game.startUpgradeScreen();
let expectedBonus = CONFIG.perfectClearBase + CONFIG.perfectClearPerWave * (waveT4 - 1);
assert(game.score === scoreBeforeClear + expectedBonus, `no-hit wave awards exactly one Perfect Clear bonus (+${expectedBonus})`);
assert(game.runStats.perfectWaves === perfectBeforeClear + 1, 'Perfect Clear count increments for a no-hit wave');
// ineligible: a wave with one unshielded hit receives no bonus
resetForClear();
game.wave = waveT4;
game.waveStats.hitsTaken = 1;
let scoreBeforeHit = game.score;
let perfectBeforeHit = game.runStats.perfectWaves;
game.startUpgradeScreen();
assert(game.score === scoreBeforeHit, 'a wave with one unshielded hit awards no Perfect Clear bonus');
assert(game.runStats.perfectWaves === perfectBeforeHit, 'Perfect Clear count unchanged after a hit wave');
// shielded projectile contact does not invalidate Perfect Clear (no damage taken => hitsTaken stays 0)
resetForClear();
let waveT4b = 2;
game.wave = waveT4b;
game.waveSpawnComplete = false; // keep this isolated step from auto-completing the wave
game.ship.invuln = 0;
game.shieldTime = 5;
game.enemyBullets.length = 0;
game.enemyBullets.push({ x: game.ship.x, y: game.ship.y, vx: 0, vy: 0, life: 2, color: '#fff', type: 'fighter', dmg: 10 });
let shieldHitsBefore = game.waveStats.hitsTaken;
let scoreBeforeShielded = game.score;
frames(1);
assert(game.waveStats.hitsTaken === shieldHitsBefore, 'shielded projectile contact does not count as a hit (Perfect Clear stays valid)');
// the same shielded wave, when cleared, still earns its bonus
let perfectBeforeShielded = game.runStats.perfectWaves;
game.waveSpawnComplete = true;
game.startUpgradeScreen();
let shieldedBonus = CONFIG.perfectClearBase + CONFIG.perfectClearPerWave * (waveT4b - 1);
assert(game.score === scoreBeforeShielded + shieldedBonus, 'a wave with only shielded contact still earns the Perfect Clear bonus');
assert(game.runStats.perfectWaves === perfectBeforeShielded + 1, 'Perfect Clear count increments for a shielded-only wave');

// --- T05 invariant: wave families drive composition & cadence ---
game.state = 'playing';
game.waveState = 'playing';
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.playerBullets.length = 0; game.enemyBullets.length = 0;
game.pickups.length = 0;
game.waveRemainingToSpawn = 0; game.waveSpawnComplete = false;
// teaching wave: wave 1 is always the swarm family
game.wave = 1;
game.spawnWave();
assert(game.waveFamily === 'swarm', 'wave 1 is always the swarm teaching family');
// forced family (one-shot test hook): movement yields only fast pressure, within its timing range
// (wave 6: movement-eligible and not a boss wave, so no Overlord in the pending list)
game.wave = 6;
game.forceWaveFamily = 'movement';
game.pendingSpawns.length = 0;
game.spawnWave();
assert(game.waveFamily === 'movement', 'forced family is stored on the game');
assert(game.forceWaveFamily === null, 'one-shot force hook clears after use');
game.waveSpawnTimer = 0; // queue exactly one batch, deterministically
frames(1);
const moveTypes = new Set(game.pendingSpawns.map(p => p.type));
assert(game.pendingSpawns.length > 0 && [...moveTypes].every(t => t === 'scout' || t === 'fighter' || t === 'blocker'), `movement family spawns only fast pressure + Blocker (got ${[...moveTypes].join(',') || 'none'})`);
assert(game.waveSpawnTimer >= 0.6 && game.waveSpawnTimer <= 1.6, `next batch delay uses the family range (${game.waveSpawnTimer.toFixed(2)}s within [0.6, 1.6])`);
// no consecutive family repeats when alternatives exist
game.wave = 5;
const famSeq = [];
for (let i = 0; i < 20; i++) { game.spawnWave(); famSeq.push(game.waveFamily); }
assert(famSeq.every((f, i) => i === 0 || f !== famSeq[i - 1]), `no family repeats back-to-back across 20 waves (${famSeq.join('>')})`);
// boss wave keeps the Overlord spawn and still stores a family
game.wave = 5;
game.pendingSpawns.length = 0;
game.spawnWave();
assert(game.pendingSpawns.some(p => p.type === 'boss'), 'boss wave still schedules the Overlord');
assert(game.waveFamily in WAVE_FAMILIES, 'boss wave still stores a valid family');
// panic family: breathing interval after every breathEvery-th batch while enemies remain
game.forceWaveFamily = 'panic';
game.pendingSpawns.length = 0;
game.spawnWave();
game.waveBatchCount = 1;
game.waveSpawnTimer = 0;
frames(1);
assert(game.waveBatchCount === 2 && game.waveSpawnTimer >= 2.5 && game.waveSpawnTimer <= 3.5, `panic breathing interval applied after 2nd batch (${game.waveSpawnTimer.toFixed(2)}s within [2.5, 3.5])`);
// unknown weight keys are ignored (forward-compat for future enemy types)
WAVE_FAMILIES.__test = { minWave: 1, weights: { ghost: 100, scout: 1 }, batch: [1, 1], delay: [0.1, 0.2] };
game.forceWaveFamily = '__test';
game.spawnWave();
const unknownPicks = new Set();
for (let i = 0; i < 50; i++) unknownPicks.add(game.weightedPick());
delete WAVE_FAMILIES.__test;
assert(unknownPicks.size === 1 && unknownPicks.has('scout'), 'unknown weight keys are ignored by weightedPick');
// restore a clean playing state for later sections
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.enemyBullets.length = 0; game.playerBullets.length = 0; game.pickups.length = 0;
game.wave = 3; game.state = 'playing'; game.waveState = 'playing';
game.waveRemainingToSpawn = 0; game.waveSpawnComplete = true;

// --- T06 invariant: Blocker enemy — clamped intercept, no projectiles, gated waves ---
game.state = 'playing';
game.waveState = 'playing';
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.playerBullets.length = 0; game.enemyBullets.length = 0; game.pickups.length = 0;
game.waveRemainingToSpawn = 0; game.waveSpawnComplete = false;
// FIRST_APPEARANCE: wave 3 schedules exactly one Blocker; family support fills the rest
game.wave = 3;
game.spawnWave();
const w3Blockers = game.pendingSpawns.filter(p => p.type === 'blocker');
assert(w3Blockers.length === 1, `wave 3 first appearance schedules exactly one Blocker (got ${w3Blockers.length})`);
assert(game.waveRemainingToSpawn === game.waveTotal - 1, 'first-appearance Blocker counts against the wave total');
// ELIGIBILITY_GATE: family weights never pick Blocker at or before the first-appearance wave
game.wave = 2;
game.forceWaveFamily = 'panic'; // panic carries a blocker weight — the gate must suppress it
game.spawnWave();
const earlyPicks = new Set();
for (let i = 0; i < 200; i++) earlyPicks.add(game.weightedPick());
assert(!earlyPicks.has('blocker'), `family weights never pick Blocker at wave <= ${CONFIG.blockerMinWave} (got ${[...earlyPicks].join(',')})`);
// PREDICT_CLAMP: Blocker steers toward a clamped projected point, not the player's current position
game.wave = 3;
game.forceWaveFamily = 'swarm';
game.pendingSpawns.length = 0;
game.spawnWave();
game.enemies.length = 0;
game.materializeSpawn({ x: game.ship.x + 300, y: game.ship.y, t: 0, type: 'blocker' });
const blk = game.enemies[0];
assert(blk && blk.type === 'blocker', 'Blocker type materializes via materializeSpawn');
game.ship.vx = 2000; game.ship.vy = 0; // fast-moving player
frames(2);
const bt = ENEMY_TYPES.blocker;
const leadDist = Math.hypot(blk.blockTarget.x - game.ship.x, blk.blockTarget.y - game.ship.y);
assert(leadDist <= bt.predictLeadMax + 1e-6, `prediction lead is clamped to predictLeadMax (${leadDist.toFixed(1)} <= ${bt.predictLeadMax})`);
assert(blk.blockTarget.x - game.ship.x > 0, 'prediction projects ahead of player velocity, not at the current position');
const toTarget = Math.atan2(blk.blockTarget.y - blk.y, blk.blockTarget.x - blk.x);
let headingErr = Math.abs(Math.atan2(blk.vy, blk.vx) - toTarget);
if (headingErr > Math.PI) headingErr = 2 * Math.PI - headingErr;
assert(headingErr < 0.35, `Blocker steers toward the projected point (heading error ${headingErr.toFixed(2)} rad)`);
// NO_PROJ: Blocker in range with expired cooldown fires no projectiles
blk.x = game.ship.x + 150; blk.y = game.ship.y;
blk.fireCooldown = 0;
game.ship.invuln = 1;
game.enemyBullets.length = 0;
frames(10);
assert(!game.enemyBullets.some(b => b.type === 'blocker'), 'Blocker fires no projectiles even in range');
// FAMILY_WEIGHT: mid-game movement family can pick Blocker
game.wave = 4;
game.forceWaveFamily = 'movement';
game.spawnWave();
const midPicks = new Set();
for (let i = 0; i < 300; i++) midPicks.add(game.weightedPick());
assert(midPicks.has('blocker'), `mid-game movement family can pick Blocker (got ${[...midPicks].join(',')})`);
// SEPARATION: overlapping Blockers push apart (placed beyond autoRange so the player doesn't interfere)
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.playerBullets.length = 0;
game.materializeSpawn({ x: game.ship.x - 500, y: game.ship.y - 500, t: 0, type: 'blocker' });
game.materializeSpawn({ x: game.ship.x - 490, y: game.ship.y - 500, t: 0, type: 'blocker' });
const [b1, b2] = game.enemies;
const sepD0 = Math.hypot(b1.x - b2.x, b1.y - b2.y);
frames(60);
const sepD1 = Math.hypot(b1.x - b2.x, b1.y - b2.y);
assert(sepD1 > sepD0, `separation pushes overlapping Blockers apart (${sepD0.toFixed(1)} -> ${sepD1.toFixed(1)})`);
// restore a clean playing state for later sections
game.enemies.length = 0; game.pendingSpawns.length = 0;
game.enemyBullets.length = 0; game.playerBullets.length = 0; game.pickups.length = 0;
game.wave = 3; game.state = 'playing'; game.waveState = 'playing';
game.waveRemainingToSpawn = 0; game.waveSpawnComplete = true;

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
assert(game.score < 1, 'restart resets score (no passive survival drip)');
assert(game.enemies.length === 0 && game.pendingSpawns.length === 0, 'restart clears enemies and pending spawns');
// --- T01 invariant: restart resets all run metrics ---
assert(game.runStats.enemiesKilled === 0 && game.runStats.hitsTaken === 0 && game.runStats.pickupsCollected === 0 && game.runStats.elapsed < 1, 'restart resets all run metrics');
assert(game.runStats.perfectWaves === 0, 'restart resets the Perfect Clear count');
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
