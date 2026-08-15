// Keyboard input using e.code (layout-independent, e.g. works on AZERTY).
export class InputManager {
  constructor() {
    this.down = {};
    this.pressed = new Set();
    addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.down[e.code]) this.pressed.add(e.code);
      this.down[e.code] = true;
    });
    addEventListener('keyup', e => { this.down[e.code] = false; });
    addEventListener('blur', () => { this.down = {}; });
  }
  isDown(...codes) { return codes.some(c => this.down[c]); }
  wasPressed(...codes) { return codes.some(c => this.pressed.has(c)); }
  endFrame() { this.pressed.clear(); }
  getMoveAxis() {
    let ax = 0, ay = 0;
    if (this.isDown('KeyW', 'ArrowUp')) ay -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) ay += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) ax -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) ax += 1;
    return { ax, ay };
  }
  isBoosting() { return this.isDown('ShiftLeft', 'ShiftRight'); }
}
