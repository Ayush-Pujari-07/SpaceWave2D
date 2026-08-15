export class UI {
  constructor() {
    this.el = {
      wave: document.getElementById('wave'),
      waveProgress: document.getElementById('waveProgress'),
      score: document.getElementById('score'),
      combo: document.getElementById('combo'),
      bestHud: document.getElementById('bestHud'),
      healthText: document.getElementById('healthText'),
      healthBar: document.getElementById('healthBar'),
      shield: document.getElementById('shield'),
      enemyCount: document.getElementById('enemyCount'),
      waveBarFill: document.getElementById('waveBarFill'),
      boostFill: document.getElementById('boostFill'),
      boostState: document.getElementById('boostState'),
      waveComplete: document.getElementById('waveComplete'),
      waveInfo: document.getElementById('waveInfo'),
      upgrades: document.getElementById('upgrades'),
      gameOver: document.getElementById('gameOver'),
      finalWave: document.getElementById('finalWave'),
      finalScore: document.getElementById('finalScore'),
      bestFinal: document.getElementById('bestFinal'),
      newRecord: document.getElementById('newRecord'),
      nextWave: document.getElementById('nextWave'),
      restart: document.getElementById('restart'),
      startScreen: document.getElementById('startScreen'),
      startBtn: document.getElementById('startBtn'),
      bestScore: document.getElementById('bestScore'),
      pauseScreen: document.getElementById('pauseScreen'),
      pauseWave: document.getElementById('pauseWave'),
      pauseScore: document.getElementById('pauseScore'),
      resumeBtn: document.getElementById('resumeBtn'),
      pauseRestart: document.getElementById('pauseRestart'),
      hudTop: document.getElementById('hudTop'),
      waveBar: document.getElementById('waveBar'),
      boostBar: document.getElementById('boostBar'),
      legend: document.getElementById('legend'),
    };
  }
  updateHUD(state) {
    this.el.wave.textContent = state.wave;
    const spawned = state.waveSpawnedCount ?? state.waveTotal;
    const alive = state.enemies;
    const killed = Math.max(0, spawned - alive);
    this.el.waveProgress.textContent = `${killed}/${state.waveTotal}`;
    this.el.score.textContent = Math.floor(state.score);
    this.el.bestHud.textContent = Math.floor(state.best ?? 0);
    const mult = state.combo ?? 1;
    this.el.combo.textContent = `×${mult}`;
    this.el.combo.style.opacity = mult > 1 ? 1 : 0.35;
    this.el.combo.style.color = mult > 1 ? '#fbbf24' : '';
    this.el.healthText.textContent = `${Math.floor(state.health)}/${state.maxHealth}`;
    this.el.healthBar.style.width = `${Math.max(0, state.health / state.maxHealth * 100)}%`;
    this.el.shield.textContent = state.shieldTime > 0 ? state.shieldTime.toFixed(1) + 's' : '0s';
    this.el.enemyCount.textContent = alive;
    const progressPct = state.waveTotal > 0 ? Math.max(0, (killed / state.waveTotal) * 100) : 0;
    this.el.waveBarFill.style.width = `${progressPct}%`;
    this.el.boostFill.style.width = `${(state.boostFuel / state.boostFuelMax) * 100}%`;
    // T02: three readable boost-fuel states (color + label + shape, not color alone)
    const fill = this.el.boostFill, lbl = this.el.boostState;
    if (state.fuelState === 'empty') {
      fill.style.background = '#ef4444';
      fill.className = 'fuel-empty';
      lbl.textContent = '⚠ EMPTY — boost off';
      lbl.style.color = '#ef4444';
    } else if (state.fuelState === 'low') {
      fill.style.background = '#f59e0b';
      fill.className = 'pulse-low';
      lbl.textContent = 'LOW';
      lbl.style.color = '#f59e0b';
    } else {
      fill.style.background = 'var(--good)';
      fill.className = '';
      lbl.textContent = '';
      lbl.style.color = '';
    }
  }
  showWaveComplete(wave, total, options, onPick) {
    this.el.waveInfo.textContent = `Wave ${wave} cleared — ${total} enemies eliminated.`;
    this.el.waveComplete.style.display = 'block';
    const container = this.el.upgrades;
    container.innerHTML = '';
    // rarity-weighted random 3 options: common 60 / rare 30 / epic 12
    const weights = options.map(o => (o.rarity === 'epic' ? 12 : o.rarity === 'rare' ? 30 : 60));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const chosen = [];
    let guard = 0;
    while (chosen.length < 3 && guard++ < 100) {
      let r = Math.random() * totalW;
      let idx = options.length - 1;
      for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
      if (chosen.includes(options[idx])) continue;
      chosen.push(options[idx]);
    }
    chosen.forEach(o => {
      const card = document.createElement('div');
      card.className = `card ${o.rarity}`;
      card.innerHTML = `<div class="rarity">${o.rarity.toUpperCase()}</div><h3>${o.icon} ${o.name}</h3><p>${o.desc}</p>`;
      card.onclick = () => onPick(o);
      container.appendChild(card);
    });
  }
  hideWaveComplete() { this.el.waveComplete.style.display = 'none'; }
  showGameOver(wave, score, best, isNew) {
    this.el.finalWave.textContent = wave;
    this.el.finalScore.textContent = Math.floor(score);
    this.el.bestFinal.textContent = Math.floor(best);
    this.el.newRecord.style.display = isNew ? 'block' : 'none';
    this.el.gameOver.style.display = 'block';
  }
  hideGameOver() { this.el.gameOver.style.display = 'none'; }
  showStart(best) {
    this.el.bestScore.textContent = Math.floor(best);
    this.el.startScreen.style.display = 'block';
    this.hideHUD();
  }
  hideStart() { this.el.startScreen.style.display = 'none'; this.showHUD(); }
  showHUD() {
    this.el.hudTop.style.display = 'grid';
    this.el.waveBar.style.display = 'block';
    this.el.boostBar.style.display = 'block';
    this.el.legend.style.display = 'block';
  }
  hideHUD() {
    this.el.hudTop.style.display = 'none';
    this.el.waveBar.style.display = 'none';
    this.el.boostBar.style.display = 'none';
    this.el.legend.style.display = 'none';
  }
  showPause(wave, score) {
    this.el.pauseWave.textContent = wave;
    this.el.pauseScore.textContent = Math.floor(score);
    this.el.pauseScreen.style.display = 'block';
  }
  hidePause() { this.el.pauseScreen.style.display = 'none'; }
}
