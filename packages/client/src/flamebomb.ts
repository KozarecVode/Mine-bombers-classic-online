import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type FlameBombPhase = 'fusing' | 'disabled' | 'exploding' | 'done';

export interface FlameBombEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: FlameBombPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS            = 60 * 4; // 4 seconds at 60 fps
const FUSE_FRAME_TICKS      = 4;      // swap fuse sprite every 4 ticks
const EXPLODE_FRAME_COUNT   = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF    = 6;
const MAX_NAPALM_TILES      = 80;

const SPREAD_DIRS: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];

// ── Manager ──────────────────────────────────────────────────────────────────

export class FlameBombManager {
  private entities: FlameBombEntity[] = [];
  private nextId = 0;
  private static readonly MARGIN = 1;
  private static readonly HB     = 12;

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
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: 'fusing', tick: 0, grace: true, cells: [] });
  }

  update(playerX: number, playerY: number, terrain: Terrain, blockedAt: (c: number, r: number) => boolean = () => false): void {
    const { MARGIN, HB } = FlameBombManager;
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (!overlaps) e.grace = false;
      }
      if (e.phase === 'fusing' && e.tick >= FUSE_TICKS) {
        this.triggerExplosion(e, terrain, blockedAt);
      } else if (e.phase === 'exploding' && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = 'done';
      }
    }

    this.chainDetonate(this.getFireCells(), terrain, blockedAt);
    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  chainDetonate(cells: Set<string>, terrain: Terrain, blockedAt: (c: number, r: number) => boolean = () => false): void {
    for (const e of this.entities) {
      if ((e.phase === 'fusing' || e.phase === 'disabled') && cells.has(`${e.tileX},${e.tileY}`)) {
        this.triggerExplosion(e, terrain, blockedAt);
      }
    }
  }

  extinguishAt(col: number, row: number): void {
    for (const e of this.entities) {
      if (e.phase === 'fusing' && e.tileX === col && e.tileY === row) {
        e.phase = 'disabled';
      }
    }
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

  private triggerExplosion(e: FlameBombEntity, terrain: Terrain, blockedAt: (c: number, r: number) => boolean): void {
    e.phase = 'exploding';
    e.tick = 0;
    const rows = terrain.length, cols = terrain[0].length;

    // BFS flood-fill through passable tiles (napalm flows through open space)
    const visited = new Set<string>([`${e.tileX},${e.tileY}`]);
    const queue: [number, number][] = [[e.tileX, e.tileY]];
    const cells: [number, number][] = [[e.tileX, e.tileY]];

    outer: while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      for (const [dc, dr] of SPREAD_DIRS) {
        const nc = c + dc, nr = r + dr;
        if (nr <= 0 || nr >= rows - 1 || nc <= 0 || nc >= cols - 1) continue;
        const key = `${nc},${nr}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (isStone(terrain, nc, nr) || blockedAt(nc, nr)) continue;
        cells.push([nc, nr]);
        if (cells.length >= MAX_NAPALM_TILES) break outer;
        queue.push([nc, nr]);
      }
    }

    e.cells = cells;
  }

  fuseFrame(e: FlameBombEntity): number {
    return Math.floor(e.tick / FUSE_FRAME_TICKS) % 2;
  }

  explosionFrame(e: FlameBombEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e =>
      (e.phase === 'fusing' || e.phase === 'disabled') && !e.grace && e.tileX === col && e.tileY === row,
    );
  }


  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e =>
      (e.phase === 'fusing' || e.phase === 'disabled') && e.tileX === col && e.tileY === row,
    );
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc;
    e.tileY = nr;
    return true;
  }

  getEntities(): FlameBombEntity[] { return this.entities; }
}
