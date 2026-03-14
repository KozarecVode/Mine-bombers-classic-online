import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoulderEntity {
  id: number;
  tileX: number;
  tileY: number;
  grace: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = 1;
const HB     = 12;

// ── Manager ───────────────────────────────────────────────────────────────────

export class BoulderManager {
  private boulders: BoulderEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.boulders.some(b => b.tileX === tileX && b.tileY === tileY)) return;
    this.boulders.push({ id: this.nextId++, tileX, tileY, grace: true });
  }

  update(playerX: number, playerY: number): void {
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;
    for (const b of this.boulders) {
      if (!b.grace) continue;
      const tx = b.tileX * TILE_SIZE, ty = b.tileY * TILE_SIZE;
      if (!(pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty)) b.grace = false;
    }
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.boulders.some(b => !b.grace && b.tileX === col && b.tileY === row);
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const b = this.boulders.find(b => b.tileX === col && b.tileY === row);
    if (!b) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    b.tileX = nc;
    b.tileY = nr;
    return true;
  }

  /** Destroy boulders touched by fire; returns their tile positions. */
  applyFire(fireCells: Set<string>): { col: number; row: number }[] {
    const destroyed: { col: number; row: number }[] = [];
    this.boulders = this.boulders.filter(b => {
      if (fireCells.has(`${b.tileX},${b.tileY}`)) {
        destroyed.push({ col: b.tileX, row: b.tileY });
        return false;
      }
      return true;
    });
    return destroyed;
  }

  getFireCells(): Set<string> { return new Set(); }

  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): BoulderEntity[] { return this.boulders; }
}
