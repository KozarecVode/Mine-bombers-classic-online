import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { SMALL_BOMB_PATTERN } from './bomb.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type LandminePhase = 'armed' | 'exploding' | 'done';

export interface LandmineEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: LandminePhase;
  tick: number;
  grace: boolean; // true while player still overlaps tile after placement
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPLODE_FRAME_COUNT     = 11;
const EXPLODE_TICKS_PER_FRAME = 2;
const CHAIN_FRAME_CUTOFF      = 6;
const MARGIN = 1;
const HB     = 12;

// ── Manager ──────────────────────────────────────────────────────────────────


export class LandmineManager {
  private entities: LandmineEntity[] = [];
  private nextId = 0;

  /** Place at the player's current tile. */
  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: 'armed', tick: 0, grace: true, cells: [] });
  }

  update(playerX: number, playerY: number, terrain: Terrain): void {
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.phase === 'armed') {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (e.grace) {
          if (!overlaps) e.grace = false;
        } else if (overlaps) {
          this.triggerExplosion(e, terrain);
        }
      } else if (e.phase === 'exploding' && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
    }

    this.chainDetonate(this.getFireCells(), terrain);
    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  private triggerExplosion(e: LandmineEntity, terrain: Terrain): void {
    e.phase = 'exploding';
    e.tick = 0;
    const rows = terrain.length, cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of SMALL_BOMB_PATTERN) {
      const col = e.tileX + dx, row = e.tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row)) {
        terrain[row][col] = false; // destroy wall, no sprite
      } else {
        visual.push([col, row]);
      }
    }
    e.cells = visual;
  }

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === 'exploding' && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  chainDetonate(cells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase === 'armed' && !e.grace && cells.has(`${e.tileX},${e.tileY}`)) {
        this.triggerExplosion(e, terrain);
      }
    }
  }

  /** Blocks grenades (and other projectiles) but not the player. */
  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === 'armed' && e.tileX === col && e.tileY === row);
  }

  explosionFrame(e: LandmineEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): LandmineEntity[] { return this.entities; }
}
