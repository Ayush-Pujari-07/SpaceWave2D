import { CONFIG, ENEMY_TYPES, WAVE_FAMILIES } from './config.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { buildSprites } from './sprites.js';

const STEP = 1 / 60; // fixed timestep: identical speed on 60/120/144Hz displays

export class Game2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager();
    this.ui = new UI();
    this.sfx = new Sfx();
    this.sprites = buildSprites();
    this.dpr = 1;
    this.best = +(localStorage.getItem('sw2d_best') || 0);
    this.state = 'menu';

    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });

    this.ui.el.startBtn.onclick = () => { this.sfx.ensure(); this.sfx.ui(); this.startGame(); };
    this.ui.el.resumeBtn.onclick = () => { this.sfx.ui(); this.resumeGame(); };
    this.ui.el.nextWave.onclick = () => { this.sfx.ui(); this.skipUpgrade(); };
    this.ui.el.restart.onclick = () => { this.sfx.ui(); this.startGame(); };
    this.ui.el.pauseRestart.onclick = () => { this.sfx.ui(); this.startGame(); };

    this.lastT = performance.now();
    this.acc = 0;
    this.initMenu();
    requestAnimationFrame(t => this.loop(t));
  }

  // ---------- setup ----------

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = innerWidth;
    this.H = innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.generateSpawnPoints();
    this.buildBackground();
  }

  generateSpawnPoints() {
    this.spawnPoints = [];
    const count = CONFIG.spawnPointsCount;
    const radius = Math.max(this.W, this.H) * 0.55;
    const cx = this.W / 2, cy = this.H / 2;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      this.spawnPoints.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
    }
  }

  buildBackground() {
    this.stars = [];
    const n = Math.floor((this.W * this.H) / 9000);
    for (let i = 0; i < n; i++) {
      const z = Math.random();
      this.stars.push({ x: Math.random() * this.W, y: Math.random() * this.H, z: 0.2 + z * 0.8, s: 0.5 + z * 1.6 });
    }
    this.nebulae = [];
    for (let i = 0; i < 3; i++) {
      this.nebulae.push({
        x: Math.random() * this.W, y: Math.random() * this.H,
        scale: 1 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
        img: this.sprites.nebulae[i % 3],
      });
    }
  }

  initMenu() {
    this.resetState();
    this.state = 'menu';
    this.ui.showStart(this.best);
  }

  startGame() {
    this.resetState();
    this.state = 'playing';
    this.spawnWave();
    this.ui.hideStart();
    this.ui.hidePause();
    this.ui.hideGameOver();
    this.ui.hideWaveComplete();
    this.ui.showHUD();
    this.lastT = performance.now();
    this.acc = 0;
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showPause(this.wave, this.score);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.lastT = performance.now();
    this.acc = 0;
  }

  resetState() {
    this.score = 0;
    this.maxHealth = CONFIG.maxHealth;
    this.health = this.maxHealth;
    this.shieldTime = 0;
    this.boostFuelMax = CONFIG.boostFuelMax;
    this.boostFuel = this.boostFuelMax;
    this.playerDamage = CONFIG.playerDamage;
    this.autoFireRate = CONFIG.autoFireRate;
    this.shieldBonus = CONFIG.shieldDefault;
    this.multishot = 1;
    this.shotSpread = 0.12;
    // T03: run-local upgrade values; imported CONFIG remains immutable.
    this.playerAccel = CONFIG.accel;
    this.boostMultiplier = CONFIG.boostMultiplier;
    this.boostDrain = CONFIG.boostDrain;
    this.pickupMagnet = CONFIG.pickupMagnet;
    this.contactDamageMultiplier = 1;
    this.selectedUpgradeIds = new Set();
    this.upgradeChoiceResolved = false;
    this.upgradeDefinitions = this.createUpgradeDefinitions();
    this.comboKills = 0;
    this.comboTimer = 0;
    this.wave = 1;
    this.waveState = 'playing';
    // T05: wave family identity (never revealed to the player before the wave)
    this.waveFamily = null;
    this.lastWaveFamily = null;
    this.waveBatchCount = 0;
    this.forceWaveFamily = null; // one-shot test hook, not a public API
    this.waveTotal = 0;
    this.waveRemainingToSpawn = 0;
    this.waveSpawnTimer = 0;
    this.waveSpawnComplete = false;
    this.waveSpawnedCount = 0;
    this.time = 0;
    this.lastShot = -9;
    this.lastHealSfxAt = -9; // T07: heal-sound throttle
    this.shake = 0;
    this.banner = null;
    this.ship = { x: this.W / 2, y: this.H / 2, vx: 0, vy: 0, angle: 0, invuln: 0 };
    this.enemies = [];
    this.pendingSpawns = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.beams = [];
    // T01: run/wave metrics
    this.wasBoosting = false;
    this.fuelState = 'normal'; // T02: normal | low | empty
    this.boostLocked = false; // T02: true while boost is locked out after empty fuel
    this.runStats = {
      elapsed: 0,
      enemiesKilled: 0,
      pickupsCollected: 0,
      damageTaken: 0,
      hitsTaken: 0,
      boostsUsed: 0,
      fuelDepletedCount: 0,
      highestCombo: 1,
      perfectWaves: 0,
    };
    this.resetWaveStats();
    this.lastDamage = null; // T08: final-hit context for the Run Debrief
  }

  resetWaveStats() {
    this.waveStats = {
      damageTaken: 0,
      hitsTaken: 0,
      enemiesKilled: 0,
      startedAt: this.time,
    };
  }

  // ---------- upgrades ----------

  formatUpgradeNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  }

  createUpgradeDefinitions() {
    const f = value => this.formatUpgradeNumber(value);
    const once = id => game => !game.selectedUpgradeIds.has(id);
    return [
      {
        id: 'hull-reinforcement', icon: '❤️', name: 'Hull Reinforcement', rarity: 'common', role: 'Survival', kind: 'reward',
        description: `Max health +${f(CONFIG.upgradeHullMaxHealth)} and repair ${f(CONFIG.upgradeHullMaxHealth)} health`,
        isEligible: once('hull-reinforcement'),
        apply: game => { game.maxHealth += CONFIG.upgradeHullMaxHealth; game.health = Math.min(game.maxHealth, game.health + CONFIG.upgradeHullMaxHealth); },
      },
      {
        id: 'ion-reserve', icon: '⚡', name: 'Ion Reserve', rarity: 'common', role: 'Mobility', kind: 'reward',
        description: `Boost capacity +${f(CONFIG.upgradeFuelCapacity)} and refill`,
        isEligible: once('ion-reserve'),
        apply: game => { game.boostFuelMax += CONFIG.upgradeFuelCapacity; game.boostFuel = game.boostFuelMax; },
      },
      {
        id: 'tractor-field', icon: '🧲', name: 'Tractor Field', rarity: 'common', role: 'Utility', kind: 'reward',
        description: `Pickup magnet +${f(CONFIG.upgradePickupMagnet)} range`,
        isEligible: once('tractor-field'),
        apply: game => { game.pickupMagnet += CONFIG.upgradePickupMagnet; },
      },
      {
        id: 'aegis-field', icon: '🛡️', name: 'Aegis Field', rarity: 'common', role: 'Survival', kind: 'reward',
        description: `Shield duration +${f(CONFIG.upgradeShieldDuration)}s`,
        isEligible: once('aegis-field'),
        apply: game => { game.shieldBonus += CONFIG.upgradeShieldDuration; },
      },
      {
        id: 'heavy-cannon', icon: '🎯', name: 'Heavy Cannon', rarity: 'rare', role: 'Precision', kind: 'tradeoff',
        description: `Damage +${f(CONFIG.heavyCannonDamage)} (${f(this.playerDamage)} → ${f(this.playerDamage + CONFIG.heavyCannonDamage)}); fire interval +${f((CONFIG.heavyCannonFireRateMultiplier - 1) * 100)}%`,
        isEligible: once('heavy-cannon'),
        apply: game => { game.playerDamage += CONFIG.heavyCannonDamage; game.autoFireRate *= CONFIG.heavyCannonFireRateMultiplier; },
      },
      {
        id: 'split-shot', icon: '✨', name: 'Split Shot', rarity: 'epic', role: 'Horde', kind: 'tradeoff',
        description: `+${f(CONFIG.splitShotProjectiles)} projectile and spread +${f(CONFIG.splitShotSpread)} rad; fire interval +${f((CONFIG.splitShotFireRateMultiplier - 1) * 100)}%`,
        isEligible: game => !game.selectedUpgradeIds.has('split-shot') && game.multishot < 3,
        apply: game => { game.multishot = Math.min(3, game.multishot + CONFIG.splitShotProjectiles); game.shotSpread += CONFIG.splitShotSpread; game.autoFireRate *= CONFIG.splitShotFireRateMultiplier; },
      },
      {
        id: 'overcharged-thrusters', icon: '🔥', name: 'Overcharged Thrusters', rarity: 'rare', role: 'Mobility', kind: 'tradeoff',
        description: `Boost effect +${f(CONFIG.overchargedBoostMultiplier)}x (${f(this.boostMultiplier)}x → ${f(this.boostMultiplier + CONFIG.overchargedBoostMultiplier)}x); fuel drain +${f((CONFIG.overchargedBoostDrainMultiplier - 1) * 100)}%`,
        isEligible: once('overcharged-thrusters'),
        apply: game => { game.boostMultiplier += CONFIG.overchargedBoostMultiplier; game.boostDrain *= CONFIG.overchargedBoostDrainMultiplier; },
      },
      {
        id: 'heavy-plating', icon: '🧱', name: 'Heavy Plating', rarity: 'rare', role: 'Survival', kind: 'tradeoff',
        description: `Max health +${f(CONFIG.heavyPlatingMaxHealth)}; contact damage -${f((1 - CONFIG.heavyPlatingContactDamageMultiplier) * 100)}%; acceleration -${f((1 - CONFIG.heavyPlatingAccelMultiplier) * 100)}%`,
        isEligible: once('heavy-plating'),
        apply: game => { game.maxHealth += CONFIG.heavyPlatingMaxHealth; game.health = Math.min(game.maxHealth, game.health + CONFIG.heavyPlatingMaxHealth); game.contactDamageMultiplier *= CONFIG.heavyPlatingContactDamageMultiplier; game.playerAccel *= CONFIG.heavyPlatingAccelMultiplier; },
      },
      {
        id: 'blood-shield', icon: '🩸', name: 'Blood Shield', rarity: 'epic', role: 'Risk', kind: 'tradeoff',
        description: `Kills restore ${f(CONFIG.bloodShieldHeal)} HP (boss ×${f(CONFIG.bloodShieldBossMultiplier)}); max health -${f((1 - CONFIG.bloodShieldMaxHealthMultiplier) * 100)}%`,
        isEligible: once('blood-shield'),
        apply: game => { game.maxHealth = Math.round(game.maxHealth * CONFIG.bloodShieldMaxHealthMultiplier); game.health = Math.min(game.health, game.maxHealth); },
      },
    ];
  }

  selectUpgrade(option) {
    if (this.waveState !== 'upgrade' || this.upgradeChoiceResolved) return;
    const current = this.upgradeDefinitions.find(o => o.id === option.id);
    if (!current || !current.isEligible(this)) return;
    this.upgradeChoiceResolved = true;
    current.apply(this);
    this.selectedUpgradeIds.add(current.id);
    this.nextWave();
  }

  skipUpgrade() {
    if (this.waveState !== 'upgrade' || this.upgradeChoiceResolved) return;
    this.upgradeChoiceResolved = true;
    this.nextWave();
  }

  // ---------- waves & spawning ----------

  // T05: pick this wave's family — eligible by minWave, no consecutive repeat
  // when at least two families are eligible. Wave 1 is always the teaching family.
  chooseWaveFamily() {
    const eligible = Object.keys(WAVE_FAMILIES).filter(k => WAVE_FAMILIES[k].minWave <= this.wave);
    let pool = eligible.filter(k => k !== this.lastWaveFamily);
    if (pool.length === 0) pool = eligible;
    return pool[(Math.random() * pool.length) | 0];
  }

  weightedPick() {
    // T05: family weights drive composition; unknown keys (future types) are ignored.
    const fam = WAVE_FAMILIES[this.waveFamily];
    const weights = {};
    if (fam) {
      for (const k in fam.weights) {
        if (ENEMY_TYPES[k] && fam.weights[k] > 0) weights[k] = fam.weights[k];
      }
      // T06: family weights only contribute Blockers in mid-game waves; the
      // first-appearance wave gets exactly one deterministic Blocker instead
      if (this.wave <= CONFIG.blockerMinWave) delete weights.blocker;
    }
    if (Object.keys(weights).length === 0) {
      // Fallback: legacy wave-scaled table (defensive; family is always set by spawnWave)
      const w = this.wave;
      Object.assign(weights, {
        scout: Math.min(70, 40 + w * 3),
        fighter: 35,
        tank: w >= 4 ? 12 + (w - 4) : 4,
        sniper: w >= 3 ? 8 + (w - 3) * 2 : 0,
      });
    }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return 'fighter';
  }

  pickSpawnPos() {
    if (Math.random() < CONFIG.spawnNearPlayerChance) {
      const a = Math.random() * Math.PI * 2;
      const d = CONFIG.spawnNearMin + Math.random() * (CONFIG.spawnNearMax - CONFIG.spawnNearMin);
      return { x: this.ship.x + Math.cos(a) * d, y: this.ship.y + Math.sin(a) * d };
    }
    const minSafe = 150;
    for (let i = 0; i < 10; i++) {
      const sp = this.spawnPoints[(Math.random() * this.spawnPoints.length) | 0];
      if (Math.hypot(this.ship.x - sp.x, this.ship.y - sp.y) >= minSafe) {
        return { x: sp.x + (Math.random() - 0.5) * CONFIG.spawnJitter, y: sp.y + (Math.random() - 0.5) * CONFIG.spawnJitter };
      }
    }
    let best = null, bd = -1;
    for (const sp of this.spawnPoints) {
      const d = Math.hypot(this.ship.x - sp.x, this.ship.y - sp.y);
      if (d > bd) { bd = d; best = sp; }
    }
    return { x: best.x, y: best.y };
  }

  spawnWave() {
    // T05: choose (or force, for tests) this wave's family before anything spawns
    this.lastWaveFamily = this.waveFamily;
    this.waveFamily = this.forceWaveFamily || this.chooseWaveFamily();
    this.forceWaveFamily = null;
    this.waveTotal = CONFIG.waveEnemiesBase + (this.wave - 1) * CONFIG.waveEnemyGrowth;
    this.waveRemainingToSpawn = this.waveTotal;
    this.waveSpawnTimer = 0.3;
    this.waveSpawnComplete = false;
    this.waveSpawnedCount = 0;
    this.waveBatchCount = 0;
    this.banner = { text: `WAVE ${this.wave}`, t: 2, color: '#7dd3fc' };
    if (this.wave % CONFIG.bossEvery === 0) {
      this.pendingSpawns.push({ x: this.W / 2, y: 70, t: 1.8, type: 'boss' });
      this.banner = { text: '⚠ OVERLORD INBOUND ⚠', t: 2.5, color: '#f472b6' };
      this.sfx.bossWarning();
    }
    // T06: first appearance — exactly one Blocker with light support on the
    // first eligible wave; the rest of the wave comes from the family
    if (this.wave === CONFIG.blockerMinWave && this.waveRemainingToSpawn > 0) {
      const pos = this.pickSpawnPos();
      this.pendingSpawns.push({ ...pos, t: CONFIG.spawnWarnTime, type: 'blocker' });
      this.waveRemainingToSpawn--;
    }
  }

  materializeSpawn(p) {
    const t = ENEMY_TYPES[p.type];
    const hp = t.hpBase * (1 + (this.wave - 1) * 0.15);
    this.enemies.push({
      x: p.x, y: p.y, vx: 0, vy: 0,
      r: t.r, hp, hpMax: hp,
      fireCooldown: t.fireRate * (0.5 + Math.random() * 0.8),
      fireRate: Math.max(t.fireRate * 0.55, t.fireRate * (1 - this.wave * 0.015)),
      windup: 0, angle: Math.random() * Math.PI * 2,
      type: p.type, color: t.color, speed: t.speed,
      flash: 0, strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 1 + Math.random() * 2,
      attackTimer: 2, spiralA: 0,
    });
    this.waveSpawnedCount++;
  }

  spawnPickup(x, y, type) {
    this.pickups.push({ x, y, type, life: CONFIG.pickupLife });
  }

  startUpgradeScreen() {
    this.waveState = 'upgrade';
    this.upgradeChoiceResolved = false;
    // T04: Perfect Clear — the wave ended with zero unshielded hits (waveStats.hitsTaken).
    // Shielded contact never reaches damagePlayer, so it does not invalidate the clear.
    const perfect = this.waveStats.hitsTaken === 0;
    let perfectBonus = 0;
    if (perfect) {
      perfectBonus = CONFIG.perfectClearBase + CONFIG.perfectClearPerWave * (this.wave - 1);
      this.score += perfectBonus;
      this.runStats.perfectWaves++;
    }
    this.sfx.waveClear();
    if (perfect) this.sfx.perfectClear();
    // Rebuild descriptions from current run values so displayed numbers stay truthful.
    this.upgradeDefinitions = this.createUpgradeDefinitions();
    const options = this.upgradeDefinitions.filter(o => o.isEligible(this));
    this.ui.showWaveComplete(this.wave, this.waveTotal, options, o => this.selectUpgrade(o), perfect, perfectBonus);
  }

  nextWave() {
    this.ui.hideWaveComplete();
    this.wave++;
    this.resetWaveStats(); // T01: wave metrics reset when a new wave starts
    this.boostFuel = this.boostFuelMax;
    this.waveState = 'playing';
    this.enemies.length = 0;
    this.pendingSpawns.length = 0;
    this.playerBullets.length = 0;
    this.enemyBullets.length = 0;
    this.pickups.length = 0;
    this.particles.length = 0;
    this.popups.length = 0;
    this.rings.length = 0;
    this.beams.length = 0;
    this.spawnWave();
  }

  gameOver() {
    this.state = 'gameover';
    this.addShake(20);
    this.sfx.explosion(true);
    this.addExplosion(this.ship.x, this.ship.y, '#7dd3fc', 60);
    const s = Math.floor(this.score);
    const isNew = s > this.best;
    if (isNew) { this.best = s; localStorage.setItem('sw2d_best', String(this.best)); }
    this.ui.showGameOver(this.wave, s, this.best, isNew, this.buildDebrief());
  }

  // ---------- T08: Run Debrief (heuristic combat analysis) ----------

  countNearbyEnemies(x, y, radius) {
    let n = 0;
    for (const e of this.enemies) {
      if (Math.hypot(e.x - x, e.y - y) <= radius) n++;
    }
    return n;
  }

  nearArenaEdge(x, y) {
    const bx = this.W * CONFIG.debriefEdgeRatio;
    const by = this.H * CONFIG.debriefEdgeRatio;
    return x < bx || x > this.W - bx || y < by || y > this.H - by;
  }

  // Exactly one finding from the priority-ordered rules; weak evidence is worded "likely".
  analyzeRun() {
    const d = this.lastDamage;
    const ws = this.waveStats || { hitsTaken: 0, damageTaken: 0, enemiesKilled: 0 };
    const nearby = d ? d.nearbyEnemies : 0;
    const family = d ? d.waveFamily : this.waveFamily;
    // 1. Low mobility — boost unavailable on the final hit
    if (d && d.playerFuel <= 0) {
      return {
        title: 'Low mobility',
        explanation: 'Your boost fuel was empty on the final hit, so you could not burst away from the pressure.',
        suggestion: 'Collect amber fuel pods or take Ion Reserve before pushing into dense waves.',
      };
    }
    // 2. Overwhelmed by swarm pressure
    if (nearby >= CONFIG.debriefSwarmNearby || family === 'swarm') {
      return {
        title: 'Overwhelmed by swarm pressure',
        explanation: nearby >= CONFIG.debriefSwarmNearby
          ? `${nearby} enemies were close when you fell — the horde closed in faster than you could clear it.`
          : 'You likely fell during a swarm wave — those waves stack numbers over time and punish standing still.',
        suggestion: 'Keep moving in wide arcs and let auto-fire thin the horde; avoid stopping mid-swarm.',
      };
    }
    // 3. Cornered — contact death at the arena edge with multiple enemies
    if (d && d.sourceType === 'contact' && nearby >= CONFIG.debriefCorneredNearby && this.nearArenaEdge(this.ship.x, this.ship.y)) {
      return {
        title: 'Cornered',
        explanation: `You were pressed against the arena edge with ${nearby} enemies nearby when contact ended the run.`,
        suggestion: 'When enemies close in, boost toward open space and keep a wall-free escape route.',
      };
    }
    // 4. Low focused damage — durable precision-wave survivors
    if (family === 'precision' && (this.enemies.length >= 2 || ws.enemiesKilled < this.waveTotal / 2)) {
      return {
        title: 'Low focused damage',
        explanation: `The precision wave outlasted your fire — ${ws.enemiesKilled} of ${this.waveTotal} cleared${this.enemies.length ? `, ${this.enemies.length} still alive when you fell` : ''}.`,
        suggestion: 'Durable targets need sustained fire — consider Heavy Cannon or Split Shot at the next upgrade screen.',
      };
    }
    // 5. Missed a telegraphed attack — sniper/boss projectile final hit
    if (d && d.sourceType === 'projectile' && (d.enemyType === 'sniper' || d.enemyType === 'boss')) {
      return d.enemyType === 'sniper'
        ? {
            title: 'Missed a telegraphed attack',
            explanation: 'The final hit came from a sniper — snipers show a dashed aim line during windup before firing.',
            suggestion: 'Move off the dashed aim line as soon as you see a sniper winding up.',
          }
        : {
            title: 'Missed a telegraphed attack',
            explanation: 'The final hit came from the Overlord — its bullet patterns repeat and are readable.',
            suggestion: 'Track the Overlord\'s repeating patterns and keep moving between bursts.',
          };
    }
    // 6. Fallback
    return {
      title: 'Sustained damage over the wave',
      explanation: `You took ${ws.hitsTaken} hits for ${Math.round(ws.damageTaken)} damage this wave — the pressure added up.`,
      suggestion: 'Use blue shields and keep moving through dense fire to stretch the run.',
    };
  }

  buildDebrief() {
    const rs = this.runStats || {};
    const defs = this.upgradeDefinitions || [];
    return {
      finding: this.analyzeRun(),
      build: [...(this.selectedUpgradeIds || [])].map(id => {
        const def = defs.find(o => o.id === id);
        return def ? { icon: def.icon, name: def.name } : { icon: '', name: id };
      }),
      time: rs.elapsed ?? 0,
      kills: rs.enemiesKilled ?? 0,
      highestCombo: rs.highestCombo ?? 1,
      perfects: rs.perfectWaves ?? 0,
    };
  }

  // ---------- fx helpers ----------

  addParticle(x, y, vx, vy, life, size, color) {
    if (this.particles.length >= CONFIG.particleCap) this.particles.shift();
    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  addExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 240;
      this.addParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + Math.random() * 0.5, 2 + Math.random() * 2.5, color);
    }
  }

  addShake(mag) { this.shake = Math.min(26, this.shake + mag); }

  addPopup(x, y, text, color = '#fde68a') {
    this.popups.push({ x, y, text, life: 1, color });
  }

  rotateToward(a, b, max) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= max) return b;
    return a + Math.sign(d) * max;
  }

  // ---------- combat ----------

  findNearestTarget() {
    let best = null, bestDist = CONFIG.autoRange;
    for (const e of this.enemies) {
      const d = Math.hypot(this.ship.x - e.x, this.ship.y - e.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  shoot(angle) {
    this.lastShot = this.time;
    const n = this.multishot;
    const spread = this.shotSpread;
    for (let i = 0; i < n; i++) {
      const a = angle + (i - (n - 1) / 2) * spread;
      this.playerBullets.push({
        x: this.ship.x + Math.cos(a) * 26, y: this.ship.y + Math.sin(a) * 26,
        vx: Math.cos(a) * CONFIG.bulletSpeed, vy: Math.sin(a) * CONFIG.bulletSpeed,
        life: 1.2,
      });
    }
    this.addParticle(
      this.ship.x + Math.cos(angle) * 28, this.ship.y + Math.sin(angle) * 28,
      0, 0, 0.08, 10, '#bae6fd'
    );
    this.sfx.shoot();
  }

  enemyShoot(e, angle, speed, dmg) {
    this.enemyBullets.push({
      x: e.x + Math.cos(angle) * (e.r + 4), y: e.y + Math.sin(angle) * (e.r + 4),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 2.6, color: e.color, type: e.type, dmg,
    });
  }

  damagePlayer(d, source = null) {
    this.health -= d;
    // T01: unshielded damage (shielded hits never reach this method)
    this.runStats.damageTaken += d;
    this.runStats.hitsTaken += 1;
    this.waveStats.damageTaken += d;
    this.waveStats.hitsTaken += 1;
    // T08: record final-hit context (overwritten each hit; at death it is the last hit)
    this.lastDamage = {
      sourceType: (source && source.sourceType) || 'unknown',
      enemyType: (source && source.enemyType) || null,
      amount: d,
      playerFuel: this.boostFuel,
      nearbyEnemies: this.countNearbyEnemies(this.ship.x, this.ship.y, CONFIG.debriefNearbyRadius),
      waveFamily: this.waveFamily,
      timestamp: this.time,
    };
    this.ship.invuln = 0.8;
    this.addShake(12);
    this.comboKills = 0;
    this.sfx.playerHit();
    this.addExplosion(this.ship.x, this.ship.y, '#ff5555', 18);
    if (this.health <= 0) { this.health = 0; this.gameOver(); }
  }

  killEnemy(e, i, byContact = false) {
    const t = ENEMY_TYPES[e.type];
    this.addExplosion(e.x, e.y, e.color, e.type === 'boss' ? 80 : 30);
    this.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.4, maxLife: 0.4, color: e.color });
    this.addShake(e.type === 'boss' ? 18 : e.r > 20 ? 10 : 6);
    this.sfx.explosion(e.type === 'boss');
    if (!byContact) {
      this.comboKills++;
      this.comboTimer = 3;
      this.runStats.enemiesKilled++;
      this.waveStats.enemiesKilled++;
      const mult = Math.min(5, 1 + Math.floor(this.comboKills / 5));
      const pts = Math.floor(t.score * mult);
      this.score += pts;
      this.addPopup(e.x, e.y, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`);
      // T07: Blood Shield — player-caused kills restore HP; contact kills never heal
      if (this.selectedUpgradeIds.has('blood-shield') && this.health < this.maxHealth) {
        const heal = Math.floor(CONFIG.bloodShieldHeal * (e.type === 'boss' ? CONFIG.bloodShieldBossMultiplier : 1));
        const before = this.health;
        this.health = Math.min(this.maxHealth, this.health + heal);
        const gained = Math.floor(this.health - before);
        if (gained > 0) {
          this.addPopup(this.ship.x, this.ship.y - 26, `+${gained} HP`, '#22d3ee');
          if (this.time - this.lastHealSfxAt >= CONFIG.bloodShieldSfxInterval) {
            this.lastHealSfxAt = this.time;
            this.sfx.heal();
          }
        }
      }
    }
    const dropChance = e.type === 'boss' ? CONFIG.dropChanceBoss : CONFIG.dropChanceEnemy;
    if (Math.random() < dropChance) {
      this.spawnPickup(e.x, e.y, Math.random() < 0.35 ? 'shield' : 'health');
      if (e.type === 'boss' && Math.random() < 0.5) this.spawnPickup(e.x + 34, e.y, 'health');
    }
    // T02: independent fuel drop — additive, does not replace health/shield
    if (e.type !== 'boss' && Math.random() < CONFIG.fuelDropChance) {
      this.spawnPickup(e.x + (Math.random() < 0.5 ? -26 : 26), e.y + 12, 'fuel');
    }
    this.enemies.splice(i, 1);
  }

  // ---------- main step (fixed 60Hz) ----------

  step(dt) {
    this.time += dt;

    if (this.input.wasPressed('KeyM')) this.sfx.toggle();
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    }
    if (this.input.wasPressed('KeyR') && this.state !== 'menu') this.startGame();

    this.updateBackground(dt);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }

    if (this.state !== 'playing' || this.waveState !== 'playing') return;

    // T01: run time counts only while actively playing a wave
    this.runStats.elapsed += dt;

    // --- pending spawn warnings → materialize ---
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const p = this.pendingSpawns[i];
      p.t -= dt;
      if (p.t <= 0) { this.pendingSpawns.splice(i, 1); this.materializeSpawn(p); }
    }

    // --- batch wave spawning (T05: family drives batch size, cadence, and breathing) ---
    if (this.waveRemainingToSpawn > 0) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        const fam = WAVE_FAMILIES[this.waveFamily] || { batch: [CONFIG.spawnMinBatch, CONFIG.spawnMaxBatch], delay: [CONFIG.spawnMinDelay, CONFIG.spawnMaxDelay] };
        const remaining = this.waveRemainingToSpawn;
        const bMin = Math.min(fam.batch[0], remaining);
        const bMax = Math.min(fam.batch[1], remaining);
        const batchSize = bMin + Math.floor(Math.random() * (bMax - bMin + 1));
        for (let i = 0; i < batchSize; i++) {
          const pos = this.pickSpawnPos();
          this.pendingSpawns.push({ ...pos, t: CONFIG.spawnWarnTime, type: this.weightedPick() });
        }
        this.waveRemainingToSpawn -= batchSize;
        this.waveBatchCount++;
        if (this.waveRemainingToSpawn > 0) {
          // Panic family takes a breathing interval after every breathEvery-th batch
          let dMin, dMax;
          if (fam.breathDelay && this.waveBatchCount % fam.breathEvery === 0) { dMin = fam.breathDelay[0]; dMax = fam.breathDelay[1]; }
          else { dMin = fam.delay[0]; dMax = fam.delay[1]; }
          this.waveSpawnTimer = dMin + Math.random() * (dMax - dMin);
        } else {
          this.waveSpawnComplete = true;
        }
      }
    }

    // --- player ---
    const { ax, ay } = this.input.getMoveAxis();
    const mag = Math.hypot(ax, ay);
    const boosting = this.input.isBoosting() && this.boostFuel > 0 && !this.boostLocked;
    if (boosting && !this.wasBoosting) this.runStats.boostsUsed++;
    this.wasBoosting = boosting;
    const fuelWasPositive = this.boostFuel > 0;
    if (boosting) this.boostFuel = Math.max(0, this.boostFuel - this.boostDrain * dt);
    else this.boostFuel = Math.min(this.boostFuelMax, this.boostFuel + CONFIG.boostRegen * dt);
    // T02: empty-fuel lockout (hysteresis) — boost stays off until fuel recovers,
    // so holding Shift at empty can't flap the fuel or spam sounds/counters
    if (this.boostFuel <= 0 && fuelWasPositive) { this.boostLocked = true; this.runStats.fuelDepletedCount++; }
    if (this.boostLocked && this.boostFuel >= this.boostFuelMax * CONFIG.fuelRecoverRatio) this.boostLocked = false;
    // T02: boost fuel state machine → drives HUD + one-shot transition sounds
    {
      const ratio = this.boostFuel / this.boostFuelMax;
      const ns = this.boostFuel <= 0 ? 'empty' : ratio < CONFIG.fuelLowThreshold ? 'low' : 'normal';
      if (ns !== this.fuelState) {
        if (ns === 'empty') this.sfx.fuelEmpty();
        else if (ns === 'low' && this.fuelState === 'normal') this.sfx.fuelLow();
        this.fuelState = ns;
      }
    }

    if (mag > 0) {
      const acc = this.playerAccel * (boosting ? this.boostMultiplier : 1);
      this.ship.vx += (ax / mag) * acc * dt;
      this.ship.vy += (ay / mag) * acc * dt;
      const back = Math.atan2(-this.ship.vy, -this.ship.vx);
      const tx = this.ship.x + Math.cos(back) * 14;
      const ty = this.ship.y + Math.sin(back) * 14;
      const n = boosting ? 3 : 1;
      for (let k = 0; k < n; k++) {
        this.addParticle(
          tx, ty,
          (Math.random() - 0.5) * 40 - this.ship.vx * 0.2,
          (Math.random() - 0.5) * 40 - this.ship.vy * 0.2,
          0.3 + Math.random() * 0.25, 2 + Math.random() * 2, boosting ? '#fbbf24' : '#38bdf8'
        );
      }
    }
    const damp = Math.exp(-CONFIG.damp * dt);
    this.ship.vx *= damp;
    this.ship.vy *= damp;
    this.ship.x = Math.max(CONFIG.shipSize, Math.min(this.W - CONFIG.shipSize, this.ship.x + this.ship.vx * dt));
    this.ship.y = Math.max(CONFIG.shipSize, Math.min(this.H - CONFIG.shipSize, this.ship.y + this.ship.vy * dt));
    if (this.ship.invuln > 0) this.ship.invuln -= dt;
    if (this.shieldTime > 0) this.shieldTime -= dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.comboKills = 0; }

    // --- aim (with lead prediction) & auto-fire ---
    const target = this.findNearestTarget();
    if (target) {
      const d = Math.hypot(target.x - this.ship.x, target.y - this.ship.y);
      const lead = d / CONFIG.bulletSpeed;
      const tx = target.x + target.vx * lead;
      const ty = target.y + target.vy * lead;
      const angle = Math.atan2(ty - this.ship.y, tx - this.ship.x);
      this.ship.angle = this.rotateToward(this.ship.angle, angle, CONFIG.turnRate * dt);
      if (this.time - this.lastShot > this.autoFireRate) this.shoot(angle);
    } else if (mag > 0) {
      this.ship.angle = this.rotateToward(this.ship.angle, Math.atan2(this.ship.vy, this.ship.vx), CONFIG.turnRate * dt);
    }

    // --- enemies ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const t = ENEMY_TYPES[e.type];
      const dx = this.ship.x - e.x, dy = this.ship.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const dir = Math.atan2(dy, dx);
      e.flash = Math.max(0, e.flash - dt * 6);

      // per-type steering
      let moveAngle = dir, speedFactor = 1;
      if (t.behavior === 'kite') {
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) { e.strafeDir *= -1; e.strafeTimer = 1 + Math.random() * 1.5; }
        const desired = 210;
        const radial = dist > desired + 40 ? 1 : dist < desired - 40 ? -1 : 0;
        const a = dir + (Math.PI / 2) * e.strafeDir;
        moveAngle = Math.atan2(Math.sin(dir) * radial + Math.sin(a) * 1.2, Math.cos(dir) * radial + Math.cos(a) * 1.2);
        speedFactor = 0.9;
      } else if (t.behavior === 'snipe') {
        const desired = 420;
        const radial = dist > desired + 50 ? 1 : dist < desired - 50 ? -1 : 0;
        const a = dir + (Math.PI / 2) * e.strafeDir;
        moveAngle = Math.atan2(Math.sin(dir) * radial * 0.6 + Math.sin(a) * 0.8, Math.cos(dir) * radial * 0.6 + Math.cos(a) * 0.8);
      } else if (t.behavior === 'boss') {
        const desired = 300;
        const radial = dist > desired + 60 ? 1 : dist < desired - 60 ? -1 : 0;
        const a = dir + Math.PI / 2;
        moveAngle = Math.atan2(Math.sin(dir) * radial + Math.sin(a) * 0.5, Math.cos(dir) * radial + Math.cos(a) * 0.5);
        speedFactor = 0.7;
      } else if (t.behavior === 'block') {
        // T06: steer toward a clamped short-term prediction of the player —
        // single-step lead on current velocity only (no future input, no
        // iterative intercept), capped so it can't perfectly track or teleport
        let px = this.ship.x + this.ship.vx * t.predictTime;
        let py = this.ship.y + this.ship.vy * t.predictTime;
        const ldx = px - this.ship.x, ldy = py - this.ship.y;
        const ld = Math.hypot(ldx, ldy);
        if (ld > t.predictLeadMax) {
          px = this.ship.x + (ldx / ld) * t.predictLeadMax;
          py = this.ship.y + (ldy / ld) * t.predictLeadMax;
        }
        e.blockTarget = { x: px, y: py };
        moveAngle = Math.atan2(py - e.y, px - e.x);
      }

      // separation so enemies don't clump into one blob
      let sx = 0, sy = 0;
      for (const o of this.enemies) {
        if (o === e) continue;
        const ddx = e.x - o.x, ddy = e.y - o.y;
        const min = (e.r + o.r) * 0.9;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const f = (1 - d / min) * 0.6;
          sx += (ddx / d) * f; sy += (ddy / d) * f;
        }
      }

      const k = Math.min(1, 3.5 * dt);
      e.vx += ((Math.cos(moveAngle) * e.speed * speedFactor) - e.vx) * k + sx * e.speed * 9 * dt;
      e.vy += ((Math.sin(moveAngle) * e.speed * speedFactor) - e.vy) * k + sy * e.speed * 9 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle = this.rotateToward(e.angle, moveAngle, 4 * dt);

      // --- firing ---
      if (t.behavior === 'boss') {
        e.attackTimer -= dt;
        e.spiralA += dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = t.fireRate;
          e.attackMode = ((e.attackMode ?? -1) + 1) % 3;
          const mode = e.attackMode;
          if (mode === 0) {
            for (let q = 0; q < 16; q++) this.enemyShoot(e, e.spiralA * 2 + q * Math.PI / 8, t.bulletSpeed, t.bulletDmg);
          } else if (mode === 1) {
            for (let q = -2; q <= 2; q++) this.enemyShoot(e, dir + q * 0.18, t.bulletSpeed * 1.2, t.bulletDmg);
          } else {
            for (let q = 0; q < 10; q++) this.enemyShoot(e, e.spiralA * 3 + q * Math.PI / 5, t.bulletSpeed, t.bulletDmg);
            for (let q = 0; q < 10; q++) this.enemyShoot(e, -e.spiralA * 3 + q * Math.PI / 5, t.bulletSpeed * 0.8, t.bulletDmg);
          }
          this.sfx.enemyShoot();
        }
      } else if (t.behavior === 'snipe') {
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) {
            const a = Math.atan2(this.ship.y - e.y, this.ship.x - e.x);
            this.enemyShoot(e, a, t.bulletSpeed, t.bulletDmg);
            this.beams.push({ x: e.x, y: e.y, angle: a, life: 0.15 });
            this.sfx.enemyShoot();
          }
        } else {
          e.fireCooldown -= dt;
          if (e.fireCooldown <= 0 && dist < 750) {
            e.windup = t.windup;
            e.fireCooldown = e.fireRate;
          }
        }
      } else if (t.behavior === 'block') {
        // T06: no projectile — the Blocker's threat is positional
      } else {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 700) {
          if (t.behavior === 'spread') {
            for (let q = -1; q <= 1; q++) this.enemyShoot(e, dir + q * 0.22, t.bulletSpeed, t.bulletDmg);
          } else {
            this.enemyShoot(e, dir + (Math.random() - 0.5) * 0.1, t.bulletSpeed, t.bulletDmg);
          }
          e.fireCooldown = e.fireRate * (0.7 + Math.random() * 0.6);
          if (Math.random() < 0.35) this.sfx.enemyShoot();
        }
      }

      // --- contact: attacker dies, player takes real damage ---
      if (this.ship.invuln <= 0 && dist < CONFIG.shipHitRadius + e.r * 0.75) {
        this.killEnemy(e, i, true);
        if (this.shieldTime > 0) this.addShake(6);
        else this.damagePlayer(CONFIG.contactDamage * this.contactDamageMultiplier, { sourceType: 'contact', enemyType: e.type });
      }
    }

    // --- player bullets ---
    for (let bi = this.playerBullets.length - 1; bi >= 0; bi--) {
      const b = this.playerBullets[bi];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20) {
        this.playerBullets.splice(bi, 1);
        continue;
      }
      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) {
          e.hp -= this.playerDamage;
          e.flash = 1;
          this.addExplosion(b.x, b.y, '#fde047', 6);
          this.sfx.hit();
          this.playerBullets.splice(bi, 1);
          if (e.hp <= 0) this.killEnemy(e, ei);
          break;
        }
      }
    }

    // --- enemy bullets ---
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (Math.hypot(this.ship.x - b.x, this.ship.y - b.y) < CONFIG.shipHitRadius + 3 && this.ship.invuln <= 0) {
        if (this.shieldTime > 0) {
          this.addShake(5);
          this.addExplosion(b.x, b.y, '#60a5fa', 12);
        } else {
          this.damagePlayer(b.dmg || 5, { sourceType: 'projectile', enemyType: b.type });
        }
        this.enemyBullets.splice(i, 1);
      }
    }

    // --- pickups (magnet + collect) ---
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      const dx = this.ship.x - p.x, dy = this.ship.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < this.pickupMagnet && d > 0.001) {
        const pull = (1 - d / this.pickupMagnet) * 620;
        p.x += (dx / d) * pull * dt;
        p.y += (dy / d) * pull * dt;
      }
      if (d < 26) {
        this.runStats.pickupsCollected++;
        if (p.type === 'health') {
          this.health = Math.min(this.maxHealth, this.health + 25);
          this.addPopup(p.x, p.y, '+25 HP', '#4ade80');
          this.sfx.pickup();
        } else if (p.type === 'fuel') {
          this.boostFuel = Math.min(this.boostFuelMax, this.boostFuel + CONFIG.fuelPickupRestore);
          this.addPopup(p.x, p.y, `+${CONFIG.fuelPickupRestore} FUEL`, '#fde047');
          this.sfx.pickup();
        } else {
          this.shieldTime = this.shieldBonus;
          this.addPopup(p.x, p.y, 'SHIELD', '#93c5fd');
          this.sfx.shieldUp();
        }
        this.score += 50;
        const pc = p.type === 'health' ? '#22c55e' : p.type === 'fuel' ? '#fbbf24' : '#60a5fa';
        this.addExplosion(p.x, p.y, pc, 16);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) this.pickups.splice(i, 1);
    }

    // --- particles / popups / rings / beams ---
    const pd = Math.exp(-2.5 * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= pd; p.vy *= pd;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt; p.y -= 40 * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt; r.r += 170 * dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }

    // T04: no passive survival drip — score now comes from skill (kills, combos, Perfect Clears, pickups)
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 40 * dt);

    // T01: track the highest displayed combo multiplier this run
    const comboMult = Math.min(5, 1 + Math.floor(this.comboKills / 5));
    if (comboMult > this.runStats.highestCombo) this.runStats.highestCombo = comboMult;

    this.ui.updateHUD({
      wave: this.wave,
      waveTotal: this.waveTotal,
      waveSpawnedCount: this.waveSpawnedCount,
      enemies: this.enemies.length,
      score: this.score,
      best: this.best,
      health: this.health,
      maxHealth: this.maxHealth,
      shieldTime: this.shieldTime,
      boostFuel: this.boostFuel,
      boostFuelMax: this.boostFuelMax,
      fuelState: this.fuelState,
      combo: Math.min(5, 1 + Math.floor(this.comboKills / 5)),
    });

    if (this.state === 'playing' && this.enemies.length === 0 && this.waveSpawnComplete && this.pendingSpawns.length === 0) this.startUpgradeScreen();
  }

  updateBackground(dt) {
    const spd = (this.state === 'playing' && this.input.isBoosting() && this.boostFuel > 0) ? 3 : 1;
    for (const s of this.stars) {
      s.y += s.z * 35 * spd * dt;
      if (s.y > this.H) { s.y -= this.H; s.x = Math.random() * this.W; }
    }
    const m = 180;
    for (const n of this.nebulae) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -m) n.x = this.W + m;
      if (n.x > this.W + m) n.x = -m;
      if (n.y < -m) n.y = this.H + m;
      if (n.y > this.H + m) n.y = -m;
    }
  }

  // ---------- rendering ----------

  draw() {
    const ctx = this.ctx;
    const S = this.sprites;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // background
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, Math.max(this.W, this.H));
    g.addColorStop(0, '#020617');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    for (const n of this.nebulae) {
      const s = 320 * n.scale;
      ctx.drawImage(n.img, n.x - s / 2, n.y - s / 2, s, s);
    }
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = 0.25 + s.z * 0.65;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // pending spawn warnings (blinking diamond markers)
    for (const p of this.pendingSpawns) {
      const progress = 1 - p.t / CONFIG.spawnWarnTime;
      const a = 0.3 + 0.7 * progress * (Math.sin(this.time * 20) > 0 ? 1 : 0.4);
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.type === 'boss' ? '#f472b6' : '#f87171';
      ctx.lineWidth = 2;
      const r = (p.type === 'boss' ? 26 : 10) + Math.sin(this.time * 12) * 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y);
      ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // sniper beams
    ctx.lineWidth = 3;
    for (const b of this.beams) {
      ctx.strokeStyle = `rgba(196,181,253,${(b.life / 0.15) * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.angle) * 900, b.y + Math.sin(b.angle) * 900);
      ctx.stroke();
    }

    // enemies
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      const spr = S.enemies[e.type];
      ctx.drawImage(spr, -spr.width / 2, -spr.width / 2);
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash);
        const f = S.enemyFlash[e.type];
        ctx.drawImage(f, -f.width / 2, -f.width / 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // sniper windup telegraph
      if (e.type === 'sniper' && e.windup > 0) {
        const a = Math.atan2(this.ship.y - e.y, this.ship.x - e.x);
        ctx.strokeStyle = `rgba(196,181,253,${0.2 + 0.5 * (1 - e.windup / 0.7)})`;
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a) * 700, e.y + Math.sin(a) * 700);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // T06: blocker intercept lane — short, dim, dashed (intent, not a beam)
      if (e.type === 'blocker' && e.blockTarget) {
        const a = Math.atan2(e.blockTarget.y - e.y, e.blockTarget.x - e.x);
        ctx.strokeStyle = 'rgba(249,115,22,0.35)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // hp bar for tanks, boss & blocker
      if (e.hp < e.hpMax && (e.type === 'boss' || e.type === 'tank' || e.type === 'blocker')) {
        const bw = e.r * 1.6;
        ctx.fillStyle = 'rgba(15,23,42,0.8)';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw, 4);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw * (e.hp / e.hpMax), 4);
      }
    }

    // bullets (sprite + streak)
    ctx.lineWidth = 2;
    for (const b of this.playerBullets) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(S.bullets.player, b.x - 24, b.y - 24);
    }
    for (const b of this.enemyBullets) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const spr = S.bullets[b.type] || S.bullets.fighter;
      ctx.drawImage(spr, b.x - 22, b.y - 22);
    }

    // pickups (pulse, blink near expiry)
    for (const p of this.pickups) {
      if (p.life < 2 && Math.sin(this.time * 16) > 0) continue;
      const s = 36 * (1 + Math.sin(this.time * 6) * 0.08);
      ctx.drawImage(S.pickups[p.type], p.x - s / 2, p.y - s / 2, s, s);
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // shockwave rings
    for (const r of this.rings) {
      const a = r.life / r.maxLife;
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 + 6 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ship
    if (this.state !== 'gameover') {
      ctx.save();
      ctx.translate(this.ship.x, this.ship.y);
      ctx.rotate(this.ship.angle);
      const boosting = this.input.isBoosting() && this.boostFuel > 0;
      if (boosting) {
        const fs = 52 + Math.random() * 10;
        ctx.drawImage(S.flame, -20 - fs / 2, -fs / 2, fs, fs);
      } else if (Math.hypot(this.ship.vx, this.ship.vy) > 40) {
        const fs = 32 + Math.random() * 6;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(S.flame, -18 - fs / 2, -fs / 2, fs, fs);
        ctx.globalAlpha = 1;
      }
      // i-frame blink (alpha set BEFORE drawing — the old code set it after, so it never worked)
      if (this.ship.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.35;
      ctx.drawImage(S.ship, -S.ship.width / 2, -S.ship.width / 2);
      ctx.globalAlpha = 1;
      ctx.restore();
      if (this.shieldTime > 0) {
        const w = 1 + Math.sin(this.time * 8) * 0.15;
        ctx.strokeStyle = 'rgba(96,165,250,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.ship.x, this.ship.y, (CONFIG.shipSize + 16) * w, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // score popups
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // wave / boss banner
    if (this.banner) {
      ctx.globalAlpha = Math.min(1, this.banner.t);
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.banner.color;
      ctx.shadowColor = this.banner.color;
      ctx.shadowBlur = 20;
      ctx.fillText(this.banner.text, this.W / 2, this.H * 0.3);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // low health vignette
    if (this.state === 'playing' && this.health < this.maxHealth * 0.3) {
      const a = Math.max(0, (0.3 - this.health / this.maxHealth) * 1.2 * (0.7 + 0.3 * Math.sin(this.time * 5)));
      const v = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
      v.addColorStop(0, 'rgba(220,38,38,0)');
      v.addColorStop(1, `rgba(220,38,38,${a.toFixed(3)})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    ctx.restore();
  }

  // ---------- loop ----------

  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    let frame = (t - this.lastT) / 1000;
    this.lastT = t;
    if (frame > 0.1) frame = 0.1; // clamp tab-switch gaps
    this.acc += frame;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.input.endFrame();
    this.draw();
  }
}
