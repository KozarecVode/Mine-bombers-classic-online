import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type BigCrossPhase = 'fusing' | 'exploding' | 'done';

export interface BigCrossEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: BigCrossPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][]; // explosion cells, computed at trigger time
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS_PER_FRAME    = 20;
const EXPLODE_FRAME_COUNT     = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF      = 6;

// ── Manager ──────────────────────────────────────────────────────────────────

export class BigCrossManager {
  private entities: BigCrossEntity[] = [];
  private nextId = 0;
  private static readonly MARGIN = 1;
  private static readonly HB     = 12;
  private readonly maxRange: number;

  constructor(maxRange = Infinity) {
    this.maxRange = maxRange;
  }

  place(
    playerX: number,
    playerY: number,
    dir: 'up' | 'down' | 'left' | 'right' | 'none',
    terrain: Terrain,
  ): void {
    const playerTileX = Math.round(playerX / TILE_SIZE);
    const playerTileY = Math.round(playerY / TILE_SIZE);
    const delta: Record<string, [number, number]> = {
      right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], none: [0, 0],
    };
    const [dc, dr] = delta[dir];
    const tileX = playerTileX + dc;
    const tileY = playerTileY + dr;
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({
      id: this.nextId++, tileX, tileY,
      phase: 'fusing', tick: 0, grace: true, cells: [],
    });
  }

  update(playerX: number, playerY: number, terrain: Terrain, solidAt?: (col: number, row: number) => boolean): void {
    const { MARGIN, HB } = BigCrossManager;
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (!overlaps) e.grace = false;
      }
      if (e.phase === 'fusing' && e.tick >= FUSE_TICKS_PER_FRAME * 3) {
        this.triggerExplosion(e, terrain, solidAt);
      } else if (e.phase === 'exploding' && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
    }

    this.chainDetonate(this.getFireCells(), terrain, solidAt);
    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  /** Trigger any fusing entities whose tile appears in the given fire-cell set. */
  chainDetonate(cells: Set<string>, terrain: Terrain, solidAt?: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      if (e.phase === 'fusing' && cells.has(`${e.tileX},${e.tileY}`)) {
        this.triggerExplosion(e, terrain, solidAt);
      }
    }
  }

  /** Returns the set of currently active (fire-phase) explosion tile keys. */
  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === 'exploding' && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  private triggerExplosion(e: BigCrossEntity, terrain: Terrain, solidAt?: (col: number, row: number) => boolean): void {
    e.phase = 'exploding';
    e.tick = 0;
    const allCells = this.computeCells(e.tileX, e.tileY, terrain, solidAt);
    const visual: [number, number][] = [];
    for (const [col, row] of allCells) {
      visual.push([col, row]);
    }
    e.cells = visual;
  }

  /** Compute all cells in the cross arms, stopping at solid walls, doors, and switches. */
  private computeCells(tileX: number, tileY: number, terrain: Terrain, solidAt?: (col: number, row: number) => boolean): [number, number][] {
    const rows = terrain.length, cols = terrain[0].length;
    const cells: [number, number][] = [[tileX, tileY]];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      let c = tileX + dc, r = tileY + dr;
      let steps = 0;
      while (r >= 0 && r < rows && c >= 0 && c < cols && steps < this.maxRange) {
        const isBorder = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
        if (isBorder) break;
        if (solidAt?.(c, r)) break;
        cells.push([c, r]);
        c += dc; r += dr;
        steps++;
      }
    }
    return cells;
  }

  fuseFrame(_e: BigCrossEntity): number {
    return 0; // single fuse sprite
  }

  explosionFrame(e: BigCrossEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e =>
      e.phase === 'fusing' && !e.grace && e.tileX === col && e.tileY === row,
    );
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e =>
      e.phase === 'fusing' && e.tileX === col && e.tileY === row,
    );
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc;
    e.tileY = nr;
    return true;
  }

  getEntities(): BigCrossEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
