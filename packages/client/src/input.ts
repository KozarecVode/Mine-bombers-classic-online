import { Direction } from '@minebombers/shared';

export class InputManager {
  private keys = new Set<string>();
  private _bombPressed = false;
  private _tntPressed = false;
  private _stopPressed = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this._bombPressed = true;
      }
      if (e.code === 'Delete') {
        e.preventDefault();
        this._tntPressed = true;
      }
      if (e.code === 'KeyS') {
        this._stopPressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  getDirection(): Direction {
    if (this.keys.has('ArrowUp')    || this.keys.has('KeyW')) return 'up';
    if (this.keys.has('ArrowDown')  || this.keys.has('KeyX')) return 'down';
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

  /** Returns true once per Delete keypress (edge-triggered) */
  consumeTntPress(): boolean {
    const v = this._tntPressed;
    this._tntPressed = false;
    return v;
  }

  /** Returns true once per S keypress (edge-triggered) */
  consumeStopPress(): boolean {
    const v = this._stopPressed;
    this._stopPressed = false;
    return v;
  }
}
