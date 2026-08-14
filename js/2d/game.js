import { CONFIG, ENEMY_TYPES } from './config.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';

export class Game2D {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0; this.H = 0;
    this.input = new InputManager();
    this.ui = new UI();
    this.resize();
    addEventListener('resize', ()=>this.resize());
    
    this.lastAutoShot = 0;
    this.shieldBonus = 5;
    this.state = 'menu';

    this.ui.el.nextWave.onclick = ()=>this.nextWave();
    this.ui.el.restart.onclick = ()=>this.restart();
    this.ui.el.startBtn.onclick = ()=>this.startGame();
    this.ui.el.resumeBtn.onclick = ()=>this.resumeGame();
    this.ui.el.pauseRestart.onclick = ()=>this.restart();

    this.initMenu();
  }

  resize(){
    this.W = this.canvas.width = innerWidth;
    this.H = this.canvas.height = innerHeight;
    this.generateSpawnPoints();
  }

  generateSpawnPoints(){
    this.spawnPoints = [];
    const count = CONFIG.spawnPointsCount || 12;
    const radius = Math.max(this.W, this.H) * 0.55;
    const cx = this.W / 2;
    const cy = this.H / 2;
    for(let i=0;i<count;i++){
      const angle = (Math.PI * 2 * i) / count;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      this.spawnPoints.push({x,y});
    }
  }

  initMenu(){ 
    this.resetState();
    this.state = 'menu';
    this.ui.showStart();
    // clear enemies for menu view
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.pickups = [];
  }

  startGame(){
    this.resetState();
    this.state = 'playing';
    this.ui.hideStart();
  }

  pauseGame(){
    if(this.state!=='playing') return;
    this.state='paused';
    this.ui.showPause(this.wave, this.score);
  }

  resumeGame(){
    if(this.state!=='paused') return;
    this.state='playing';
    this.ui.hidePause();
  }

  resetState(){
    this.score = 0;
    this.maxHealth = CONFIG.maxHealth;
    this.health = CONFIG.maxHealth;
    this.shieldTime = 0;
    this.boostFuel = CONFIG.boostFuelMax;
    this.gameOver = false;
    this.wave = 1;
    this.waveState = 'playing';
    this.waveTotal = 0;
    this.waveRemainingToSpawn = 0;
    this.waveSpawnTimer = 0;
    this.waveSpawnComplete = false;
    this.waveSpawnedCount = 0;
    this.playerDamage = CONFIG.playerDamage;
    this.autoFireRate = CONFIG.autoFireRate;
    this.boostFuelMax = CONFIG.boostFuelMax;
    this.lastTime = performance.now();

    this.ship = { x:this.W/2, y:this.H/2, vx:0, vy:0, angle:0, invuln:0 };
    this.stars = [...Array(200)].map(()=>({x:Math.random()*this.W,y:Math.random()*this.H,z:Math.random()*0.8+0.2,s:Math.random()*1.5+0.5}));
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.particles = [];
    this.shake = 0;

    this.spawnWave();
  }

  weightedPick(){
    const total = Object.values(ENEMY_TYPES).reduce((a,t)=>a+t.weight,0);
    let r = Math.random()*total;
    for(const k in ENEMY_TYPES){ const t=ENEMY_TYPES[k]; r-=t.weight; if(r<=0) return k; }
    return 'fighter';
  }

  spawnEnemy(){
    // Occasionally spawn near the player for surprise attacks
    const nearChance = CONFIG.spawnNearPlayerChance || 0;
    let x, y;
    const jitter = CONFIG.spawnJitter || 40;
    if(Math.random() < nearChance){
      const angle = Math.random() * Math.PI * 2;
      const minDist = CONFIG.spawnNearMinDist || 120;
      const maxDist = CONFIG.spawnNearMaxDist || 220;
      const dist = minDist + Math.random() * (maxDist - minDist);
      x = this.ship.x + Math.cos(angle) * dist;
      y = this.ship.y + Math.sin(angle) * dist;
    }else{
      // Select a random spawn point and avoid spawning too close to player
      let point = null;
      const minSafe = CONFIG.spawnMinSafeDist;
      let attempts = 0;
      while(attempts < 10){
        const sp = this.spawnPoints[Math.floor(Math.random()*this.spawnPoints.length)];
        const dist = Math.hypot(this.ship.x - sp.x, this.ship.y - sp.y);
        if(dist >= minSafe){
          point = sp;
          break;
        }
        attempts++;
      }
      if(!point){
        // Fallback: pick furthest point from player
        let best = null, bestDist = 0;
        for(const sp of this.spawnPoints){
          const d = Math.hypot(this.ship.x - sp.x, this.ship.y - sp.y);
          if(d > bestDist){ bestDist = d; best = sp; }
        }
        point = best;
      }
      x = point.x + (Math.random()-0.5)*jitter;
      y = point.y + (Math.random()-0.5)*jitter;
    }
    const typeKey = this.weightedPick();
    const type = ENEMY_TYPES[typeKey];
    const hp = type.hpBase * (1 + (this.wave-1)*0.15);
    this.enemies.push({
      x,y,
      vx:(Math.random()-0.5)*type.speed,
      vy:(Math.random()-0.5)*type.speed,
      r:type.r,
      hp,hpMax:hp,
      fireCooldown:Math.random()*type.fireRate,
      angle:0,
      type:typeKey,
      color:type.color,
      speed:type.speed,
      fireRate:type.fireRate
    });
    this.waveSpawnedCount++;
  }

  spawnWave(){
    this.waveTotal = CONFIG.waveEnemiesBase + (this.wave-1)*CONFIG.waveEnemyGrowth;
    this.waveRemainingToSpawn = this.waveTotal;
    this.waveSpawnComplete = false;
    this.waveSpawnTimer = 0; // spawn first batch immediately
    this.waveSpawnedCount = 0;
  }

  spawnPickup(x,y,type){ this.pickups.push({x,y,type,vy:-1,life:300}); }

  addExplosion(x,y,color='#ffaa00',count=40){
    for(let i=0;i<count;i++) this.particles.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,life:1,alpha:1,size:Math.random()*3+1,color});
  }
  addParticles(x,y,color,count){
    for(let i=0;i<count;i++) this.particles.push({x,y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:1,alpha:1,size:2,color});
  }

  findNearestTarget(){
    let best=null,bestDist=CONFIG.autoRange;
    for(const e of this.enemies){
      const d=Math.hypot(this.ship.x-e.x,this.ship.y-e.y);
      if(d<bestDist){bestDist=d;best=e;}
    }
    return best;
  }

  applyUpgrade(id){
    if(id==='damage') this.playerDamage +=1;
    else if(id==='firerate') this.autoFireRate = Math.max(60,this.autoFireRate-20);
    else if(id==='health'){ this.maxHealth+=20; this.health+=20; }
    else if(id==='shield'){ this.shieldBonus +=2; }
    else if(id==='boost'){ this.boostFuelMax +=20; this.boostFuel = Math.min(this.boostFuel,this.boostFuelMax); }
  }

  startUpgradeScreen(){
    this.waveState='upgrade';
    const killed = this.waveTotal - this.enemies.length;
    this.ui.showWaveComplete(this.wave, killed, this.waveTotal, (id)=>{
      this.applyUpgrade(id);
      this.nextWave();
    });
  }

  nextWave(){
    this.ui.hideWaveComplete();
    this.wave++;
    this.health = Math.min(this.maxHealth,this.health);
    this.boostFuel = this.boostFuelMax;
    this.waveState='playing';
    this.enemies.length=0;
    this.playerBullets.length=0;
    this.enemyBullets.length=0;
    this.pickups.length=0;
    this.particles.length=0;
    this.spawnWave();
  }

  restart(){
    this.ui.hideGameOver();
    this.ui.hidePause();
    this.initMenu();
  }

  update(){
    // handle pause toggle
    if(this.state==='playing' && (this.input.isDown('p') || this.input.isDown('escape'))){
      // debounce simple
      this._pausePressed = true;
      this.pauseGame();
    } else if(this.state==='paused' && !this.input.isDown('p') && !this.input.isDown('escape')){
      this._pausePressed = false;
    }
    if(this.state!=='playing' || this.gameOver || this.waveState!=='playing') return;

    // Delta time for spawn timing
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    // Randomized batch spawning
    if(this.waveRemainingToSpawn > 0){
      if(this.waveSpawnTimer <= 0){
        // Determine batch size
        const remaining = this.waveRemainingToSpawn;
        let batchSize;
        const minBatch = CONFIG.spawnMinBatchSize;
        const maxBatch = CONFIG.spawnMaxBatchSize;
        if(remaining <= minBatch){
          batchSize = remaining;
        }else{
          const maxSize = Math.min(maxBatch, remaining);
          batchSize = minBatch + Math.floor(Math.random() * (maxSize - minBatch + 1));
        }
        // Spawn batch
        for(let i=0;i<batchSize;i++){
          this.spawnEnemy();
        }
        this.waveRemainingToSpawn -= batchSize;
        // Schedule next batch
        if(this.waveRemainingToSpawn > 0){
          const minDelay = CONFIG.spawnMinDelay;
          const maxDelay = CONFIG.spawnMaxDelay;
          this.waveSpawnTimer = minDelay + Math.random() * (maxDelay - minDelay);
        }else{
          this.waveSpawnComplete = true;
          this.waveSpawnTimer = 0;
        }
      }else{
        this.waveSpawnTimer -= delta;
      }
    }

    const {ax,ay} = this.input.getMoveAxis();
    const mag = Math.hypot(ax,ay)||1;
    const boostActive = this.input.isBoosting() && this.boostFuel>0;
    const curSpeed = boostActive? CONFIG.playerSpeed*CONFIG.boostMultiplier : CONFIG.playerSpeed;
    
    if(boostActive) this.boostFuel -= CONFIG.boostRate;
    else this.boostFuel = Math.min(this.boostFuelMax,this.boostFuel + CONFIG.regenRate);

    this.ship.vx += ax/mag * CONFIG.playerAcceleration;
    this.ship.vy += ay/mag * CONFIG.playerAcceleration;
    this.ship.vx *= CONFIG.playerFriction;
    this.ship.vy *= CONFIG.playerFriction;
    this.ship.x += this.ship.vx * curSpeed;
    this.ship.y += this.ship.vy * curSpeed;
    this.ship.x = Math.max(CONFIG.shipSize, Math.min(this.W-CONFIG.shipSize,this.ship.x));
    this.ship.y = Math.max(CONFIG.shipSize, Math.min(this.H-CONFIG.shipSize,this.ship.y));

    if(this.ship.invuln>0) this.ship.invuln -=1;
    if(this.shieldTime>0) this.shieldTime -= 1/60;
    this.stars.forEach(s=>{s.y += s.z*1.2; if(s.y>this.H) s.y=0;});

    const target = this.findNearestTarget();
    if(target){
      const angle = Math.atan2(target.y-this.ship.y,target.x-this.ship.x);
      this.ship.angle = angle;
      if(performance.now()-this.lastAutoShot > this.autoFireRate){
        this.playerBullets.push({
          x:this.ship.x+Math.cos(angle)*28,
          y:this.ship.y+Math.sin(angle)*28,
          vx:Math.cos(angle)*10,
          vy:Math.sin(angle)*10,
          life:90
        });
        this.addParticles(this.ship.x,this.ship.y,'#7dd3fc',6);
        this.lastAutoShot = performance.now();
      }
    }

    // enemies
    for(let i=this.enemies.length-1;i>=0;i--){
      const e = this.enemies[i];
      const dx = this.ship.x-e.x, dy = this.ship.y-e.y;
      const dist = Math.hypot(dx,dy);
      const dir = Math.atan2(dy,dx);
      e.angle = dir;
      e.vx += Math.cos(dir)*0.02*e.speed/1.2;
      e.vy += Math.sin(dir)*0.02*e.speed/1.2;
      e.vx *= 0.98; e.vy *= 0.98;
      e.x += e.vx; e.y += e.vy;
      e.fireCooldown -= 16;
      if(e.fireCooldown <= 0 && dist < 700){
        const speed = e.type==='sniper'?7:5;
        this.enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(dir)*speed,vy:Math.sin(dir)*speed,life:240,color:e.color});
        e.fireCooldown = e.fireRate*(0.6+Math.random()*0.8);
      }
      if(this.ship.invuln===0 && dist < CONFIG.shipSize*0.8 + e.r*0.7){
        if(this.shieldTime>0){
          this.shake=8; this.addExplosion(e.x,e.y,'#60a5fa',25);
          this.enemies.splice(i,1); this.spawnPickup(e.x,e.y,'health'); this.score+=150;
        }else{
          this.health -= 0.8; this.ship.invuln=30; this.shake=12; this.addExplosion(this.ship.x,this.ship.y,'#ff5555',20);
        }
      }
    }

    // player bullets
    for(let bi=this.playerBullets.length-1; bi>=0; bi--){
      const b = this.playerBullets[bi];
      b.x += b.vx; b.y += b.vy; b.life--;
      if(b.life<=0 || b.x<0||b.x>this.W||b.y<0||b.y>this.H){ this.playerBullets.splice(bi,1); continue; }
      for(let ei=this.enemies.length-1; ei>=0; ei--){
        const e = this.enemies[ei];
        if(Math.hypot(b.x-e.x,b.y-e.y) < e.r){
          e.hp -= this.playerDamage;
          this.addExplosion(b.x,b.y,'#fde047',15);
          this.playerBullets.splice(bi,1);
          if(e.hp<=0){
            this.addExplosion(e.x,e.y,e.color,50);
            this.shake=10;
            const type = Math.random()<0.3?'shield':'health';
            this.spawnPickup(e.x,e.y,type);
            this.score += 200 + (e.type==='tank'?100:0);
            this.enemies.splice(ei,1);
          }
          break;
        }
      }
    }

    // enemy bullets
    for(let i=this.enemyBullets.length-1;i>=0;i--){
      const b=this.enemyBullets[i];
      b.x+=b.vx; b.y+=b.vy; b.life--;
      if(b.life<=0||b.x<0||b.x>this.W||b.y<0||b.y>this.H){ this.enemyBullets.splice(i,1); continue; }
      if(Math.hypot(this.ship.x-b.x,this.ship.y-b.y)<20 && this.ship.invuln===0){
        if(this.shieldTime>0){ this.shake=6; this.enemyBullets.splice(i,1); this.addExplosion(b.x,b.y,'#60a5fa',15); }
        else { this.health-=5; this.ship.invuln=30; this.shake=10; this.addExplosion(b.x,b.y,'#ff5555',20); this.enemyBullets.splice(i,1); }
      }
    }

    // pickups
    for(let i=this.pickups.length-1;i>=0;i--){
      const p=this.pickups[i];
      p.y+=p.vy; p.life--;
      if(p.life<=0){ this.pickups.splice(i,1); continue; }
      if(Math.hypot(this.ship.x-p.x,this.ship.y-p.y)<28){
        if(p.type==='health') this.health=Math.min(this.maxHealth,this.health+25);
        else this.shieldTime = this.shieldBonus;
        this.score+=50;
        this.addExplosion(p.x,p.y,'#22c55e',20);
        this.pickups.splice(i,1);
      }
    }

    // particles
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life-=0.018; p.alpha=p.life;
      if(p.life<=0) this.particles.splice(i,1);
    }

    this.score += 0.15;
    if(this.shake>0) this.shake -=1;

    this.ui.updateHUD({
      wave:this.wave,
      waveTotal:this.waveTotal,
      waveSpawnedCount:this.waveSpawnedCount,
      enemies:this.enemies,
      score:this.score,
      health:this.health,
      maxHealth:this.maxHealth,
      shieldTime:this.shieldTime,
      boostFuel:this.boostFuel,
      boostFuelMax:this.boostFuelMax,
    });

    if(this.enemies.length===0 && this.waveSpawnComplete && this.waveState==='playing') this.startUpgradeScreen();
    if(this.health<=0){
      this.gameOver=true;
      this.state='gameover';
      this.ui.showGameOver(this.wave,this.score);
    }
  }

  draw(){
    const ctx = this.ctx;
    ctx.save();
    if(this.shake>0) ctx.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake);

    const g = ctx.createRadialGradient(this.W/2,this.H/2,0,this.W/2,this.H/2,Math.max(this.W,this.H));
    g.addColorStop(0,'#020617'); g.addColorStop(1,'#000000');
    ctx.fillStyle=g; ctx.fillRect(0,0,this.W,this.H);

    this.stars.forEach(s=>{ctx.globalAlpha=s.z*0.9; ctx.fillStyle='#fff'; ctx.fillRect(s.x,s.y,s.s,s.s);});
    ctx.globalAlpha=1;

    this.enemies.forEach(e=>{
      ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.angle);
      ctx.shadowColor=e.color; ctx.shadowBlur=18;
      ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=e.color;
      ctx.beginPath(); ctx.moveTo(e.r,0); ctx.lineTo(-e.r*0.6,e.r*0.7); ctx.lineTo(-e.r*0.6,-e.r*0.7); ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0; ctx.restore();
    });

    this.enemyBullets.forEach(b=>{ctx.fillStyle=b.color||'#f87171'; ctx.shadowColor=b.color; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;});
    this.playerBullets.forEach(b=>{ctx.fillStyle='#7dd3fc'; ctx.shadowColor='#7dd3fc'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;});
    this.pickups.forEach(p=>{ctx.fillStyle=p.type==='health'?'#22c55e':'#60a5fa'; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;});
    this.particles.forEach(p=>{ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size);});
    ctx.globalAlpha=1;

    ctx.save();
    ctx.translate(this.ship.x,this.ship.y);
    ctx.rotate(this.ship.angle);
    ctx.shadowColor='#7dd3fc'; ctx.shadowBlur=22;
    const grad = ctx.createLinearGradient(-CONFIG.shipSize,0,CONFIG.shipSize,0);
    grad.addColorStop(0,'#7dd3fc'); grad.addColorStop(1,'#1e40af');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(CONFIG.shipSize,0);
    ctx.lineTo(-CONFIG.shipSize*0.7,-CONFIG.shipSize*0.7);
    ctx.lineTo(-CONFIG.shipSize*0.4,0);
    ctx.lineTo(-CONFIG.shipSize*0.7,CONFIG.shipSize*0.7);
    ctx.closePath(); ctx.fill();
    if(this.input.isBoosting() && this.boostFuel>0){ ctx.fillStyle='#fde047'; ctx.fillRect(-CONFIG.shipSize*0.6,0,14,7); }
    if(this.ship.invuln%6<3) ctx.globalAlpha=0.5;
    ctx.shadowBlur=0; ctx.restore();

    if(this.shieldTime>0){
      ctx.strokeStyle='rgba(96,165,250,0.8)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(this.ship.x,this.ship.y,CONFIG.shipSize+18,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  loop(){
    this.update();
    this.draw();
    requestAnimationFrame(()=>this.loop());
  }

  start(){ this.loop(); }
}
