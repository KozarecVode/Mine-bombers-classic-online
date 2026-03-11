import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type FlamethrowerPhase = 'exploding' | 'done';

export interface FlamethrowerEntity {
  id: number;
  phase: FlamethrowerPhase;
  tick: number;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPLODE_FRAME_COUNT     = 6;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF      = 6;

// ── Pattern ───────────────────────────────────────────────────────────────────
//
// Defined in (forward, sideways) space where f=1 is the tile directly in
// front of the player.  The user's grid (0=fire, rows top→bottom when
// aiming UP, so row 9 is closest):
//
//   row 9  (f=1):  width 1
//   row 8  (f=2):  width 1
//   row 7  (f=3):  width 3
//   row 6  (f=4):  width 3
//   row 5  (f=5):  width 5
//   row 4  (f=6):  width 5
//   row 3  (f=7):  width 7  ← widest
//   row 2  (f=8):  width 5
//   row 1  (f=9):  width 3
//   row 0  (f=10): width 1
//
// Each [f, s] pair: f = forward distance, s = sideways offset.

const BASE_PATTERN: [number, number][] = [
  [1, 0],
  [2, 0],
  [3, -1], [3, 0], [3, 1],
  [4, -1], [4, 0], [4, 1],
  [5, -2], [5, -1], [5, 0], [5, 1], [5, 2],
  [6, -2], [6, -1], [6, 0], [6, 1], [6, 2],
  [7, -3], [7, -2], [7, -1], [7, 0], [7, 1], [7, 2], [7, 3],
  [8, -2], [8, -1], [8, 0], [8, 1], [8, 2],
  [9, -1], [9, 0], [9, 1],
  [10, 0],
];

function buildCells(
  tileX: number,
  tileY: number,
  dir: 'up' | 'down' | 'left' | 'right' | 'none',
  terrain: Terrain,
  fOffset: number = 0,
): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const d = dir === 'none' ? 'down' : dir;
  const visual: [number, number][] = [];

  for (const [f, s] of BASE_PATTERN) {
    const fo = f + fOffset;
    let dx: number, dy: number;
    if      (d === 'up')    { dx =  s; dy = -fo; }
    else if (d === 'down')  { dx =  s; dy =  fo; }
    else if (d === 'left')  { dx = -fo; dy =  s; }
    else                    { dx =  fo; dy =  s; } // right

    const col = tileX + dx, row = tileY + dy;
    if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
    if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
    if (isStone(terrain, col, row)) {
      terrain[row][col] = false; // destroy wall, no sprite
    } else {
      visual.push([col, row]);
    }
  }
  return visual;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class FlamethrowerManager {
  private entities: FlamethrowerEntity[] = [];
  private nextId = 0;

  /** Fire immediately — no fuse, explosion starts on the same tick. */
  fire(
    playerX: number,
    playerY: number,
    dir: 'up' | 'down' | 'left' | 'right' | 'none',
    terrain: Terrain,
    moving: boolean = false,
  ): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    this.entities.push({
      id: this.nextId++,
      phase: 'exploding',
      tick: 0,
      cells: buildCells(tileX, tileY, dir, terrain, moving ? 1 : 0),
    });
  }

  update(terrain: Terrain): void {
    for (const e of this.entities) {
      e.tick++;
      if (e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
    }
    this.chainDetonate(this.getFireCells(), terrain);
    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  /** No fusing entities to trigger — participates only as a fire source. */
  chainDetonate(_cells: Set<string>, _terrain: Terrain): void {}

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  explosionFrame(e: FlamethrowerEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  hasSolidAt(_col: number, _row: number): boolean {
    return false;
  }

  getEntities(): FlamethrowerEntity[] { return this.entities; }
}
