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

const PATTERN_SET = new Set(SMALL_BOMB_PATTERN.map(([dx, dy]) => `${dx},${dy}`));

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
    e.cells = this.computeCells(e.tileX, e.tileY, terrain);
    for (const [col, row] of e.cells) {
      const isBorder = row === 0 || row === terrain.length - 1 || col === 0 || col === terrain[0].length - 1;
      if (!isBorder && terrain[row]?.[col]) terrain[row][col] = false;
    }
  }

  private computeCells(tileX: number, tileY: number, terrain: Terrain): [number, number][] {
    const rows = terrain.length, cols = terrain[0].length;
    const visited = new Set<string>();
    const result: [number, number][] = [];
    const queue: [number, number][] = [[0, 0]];
    visited.add('0,0');

    while (queue.length > 0) {
      const [dx, dy] = queue.shift()!;
      const col = tileX + dx, row = tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      const isBorder = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      const isWall = isStone(terrain, col, row);
      if (isBorder && isWall) continue;
      result.push([col, row]);
      if (!isWall) {
        for (const [ndx, ndy] of [[dx+1,dy],[dx-1,dy],[dx,dy+1],[dx,dy-1]] as [number,number][]) {
          const key = `${ndx},${ndy}`;
          if (!visited.has(key) && PATTERN_SET.has(key)) {
            visited.add(key);
            queue.push([ndx, ndy]);
          }
        }
      }
    }
    return result;
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

  /** Landmines are flush with the ground — don't block player or weapon movement. */
  hasSolidAt(_col: number, _row: number): boolean {
    return false;
  }

  explosionFrame(e: LandmineEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): LandmineEntity[] { return this.entities; }
}
