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
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF      = 6;
const MARGIN = 1;
const HB     = 12;

// ── Manager ──────────────────────────────────────────────────────────────────


export class LandmineManager {
  isAuthority = true; // false on clients — triggers come from host via triggerAt
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

  update(players: { x: number; y: number }[], terrain: Terrain): { tileX: number; tileY: number }[] {
    const triggered: { tileX: number; tileY: number }[] = [];

    for (const e of this.entities) {
      e.tick++;
      if (e.phase === 'armed' && this.isAuthority) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlapping = players.filter(p => {
          const pl = p.x + MARGIN, pr = p.x + MARGIN + HB;
          const pt = p.y + MARGIN, pb = p.y + MARGIN + HB;
          return pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        });
        if (e.grace) {
          // Grace clears only when the placer has fully left the tile
          if (overlapping.length === 0) e.grace = false;
        } else if (overlapping.length > 0) {
          this.triggerExplosion(e, terrain);
          triggered.push({ tileX: e.tileX, tileY: e.tileY });
        }
      } else if (e.phase === 'exploding' && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
    }

    triggered.push(...this.chainDetonate(this.getFireCells(), terrain));
    this.entities = this.entities.filter(e => e.phase !== 'done');
    return triggered;
  }

  /** Trigger the landmine at a specific tile (called on clients from host broadcast). */
  triggerAt(tileX: number, tileY: number, terrain: Terrain): void {
    const e = this.entities.find(e => e.phase === 'armed' && e.tileX === tileX && e.tileY === tileY);
    if (e) this.triggerExplosion(e, terrain);
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
      visual.push([col, row]);
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

  chainDetonate(cells: Set<string>, terrain: Terrain): { tileX: number; tileY: number }[] {
    const triggered: { tileX: number; tileY: number }[] = [];
    if (!this.isAuthority) return triggered;
    for (const e of this.entities) {
      if (e.phase === 'armed' && !e.grace && cells.has(`${e.tileX},${e.tileY}`)) {
        this.triggerExplosion(e, terrain);
        triggered.push({ tileX: e.tileX, tileY: e.tileY });
      }
    }
    return triggered;
  }

  /** Blocks grenades (and other projectiles) but not the player. */
  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === 'armed' && e.tileX === col && e.tileY === row);
  }

  explosionFrame(e: LandmineEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): LandmineEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
