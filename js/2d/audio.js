// Tiny synthesized SFX engine (Web Audio API, no assets).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('sw2d_muted') === '1';
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  toggle() {
    this.muted = !this.muted;
    localStorage.setItem('sw2d_muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  tone({ type = 'sine', f0 = 440, f1, dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise({ dur = 0.2, vol = 0.3, freq = 800, delay = 0 }) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  shoot() { this.tone({ type: 'square', f0: 880, f1: 180, dur: 0.07, vol: 0.045 }); }
  enemyShoot() { this.tone({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.12, vol: 0.04 }); }
  hit() { this.noise({ dur: 0.06, vol: 0.12, freq: 2500 }); }
  explosion(big = false) {
    this.noise({ dur: big ? 0.5 : 0.25, vol: big ? 0.5 : 0.28, freq: big ? 480 : 900 });
    this.tone({ f0: big ? 120 : 200, f1: 40, dur: big ? 0.45 : 0.2, vol: 0.3 });
  }
  pickup() {
    this.tone({ f0: 520, f1: 780, dur: 0.08, vol: 0.14 });
    this.tone({ f0: 780, f1: 1040, dur: 0.1, vol: 0.14, delay: 0.07 });
  }
  // T07: restrained heal blip — quieter than pickup; the game throttles call rate
  heal() { this.tone({ type: 'sine', f0: 660, f1: 990, dur: 0.08, vol: 0.07 }); }
  shieldUp() { this.tone({ f0: 300, f1: 620, dur: 0.25, vol: 0.15 }); }
  fuelLow() { this.tone({ type: 'sine', f0: 320, f1: 240, dur: 0.14, vol: 0.1 }); }
  fuelEmpty() { this.tone({ type: 'sawtooth', f0: 170, f1: 70, dur: 0.24, vol: 0.13 }); }
  playerHit() {
    this.noise({ dur: 0.2, vol: 0.35, freq: 1200 });
    this.tone({ type: 'sawtooth', f0: 160, f1: 60, dur: 0.25, vol: 0.25 });
  }
  waveClear() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f0: f, dur: 0.15, vol: 0.14, delay: i * 0.09 })); }
  // T04: brighter, higher triangle arpeggio — distinct from the sine waveClear
  perfectClear() { [880, 1108.7, 1318.5, 1760].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.13, vol: 0.16, delay: i * 0.08 })); }
  bossWarning() {
    this.tone({ type: 'sawtooth', f0: 110, dur: 0.4, vol: 0.18 });
    this.tone({ type: 'sawtooth', f0: 110, dur: 0.4, vol: 0.18, delay: 0.5 });
  }
  ui() { this.tone({ f0: 660, dur: 0.05, vol: 0.09 }); }
}
