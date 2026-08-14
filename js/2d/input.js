export class InputManager {
  constructor() {
    this.keys = {};
    this.addEventListeners();
  }
  addEventListeners(){
    addEventListener('keydown', e=>{
      this.keys[e.key.toLowerCase()] = true;
      if(['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', e=>{
      this.keys[e.key.toLowerCase()] = false;
    });
  }
  isDown(key){ return !!this.keys[key]; }
  getMoveAxis(){
    let ax = 0, ay = 0;
    if(this.isDown('arrowup')||this.isDown('w')) ay -= 1;
    if(this.isDown('arrowdown')||this.isDown('s')) ay += 1;
    if(this.isDown('arrowleft')||this.isDown('a')) ax -= 1;
    if(this.isDown('arrowright')||this.isDown('d')) ax += 1;
    return {ax, ay};
  }
  isBoosting(){ return this.isDown('shift'); }
}
