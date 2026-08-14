// Self-contained 2D config derived from 3D balance
export const CONFIG = {
  shipSize: 22,
  boostFuelMax: 100,
  boostRate: 0.9,
  regenRate: 0.25 * 1.4,
  playerSpeed: 4,
  playerDamage: 1,
  autoRange: 400,
  autoFireRate: 140,
  waveEnemiesBase: 6,
  waveEnemyGrowth: 3,
  playerFriction: 0.92,
  playerAcceleration: 0.28,
  boostMultiplier: 2.2,
  shieldDefaultDuration: 5,
  maxHealth: 100,
  // Randomized spawn system config
  spawnMinBatchSize: 3,
  spawnMaxBatchSize: 10,
  spawnMinDelay: 1000,
  spawnMaxDelay: 4000,
  spawnMinSafeDist: 80,
  spawnPointsCount: 12,
  spawnJitter: 40,
  spawnNearPlayerChance: 0.15,
  spawnNearMinDist: 120,
  spawnNearMaxDist: 220,
};

export const ENEMY_TYPES = {
  scout:   { name:'Scout',   color:'#facc15', r:14, speed:2.2, fireRate:2000, hpBase:1, weight:40, score:100 },
  fighter: { name:'Fighter', color:'#ef4444', r:18, speed:1.2, fireRate:1200, hpBase:2, weight:35, score:150 },
  tank:    { name:'Tank',    color:'#9ca3af', r:26, speed:0.6, fireRate:2500, hpBase:6, weight:15, score:250 },
  sniper:  { name:'Sniper',  color:'#a78bfa', r:16, speed:0.9, fireRate:900,  hpBase:2, weight:10, score:200 },
};

export const PICKUP_TYPES = {
  health: { color:'#22c55e' },
  shield: { color:'#60a5fa' },
};
