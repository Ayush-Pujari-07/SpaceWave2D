// All values in per-second units (fixed 60Hz timestep).
export const CONFIG = {
  // player
  shipSize: 22,
  shipHitRadius: 11,
  accel: 1700,
  damp: 6.5,
  boostMultiplier: 2.2,
  boostFuelMax: 100,
  boostDrain: 32,
  boostRegen: 16,
  playerDamage: 1,
  bulletSpeed: 620,
  autoRange: 550,
  autoFireRate: 0.14,
  turnRate: 10,
  maxHealth: 100,
  contactDamage: 18,
  shieldDefault: 5,
  // T03: upgrade tuning (copied into mutable run state; CONFIG is never mutated)
  upgradeHullMaxHealth: 25,
  upgradeFuelCapacity: 25,
  upgradePickupMagnet: 35,
  upgradeShieldDuration: 2,
  heavyCannonDamage: 2,
  heavyCannonFireRateMultiplier: 1.25,
  splitShotProjectiles: 1,
  splitShotSpread: 0.04,
  splitShotFireRateMultiplier: 1.15,
  overchargedBoostMultiplier: 0.6,
  overchargedBoostDrainMultiplier: 1.35,
  heavyPlatingMaxHealth: 30,
  heavyPlatingContactDamageMultiplier: 0.75,
  heavyPlatingAccelMultiplier: 0.8,
  // T07: Blood Shield — risky sustain mutation (kill restore, max-health cut)
  bloodShieldHeal: 4,                    // HP restored per player-caused kill (capped at maxHealth)
  bloodShieldBossMultiplier: 3,          // boss kills restore heal × this
  bloodShieldMaxHealthMultiplier: 0.8,   // downside: max health × this when selected
  bloodShieldSfxInterval: 0.3,           // min seconds between heal sounds
  // waves
  waveEnemiesBase: 6,
  waveEnemyGrowth: 3,
  bossEvery: 5,
  blockerMinWave: 3,  // T06: first wave eligible to spawn a Blocker
  // spawn system
  spawnMinBatch: 3,
  spawnMaxBatch: 10,
  spawnMinDelay: 1.0,
  spawnMaxDelay: 3.5,
  spawnPointsCount: 12,
  spawnJitter: 40,
  spawnWarnTime: 1.0,
  spawnNearPlayerChance: 0.15,
  spawnNearMin: 130,
  spawnNearMax: 230,
  // pickups
  pickupLife: 8,
  pickupMagnet: 130,
  dropChanceEnemy: 0.18,   // was 0.3 — scarcer drops, healing is now a resource
  dropChanceBoss: 0.8,     // was 1 — boss usually (not always) drops
  // T02: fuel pickups & boost clarity
  fuelPickupRestore: 45,   // boost fuel restored by a fuel pickup (capped at boostFuelMax)
  fuelLowThreshold: 0.25,  // fraction of boostFuelMax that flags "low fuel"
  fuelRecoverRatio: 0.2,   // fraction of boostFuelMax fuel must recover to before boost re-engages after empty
  fuelDropChance: 0.12,    // chance a defeated (non-boss) enemy also drops a fuel pickup
  // T04: skill-based scoring — Perfect Clear bonus (no passive survival drip)
  perfectClearBase: 250,     // base bonus for ending a wave with zero unshielded hits
  perfectClearPerWave: 100,  // added for each wave number above wave 1
  // T08: Run Debrief — heuristic death-analysis thresholds
  debriefNearbyRadius: 220,  // px radius for counting "nearby" enemies at the final hit
  debriefSwarmNearby: 5,     // nearby-enemy count that reads as swarm pressure
  debriefCorneredNearby: 2,  // nearby-enemy count needed for a "cornered" contact death
  debriefEdgeRatio: 0.15,    // arena-edge band (fraction of width/height)
  // T09: learn-by-playing hint durations (seconds) — DOM toasts, one active at a time
  hintDurations: { move: 6, boost: 6, emptyFuel: 7, spawnWarn: 5, upgrade: 9 },
  // fx
  particleCap: 320,
};

export const ENEMY_TYPES = {
  scout:   { name: 'Scout',    color: '#facc15', r: 14, speed: 150, fireRate: 2.2, hpBase: 1,  score: 100,  bulletSpeed: 260, bulletDmg: 4,  behavior: 'kite' },
  fighter: { name: 'Fighter',  color: '#ef4444', r: 18, speed: 85,  fireRate: 1.2, hpBase: 2,  score: 150,  bulletSpeed: 300, bulletDmg: 5,  behavior: 'chase' },
  tank:    { name: 'Tank',     color: '#9ca3af', r: 26, speed: 45,  fireRate: 2.5, hpBase: 6,  score: 250,  bulletSpeed: 260, bulletDmg: 7,  behavior: 'spread', bullets: 3 },
  sniper:  { name: 'Sniper',   color: '#a78bfa', r: 16, speed: 60,  fireRate: 2.6, hpBase: 2,  score: 200,  bulletSpeed: 900, bulletDmg: 12, behavior: 'snipe', windup: 0.7 },
  blocker: { name: 'Blocker',  color: '#f97316', r: 24, speed: 110, fireRate: 0,   hpBase: 3,  score: 300,  bulletSpeed: 0,   bulletDmg: 0,  behavior: 'block', predictTime: 0.4, predictLeadMax: 140 },
  boss:    { name: 'Overlord', color: '#f472b6', r: 52, speed: 40,  fireRate: 2.4, hpBase: 80, score: 2000, bulletSpeed: 280, bulletDmg: 8,  behavior: 'boss' },
};

// T05: wave families — each wave gets one family that drives enemy weights,
// batch-size range, and spawn-delay range (per-second units).
// minWave gates eligibility; weights may name types added later (ignored until defined).
export const WAVE_FAMILIES = {
  swarm:     { minWave: 1, weights: { scout: 60, fighter: 35, tank: 5,  sniper: 0  }, batch: [4, 10], delay: [0.8, 2.0] },
  precision: { minWave: 3, weights: { scout: 10, fighter: 25, tank: 40, sniper: 25 }, batch: [2, 4],  delay: [1.5, 3.0] },
  movement:  { minWave: 4, weights: { scout: 45, fighter: 35, blocker: 20 }, batch: [4, 8],  delay: [0.6, 1.6] },
  panic:     { minWave: 3, weights: { scout: 35, fighter: 25, tank: 10, sniper: 10, blocker: 20 }, batch: [5, 9],  delay: [0.5, 1.2], breathEvery: 2, breathDelay: [2.5, 3.5] },
};

export const PICKUP_TYPES = {
  health: { color: '#22c55e' },
  shield: { color: '#60a5fa' },
  fuel:   { color: '#fbbf24' },
};
