import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

const RANGE = 6;

// Show only the smoke tail: explosion frames 6–10 (5 frames)
const SMOKE_FRAME_START    = 6;
const SMOKE_FRAME_COUNT    = 5;
const SMOKE_TICKS_PER_FRAME = 2;

export interface Extinguishable {
  extinguishAt(col: number, row: number): void;
  hasSolidAt(col: number, row: number): boolean;
}

export interface ExtinguisherEntity {
  id: number;
  tick: number;
  cells: [number, number][];
}

export class FireExtinguisherManager {
  private entities: ExtinguisherEntity[] = [];
  private nextId = 0;

  fire(
    playerX: number,
    playerY: number,
    dir: 'up' | 'down' | 'left' | 'right' | 'none',
    terrain: Terrain,
    targets: Extinguishable[],
    moving: boolean = false,
  ): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    const d = dir === 'none' ? 'down' : dir;
    const [dc, dr] = d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0] as [number, number];
    const start = moving ? 2 : 1;

    const cells: [number, number][] = [];
    for (let i = 1; i <= start + RANGE - 1; i++) {
      const col = tileX + dc * i;
      const row = tileY + dr * i;
      if (row < 0 || row >= rows || col < 0 || col >= cols) break;
      if (isStone(terrain, col, row)) break;
      for (const t of targets) t.extinguishAt(col, row);
      // no smoke on cells occupied by a weapon/dud
      const hasWeapon = targets.some(t => t.hasSolidAt(col, row));
      if (i >= start && !hasWeapon) cells.push([col, row]);
    }

    this.entities.push({ id: this.nextId++, tick: 0, cells });
  }

  update(): void {
    for (const e of this.entities) {
      e.tick++;
    }
    this.entities = this.entities.filter(
      e => e.tick < SMOKE_TICKS_PER_FRAME * SMOKE_FRAME_COUNT,
    );
  }

  /** Returns the explosion animation frame index (into the shared explosion array). */
  smokeFrame(e: ExtinguisherEntity): number {
    const f = Math.floor(e.tick / SMOKE_TICKS_PER_FRAME);
    return Math.min(SMOKE_FRAME_START + f, SMOKE_FRAME_START + SMOKE_FRAME_COUNT - 1);
  }

  getEntities(): ExtinguisherEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
