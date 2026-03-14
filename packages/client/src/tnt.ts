import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type TntPhase = 'fusing' | 'disabled' | 'exploding' | 'done';

export interface TntEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: TntPhase;
  tick: number;
  grace: boolean; // passable until player's hitbox no longer overlaps this tile
  cells: [number, number][]; // explosion cells, computed at trigger time
}

// ── Constants ────────────────────────────────────────────────────────────────

const FUSE_TICKS_PER_FRAME = 20;  // 20 frames per fuse animation step (×3 = 60 total)
const EXPLODE_FRAME_COUNT     = 11; // 3 source + 4 interpolated between each pair
const EXPLODE_TICKS_PER_FRAME = 1;  // 2 ticks per frame (×11 = 22 ticks total)
const DUD_CHANCE           = 0.09;

// ── Explosion pattern ────────────────────────────────────────────────────────
//
// Centered at (0,0):
//
//   . . . . . . .   dy=-3  (nothing)
//   . . x x x . .   dy=-2
//   . x x x x x .   dy=-1
//   x x x x x x x   dy= 0
//   x x x x x x x   dy=+1
//   x x x x x x x   dy=+2
//   . x x x x x .   dy=+3
//   . . x x x . .   dy=+4

const TNT_PATTERN: [number, number][] = [
  // dy = -2
  [-1, -2], [0, -2], [1, -2],
  // dy = -1
  [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
  // dy = 0
  [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
  // dy = +1
  [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
  // dy = +2
  [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2],
  // dy = +3
  [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3],
  // dy = +4
  [-1, 4], [0, 4], [1, 4],
];

// ── Manager ──────────────────────────────────────────────────────────────────

export class TntManager {
  private entities: TntEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, dir: 'up' | 'down' | 'left' | 'right' | 'none', terrain: Terrain): void {
    const playerTileX = Math.round(playerX / TILE_SIZE);
    const playerTileY = Math.round(playerY / TILE_SIZE);

    const delta: Record<string, [number, number]> = {
      right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], none: [0, 0],
    };
    const [dcol, drow] = delta[dir];
    const tileX = playerTileX + dcol;
    const tileY = playerTileY + drow;

    // Don't place inside a wall or on top of another TNT
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;

    this.entities.push({ id: this.nextId++, tileX, tileY, phase: 'fusing', tick: 0, grace: true, cells: [] });
  }

  // SPRITE hitbox constants (must match game.ts)
  private static readonly MARGIN = 1;
  private static readonly HB     = 12; // SPRITE_SIZE(14) - MARGIN*2

  update(playerX: number, playerY: number, terrain: Terrain): void {
    const { MARGIN, HB } = TntManager;
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;

      // Grace ends as soon as the player's hitbox no longer overlaps the TNT tile
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (!overlaps) e.grace = false;
      }

      if (e.phase === 'fusing' && e.tick >= FUSE_TICKS_PER_FRAME * 3) {
        e.tick = 0;
        if (Math.random() < DUD_CHANCE) {
          e.phase = 'disabled';
        } else {
          e.phase = 'exploding';
          this.applyExplosion(e, terrain);
        }
      } else if (e.phase === 'exploding' && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
      // disabled phase: stays on map indefinitely — no transition to 'done'
    }

    this.chainDetonate(this.getFireCells(), terrain);
    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  private applyExplosion(e: TntEntity, terrain: Terrain): void {
    const rows = terrain.length, cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of TNT_PATTERN) {
      const col = e.tileX + dx, row = e.tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      visual.push([col, row]);
    }
    e.cells = visual;
  }

  /** Returns the current fuse sprite frame index (0-2) for a fusing TNT. */
  fuseFrame(e: TntEntity): number {
    return Math.min(Math.floor(e.tick / FUSE_TICKS_PER_FRAME), 2);
  }

  /** Returns the current explosion sprite frame index for an exploding TNT. */
  explosionFrame(e: TntEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  /** Returns the explosion cells for an entity currently in the exploding phase. */
  explosionCells(e: TntEntity): [number, number][] {
    return e.cells;
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e =>
      (e.phase === 'fusing' || e.phase === 'disabled') && !e.grace && e.tileX === col && e.tileY === row,
    );
  }


  /**
   * Try to push the TNT at (col, row) by (dcol, drow).
   * Returns true if the tile is now passable (no TNT, or TNT pushed successfully).
   * Returns false if the TNT cannot move (wall or another TNT behind it).
   */
  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e =>
      (e.phase === 'fusing' || e.phase === 'disabled') && e.tileX === col && e.tileY === row,
    );
    if (!e) return true;
    const nc = col + dcol;
    const nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc;
    e.tileY = nr;
    return true;
  }

  /** Returns fire-phase explosion tile keys (first 6 frames only). */
  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === 'exploding' && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < 6) {
        for (const [col, row] of this.explosionCells(e)) cells.add(`${col},${row}`);
      }
    }
    return cells;
  }

  /** Trigger any fusing/disabled entities whose tile is in the given cell set. */
  chainDetonate(cells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if ((e.phase === 'fusing' || e.phase === 'disabled') && cells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = 'exploding';
        e.tick = 0;
        this.applyExplosion(e, terrain);
      }
    }
  }

  extinguishAt(col: number, row: number): void {
    for (const e of this.entities) {
      if (e.phase === 'fusing' && e.tileX === col && e.tileY === row) {
        e.phase = 'disabled';
        e.tick = 0;
      }
    }
  }

  /** Force a TNT entity into a specific phase (used for host→client sync). */
  forcePhase(id: number, newPhase: TntPhase, terrain: Terrain): void {
    const e = this.entities.find(e => e.id === id);
    if (!e || e.phase === newPhase) return;
    if (newPhase === 'disabled') {
      e.phase = 'disabled';
    } else if (newPhase === 'exploding') {
      e.phase = 'exploding';
      e.tick = 0;
      this.applyExplosion(e, terrain);
    }
  }

  getEntities(): TntEntity[] {
    return this.entities;
  }
}
