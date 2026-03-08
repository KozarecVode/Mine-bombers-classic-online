import { Direction } from '@minebombers/shared';

export class InputManager {
  private keys = new Set<string>();
  private _bombPressed = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this._bombPressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  getDirection(): Direction {
    if (this.keys.has('ArrowUp')    || this.keys.has('KeyW')) return 'up';
    if (this.keys.has('ArrowDown')  || this.keys.has('KeyS')) return 'down';
    if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) return 'left';
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) return 'right';
    return 'none';
  }

  /** Returns true once per keypress (edge-triggered) */
  consumeBombPress(): boolean {
    const v = this._bombPressed;
    this._bombPressed = false;
    return v;
  }
}
