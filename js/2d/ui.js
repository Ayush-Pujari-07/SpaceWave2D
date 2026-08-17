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
      perfectClear: document.getElementById('perfectClear'),
      upgrades: document.getElementById('upgrades'),
      gameOver: document.getElementById('gameOver'),
      finalWave: document.getElementById('finalWave'),
      finalScore: document.getElementById('finalScore'),
      bestFinal: document.getElementById('bestFinal'),
      newRecord: document.getElementById('newRecord'),
      debriefFinding: document.getElementById('debriefFinding'),
      debriefExplain: document.getElementById('debriefExplain'),
      debriefSuggestion: document.getElementById('debriefSuggestion'),
      buildTags: document.getElementById('buildTags'),
      finalTime: document.getElementById('finalTime'),
      finalKills: document.getElementById('finalKills'),
      finalCombo: document.getElementById('finalCombo'),
      finalPerfects: document.getElementById('finalPerfects'),
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
      hint: document.getElementById('hint'),
      resetHints: document.getElementById('resetHints'),
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
  showWaveComplete(wave, total, options, onPick, perfect = false, perfectBonus = 0) {
    this.el.waveInfo.textContent = `Wave ${wave} cleared — ${total} enemies eliminated.`;
    // T04: show the Perfect Clear bonus when earned, hide it otherwise
    const pc = this.el.perfectClear;
    if (perfect) {
      pc.textContent = `★ PERFECT CLEAR ★  +${perfectBonus}`;
      pc.style.display = 'block';
    } else {
      pc.style.display = 'none';
    }
    this.el.waveComplete.style.display = 'block';
    const container = this.el.upgrades;
    container.innerHTML = '';
    // Rarity-weighted random choices, bounded by the number of eligible options.
    const targetCount = Math.min(3, options.length);
    const weights = options.map(o => (o.rarity === 'epic' ? 12 : o.rarity === 'rare' ? 30 : 60));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const chosen = [];
    while (chosen.length < targetCount) {
      let r = Math.random() * totalW;
      let idx = options.length - 1;
      for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
      if (!chosen.includes(options[idx])) chosen.push(options[idx]);
    }
    if (!chosen.length) container.textContent = 'No upgrades available this wave.';
    chosen.forEach(o => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `card ${o.rarity}`;
      card.innerHTML = `<div class="upgradeMeta"><span class="rarity">${o.rarity.toUpperCase()}</span><span class="role">${o.role}</span><span class="kind ${o.kind}">${o.kind.toUpperCase()}</span></div><h3>${o.icon} ${o.name}</h3><p>${o.description}</p>`;
      card.onclick = () => onPick(o);
      container.appendChild(card);
    });
  }
  hideWaveComplete() { this.el.waveComplete.style.display = 'none'; }
  formatTime(totalSeconds) {
    const t = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  showGameOver(wave, score, best, isNew, debrief = null) {
    const db = debrief || {};
    const f = db.finding || {};
    this.el.finalWave.textContent = wave;
    this.el.finalScore.textContent = Math.floor(score);
    this.el.bestFinal.textContent = Math.floor(best);
    this.el.newRecord.style.display = isNew ? 'block' : 'none';
    // T08: Run Debrief — one finding, explanation, and next-run suggestion (safe fallbacks)
    this.el.debriefFinding.textContent = f.title || 'Sustained damage over the wave';
    this.el.debriefExplain.textContent = f.explanation || 'The run ended under sustained pressure.';
    this.el.debriefSuggestion.textContent = f.suggestion || 'Keep moving and watch for spawn warnings.';
    // Build summary: compact tags for actually selected upgrades only
    const tags = this.el.buildTags;
    tags.innerHTML = '';
    const items = Array.isArray(db.build) ? db.build : [];
    if (items.length === 0) {
      tags.textContent = 'No upgrades — vanilla hull';
    } else {
      for (const it of items) {
        const tag = document.createElement('span');
        tag.className = 'buildTag';
        tag.textContent = `${it.icon || ''} ${it.name || it.id || 'upgrade'}`.trim();
        tags.appendChild(tag);
      }
    }
    // Score report: finite values only
    this.el.finalTime.textContent = this.formatTime(db.time);
    this.el.finalKills.textContent = Math.floor(db.kills ?? 0);
    this.el.finalCombo.textContent = `×${Math.floor(db.highestCombo ?? 1)}`;
    this.el.finalPerfects.textContent = Math.floor(db.perfects ?? 0);
    this.el.gameOver.style.display = 'block';
  }
  hideGameOver() { this.el.gameOver.style.display = 'none'; }
  showStart(best) {
    this.el.bestScore.textContent = Math.floor(best);
    this.el.startScreen.style.display = 'block';
    this.hideHUD();
  }
  hideStart() { this.el.startScreen.style.display = 'none'; this.showHUD(); }
  // T09: contextual onboarding hint — calm DOM toast, never pauses combat
  showHint(text) {
    this.el.hint.textContent = text;
    this.el.hint.style.display = 'block';
  }
  hideHint() { this.el.hint.style.display = 'none'; }
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
