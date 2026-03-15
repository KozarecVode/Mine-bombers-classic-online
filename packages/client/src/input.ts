import { Direction } from '@minebombers/shared';

export type KeyActionName = 'left' | 'right' | 'up' | 'down' | 'stop' | 'bomb' | 'choose' | 'remote';

export interface KeyBindings {
  left:   string;   // move left
  right:  string;   // move right
  up:     string;   // move up
  down:   string;   // move down
  stop:   string;   // stop movement
  bomb:   string;   // place weapon / buy
  choose: string;   // cycle weapon / sell
  remote: string;   // detonate remote
}

export const DEFAULT_BINDINGS: Readonly<KeyBindings> = {
  left:   'ArrowLeft',
  right:  'ArrowRight',
  up:     'ArrowUp',
  down:   'ArrowDown',
  stop:   'ControlRight',
  bomb:   'Delete',
  choose: 'End',
  remote: 'PageDown',
};

export class InputManager {
  private keys = new Set<string>();
  private bindings: KeyBindings = { ...DEFAULT_BINDINGS };

  private _committedDir: Direction = 'none';
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

      // Configurable primary bindings
      if (e.code === this.bindings.left)  this._committedDir = 'left';
      if (e.code === this.bindings.right) this._committedDir = 'right';
      if (e.code === this.bindings.up)    this._committedDir = 'up';
      if (e.code === this.bindings.down)  this._committedDir = 'down';

      // Fixed secondary aliases for direction (always active)
      if (e.code === 'KeyW') this._committedDir = 'up';
      if (e.code === 'KeyX') this._committedDir = 'down';

      if (e.code === this.bindings.stop) {
        this._stopPressed = true;
        this._committedDir = 'none';
      }

      if (e.code === this.bindings.bomb) {
        e.preventDefault();
        this._tntPressed = true;
      }
      // Space is a fixed alias for weapon placement
      if (e.code === 'Space') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        this._tntPressed = true;
      }

      if (e.code === this.bindings.choose) {
        e.preventDefault();
        this._weaponSwitchPressed = true;
      }

      if (e.code === this.bindings.remote) {
        e.preventDefault();
        this._detonatePressed = true;
      }

      // Fixed secondary bindings (non-configurable)
      if (e.code === 'KeyF') this._bigCrossPressed = true;
      if (e.code === 'KeyA') this._fireExtPressed = true;
      if (e.code === 'KeyD') this._treasurePressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  setBindings(b: Partial<KeyBindings>): void {
    Object.assign(this.bindings, b);
  }

  getBindings(): KeyBindings {
    return { ...this.bindings };
  }

  getDirection(): Direction {
    return this._committedDir;
  }

  consumeTntPress(): boolean {
    const v = this._tntPressed; this._tntPressed = false; return v;
  }
  /** @deprecated alias for consumeTntPress */
  consumeBombPress(): boolean {
    return this.consumeTntPress();
  }
  consumeWeaponSwitch(): boolean {
    const v = this._weaponSwitchPressed; this._weaponSwitchPressed = false; return v;
  }
  consumeBigCrossPress(): boolean {
    const v = this._bigCrossPressed; this._bigCrossPressed = false; return v;
  }
  consumeStopPress(): boolean {
    const v = this._stopPressed; this._stopPressed = false; return v;
  }
  consumeFireExtPress(): boolean {
    const v = this._fireExtPressed; this._fireExtPressed = false; return v;
  }
  consumeDetonatePress(): boolean {
    const v = this._detonatePressed; this._detonatePressed = false; return v;
  }
  consumeTreasurePress(): boolean {
    const v = this._treasurePressed; this._treasurePressed = false; return v;
  }

  /** Clear all buffered presses — call before starting a game round. */
  flush(): void {
    this._tntPressed = false;
    this._bigCrossPressed = false;
    this._weaponSwitchPressed = false;
    this._stopPressed = false;
    this._fireExtPressed = false;
    this._detonatePressed = false;
    this._treasurePressed = false;
  }
}
