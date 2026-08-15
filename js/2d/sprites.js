import { ENEMY_TYPES } from './config.js';

// Pre-render all glowing entities to offscreen canvases once.
// drawImage is ~10-50x faster than per-frame ctx.shadowBlur.

function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size / 2);
  return c;
}

function dotSprite(color, r = 4) {
  return makeCanvas(48, (ctx, cx) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cx, Math.max(1.5, r * 0.45), 0, Math.PI * 2); ctx.fill();
  });
}

function enemySprite(t, color, white = false) {
  const r = t.r;
  const pad = 16;
  const size = Math.ceil((r + pad) * 2);
  return makeCanvas(size, (ctx, cx) => {
    ctx.translate(cx, cx);
    const c = white ? '#ffffff' : color;
    ctx.shadowColor = c;
    ctx.shadowBlur = white ? 0 : 14;
    ctx.fillStyle = white ? '#fff' : '#111827';
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    switch (t.behavior) {
      case 'kite': // scout: dart
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.6); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'chase': // fighter: arrow
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(-r * 0.5, r * 0.75); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, -r * 0.75);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'spread': // tank: hexagon + core
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
        break;
      case 'snipe': // sniper: diamond + barrel
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, -r * 0.6); ctx.lineTo(-r * 0.8, 0); ctx.lineTo(0, r * 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = c;
        ctx.fillRect(0, -1.5, r * 1.2, 3);
        break;
      default: // boss: spiky star
        ctx.beginPath();
        const spikes = 8;
        for (let i = 0; i < spikes * 2; i++) {
          const rr = i % 2 ? r * 0.7 : r;
          const a = (i * Math.PI) / spikes;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
        break;
    }
  });
}

function shipSprite() {
  return makeCanvas(120, (ctx, cx) => {
    ctx.translate(cx, cx);
    const s = 22;
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 18;
    const grad = ctx.createLinearGradient(-s, 0, s, 0);
    grad.addColorStop(0, '#7dd3fc');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.7, -s * 0.7);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.7, s * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath(); ctx.arc(s * 0.15, 0, 4, 0, Math.PI * 2); ctx.fill();
  });
}

function flameSprite() {
  // base at canvas center, tip pointing left
  return makeCanvas(64, (ctx, cx) => {
    ctx.translate(cx, cx);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-28, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(-14, 0); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill();
  });
}

function pickupSprite(kind) {
  return makeCanvas(48, (ctx, cx) => {
    const c = kind === 'health' ? '#22c55e' : '#60a5fa';
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(15,23,42,0.9)';
    ctx.beginPath(); ctx.arc(cx, cx, 11, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = kind === 'health' ? '#4ade80' : '#93c5fd';
    if (kind === 'health') {
      ctx.fillRect(cx - 6, cx - 2, 12, 4);
      ctx.fillRect(cx - 2, cx - 6, 4, 12);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cx - 6);
      ctx.lineTo(cx + 5, cx - 3);
      ctx.lineTo(cx + 5, cx + 2);
      ctx.quadraticCurveTo(cx + 5, cx + 6, cx, cx + 7);
      ctx.quadraticCurveTo(cx - 5, cx + 6, cx - 5, cx + 2);
      ctx.lineTo(cx - 5, cx - 3);
      ctx.closePath(); ctx.fill();
    }
  });
}

function nebulaSprite(color) {
  const size = 320;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function buildSprites() {
  const S = { bullets: {}, enemies: {}, enemyFlash: {}, pickups: {} };
  for (const key of Object.keys(ENEMY_TYPES)) {
    const t = ENEMY_TYPES[key];
    S.enemies[key] = enemySprite(t, t.color);
    S.enemyFlash[key] = enemySprite(t, '#fff', true);
    S.bullets[key] = dotSprite(key === 'boss' ? '#f9a8d4' : t.color, key === 'boss' ? 6 : 4);
  }
  S.bullets.player = dotSprite('#7dd3fc');
  S.ship = shipSprite();
  S.flame = flameSprite();
  S.pickups.health = pickupSprite('health');
  S.pickups.shield = pickupSprite('shield');
  S.nebulae = [
    nebulaSprite('rgba(59,130,246,0.10)'),
    nebulaSprite('rgba(124,58,237,0.09)'),
    nebulaSprite('rgba(6,182,212,0.07)'),
  ];
  return S;
}
