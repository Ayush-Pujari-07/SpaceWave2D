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
  // waves
  waveEnemiesBase: 6,
  waveEnemyGrowth: 3,
  bossEvery: 5,
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
  // fx
  particleCap: 320,
};

export const ENEMY_TYPES = {
  scout:   { name: 'Scout',    color: '#facc15', r: 14, speed: 150, fireRate: 2.2, hpBase: 1,  score: 100,  bulletSpeed: 260, bulletDmg: 4,  behavior: 'kite' },
  fighter: { name: 'Fighter',  color: '#ef4444', r: 18, speed: 85,  fireRate: 1.2, hpBase: 2,  score: 150,  bulletSpeed: 300, bulletDmg: 5,  behavior: 'chase' },
  tank:    { name: 'Tank',     color: '#9ca3af', r: 26, speed: 45,  fireRate: 2.5, hpBase: 6,  score: 250,  bulletSpeed: 260, bulletDmg: 7,  behavior: 'spread', bullets: 3 },
  sniper:  { name: 'Sniper',   color: '#a78bfa', r: 16, speed: 60,  fireRate: 2.6, hpBase: 2,  score: 200,  bulletSpeed: 900, bulletDmg: 12, behavior: 'snipe', windup: 0.7 },
  boss:    { name: 'Overlord', color: '#f472b6', r: 52, speed: 40,  fireRate: 2.4, hpBase: 80, score: 2000, bulletSpeed: 280, bulletDmg: 8,  behavior: 'boss' },
};

export const PICKUP_TYPES = {
  health: { color: '#22c55e' },
  shield: { color: '#60a5fa' },
  fuel:   { color: '#fbbf24' },
};
