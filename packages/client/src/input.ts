import { Direction } from '@minebombers/shared';

export class InputManager {
  private keys = new Set<string>();
  private _committedDir: Direction = 'none';
  private _bombPressed = false;
  private _tntPressed = false;
  private _bigCrossPressed = false;
  private _weaponSwitchPressed = false;
  private _stopPressed = false;
  private _fireExtPressed = false;
  private _detonatePressed = false;
  private _treasurePressed = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'ArrowUp'    || e.code === 'KeyW') this._committedDir = 'up';
      if (e.code === 'ArrowDown'  || e.code === 'KeyX') this._committedDir = 'down';
      if (e.code === 'ArrowLeft')  this._committedDir = 'left';
      if (e.code === 'ArrowRight') this._committedDir = 'right';
      if (e.code === 'Space') {
        e.preventDefault();
        this._bombPressed = true;
      }
      if (e.code === 'Delete') {
        e.preventDefault();
        this._tntPressed = true;
      }
      if (e.code === 'KeyF') {
        this._bigCrossPressed = true;
      }
      if (e.code === 'End') {
        e.preventDefault();
        this._weaponSwitchPressed = true;
      }
      if (e.code === 'KeyS') {
        this._stopPressed = true;
        this._committedDir = 'none';
      }
      if (e.code === 'KeyA') {
        this._fireExtPressed = true;
      }
      if (e.code === 'PageDown') {
        e.preventDefault();
        this._detonatePressed = true;
      }
      if (e.code === 'KeyD') {
        this._treasurePressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  getDirection(): Direction {
    return this._committedDir;
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

  /** Returns true once per End keypress (edge-triggered) */
  consumeWeaponSwitch(): boolean {
    const v = this._weaponSwitchPressed;
    this._weaponSwitchPressed = false;
    return v;
  }

  /** Returns true once per F keypress (edge-triggered) */
  consumeBigCrossPress(): boolean {
    const v = this._bigCrossPressed;
    this._bigCrossPressed = false;
    return v;
  }

  /** Returns true once per S keypress (edge-triggered) */
  consumeStopPress(): boolean {
    const v = this._stopPressed;
    this._stopPressed = false;
    return v;
  }

  /** Returns true once per A keypress (edge-triggered) */
  consumeFireExtPress(): boolean {
    const v = this._fireExtPressed;
    this._fireExtPressed = false;
    return v;
  }

  /** Returns true once per PageDown keypress (edge-triggered) */
  consumeDetonatePress(): boolean {
    const v = this._detonatePressed;
    this._detonatePressed = false;
    return v;
  }

  /** Returns true once per D keypress (edge-triggered) */
  consumeTreasurePress(): boolean {
    const v = this._treasurePressed;
    this._treasurePressed = false;
    return v;
  }
}
