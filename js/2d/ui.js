export class UI {
  constructor(){
    this.el = {
      wave: document.getElementById('wave'),
      waveProgress: document.getElementById('waveProgress'),
      score: document.getElementById('score'),
      healthText: document.getElementById('healthText'),
      healthBar: document.getElementById('healthBar'),
      shield: document.getElementById('shield'),
      enemyCount: document.getElementById('enemyCount'),
      waveBarFill: document.getElementById('waveBarFill'),
      boostFill: document.getElementById('boostFill'),
      waveComplete: document.getElementById('waveComplete'),
      waveInfo: document.getElementById('waveInfo'),
      upgrades: document.getElementById('upgrades'),
      gameOver: document.getElementById('gameOver'),
      finalWave: document.getElementById('finalWave'),
      finalScore: document.getElementById('finalScore'),
      nextWave: document.getElementById('nextWave'),
      restart: document.getElementById('restart'),
      startScreen: document.getElementById('startScreen'),
      startBtn: document.getElementById('startBtn'),
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
  updateHUD(state){
    this.el.wave.textContent = state.wave;
    const spawned = state.waveSpawnedCount ?? state.waveTotal;
    const alive = state.enemies?.length ?? 0;
    const killed = Math.max(0, spawned - alive);
    this.el.waveProgress.textContent = `${killed}/${state.waveTotal}`;
    this.el.score.textContent = Math.floor(state.score);
    this.el.healthText.textContent = `${Math.floor(state.health)}/${state.maxHealth}`;
    this.el.healthBar.style.width = `${Math.max(0, state.health/state.maxHealth*100)}%`;
    this.el.shield.textContent = state.shieldTime>0 ? state.shieldTime.toFixed(1)+'s' : '0s';
    this.el.enemyCount.textContent = alive;
    const progressPct = state.waveTotal > 0 ? Math.max(0, killed / state.waveTotal * 100) : 0;
    this.el.waveBarFill.style.width = `${progressPct}%`;
    this.el.boostFill.style.width = `${state.boostFuel/state.boostFuelMax*100}%`;
  }
  showWaveComplete(wave, killed, total, onUpgrade){
    this.el.waveInfo.textContent = `Wave ${wave} cleared. ${killed} enemies eliminated.`;
    this.el.waveComplete.style.display = 'block';
    const container = this.el.upgrades;
    container.innerHTML = '';
    const options = [
      {id:'damage',name:'Laser Damage +1',desc:'Increase damage per shot',apply:()=>onUpgrade('damage')},
      {id:'firerate',name:'Fire Rate -20ms',desc:'Shoot faster',apply:()=>onUpgrade('firerate')},
      {id:'health',name:'Max Health +20',desc:'Increase health pool',apply:()=>onUpgrade('health')},
      {id:'shield',name:'Shield Duration +2s',desc:'Longer shield on pickup',apply:()=>onUpgrade('shield')},
      {id:'boost',name:'Boost Capacity +20',desc:'More boost fuel',apply:()=>onUpgrade('boost')},
    ];
    const chosen=[];
    while(chosen.length<3){
      const o=options[Math.floor(Math.random()*options.length)];
      if(!chosen.includes(o)) chosen.push(o);
    }
    chosen.forEach(o=>{
      const card=document.createElement('div');
      card.className='card';
      card.innerHTML=`<h3>${o.name}</h3><p>${o.desc}</p>`;
      card.onclick=()=>{o.apply(); this.hideWaveComplete();};
      container.appendChild(card);
    });
  }
  hideWaveComplete(){ this.el.waveComplete.style.display='none'; }
  showGameOver(wave, score){
    this.el.finalWave.textContent = wave;
    this.el.finalScore.textContent = Math.floor(score);
    this.el.gameOver.style.display='block';
  }
  hideGameOver(){ this.el.gameOver.style.display='none'; }
  showStart(){ this.el.startScreen.style.display='block'; this.hideHUD(); }
  hideStart(){ this.el.startScreen.style.display='none'; this.showHUD(); }
  showHUD(){ this.el.hudTop.style.display='grid'; this.el.waveBar.style.display='block'; this.el.boostBar.style.display='block'; this.el.legend.style.display='block'; }
  hideHUD(){ this.el.hudTop.style.display='none'; this.el.waveBar.style.display='none'; this.el.boostBar.style.display='none'; this.el.legend.style.display='none'; }
  showPause(wave, score){ this.el.pauseWave.textContent=wave; this.el.pauseScore.textContent=Math.floor(score); this.el.pauseScreen.style.display='block'; }
  hidePause(){ this.el.pauseScreen.style.display='none'; }
}
