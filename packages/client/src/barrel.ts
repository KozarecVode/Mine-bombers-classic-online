import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BarrelPhase = 'placed' | 'exploding' | 'done';

export interface SecondaryBlast {
  cells: [number, number][];
}

export interface BarrelEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: BarrelPhase;
  tick: number;
  grace: boolean;
  centralCells: [number, number][];
  secondaryBlasts: SecondaryBlast[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPLODE_FRAME_COUNT     = 11;
const EXPLODE_TICKS_PER_FRAME = 2;
const CHAIN_FRAME_CUTOFF      = 6;

// Central blast: diamond radius 2
const CENTRAL_PATTERN: [number, number][] = [
                [0,-2],
      [-1,-1],  [0,-1],  [1,-1],
  [-2,0],[-1,0],[0, 0],  [1,0],[2,0],
      [-1, 1],  [0, 1],  [1, 1],
                [0, 2],
];

// Each secondary blast: small diamond (cross radius 1)
const SCATTER_PATTERN: [number, number][] = [
        [0,-1],
  [-1,0],[0, 0],[1,0],
        [0, 1],
];

const SCATTER_RADIUS = 10; // ±10 tiles → 20×20 area
const SECONDARY_MIN  = 10;
const SECONDARY_MAX  = 15;

const MARGIN = 1;
const HB     = 12;

// ── Manager ───────────────────────────────────────────────────────────────────

export class BarrelManager {
  private entities: BarrelEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({
      id: this.nextId++,
      tileX, tileY,
      phase: 'placed',
      tick: 0,
      grace: true,
      centralCells: [],
      secondaryBlasts: [],
    });
  }

  update(playerX: number, playerY: number, _terrain: Terrain): void {
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.phase === 'placed' && e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        if (!(pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty)) e.grace = false;
      } else if (e.phase === 'exploding') {
        if (e.tick >= EXPLODE_FRAME_COUNT * EXPLODE_TICKS_PER_FRAME) e.phase = 'done';
      }
    }

    this.entities = this.entities.filter(e => e.phase !== 'done');
  }

  private applyPattern(
    centerCol: number, centerRow: number,
    pattern: [number, number][], terrain: Terrain,
  ): [number, number][] {
    const rows = terrain.length, cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of pattern) {
      const col = centerCol + dx, row = centerRow + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row)) {
        terrain[row][col] = false;
      } else {
        visual.push([col, row]);
      }
    }
    return visual;
  }

  private triggerExplosion(e: BarrelEntity, terrain: Terrain): void {
    e.phase = 'exploding';
    e.tick = 0;
    e.centralCells = this.applyPattern(e.tileX, e.tileY, CENTRAL_PATTERN, terrain);

    const count = SECONDARY_MIN + Math.floor(Math.random() * (SECONDARY_MAX - SECONDARY_MIN + 1));
    e.secondaryBlasts = [];
    for (let i = 0; i < count; i++) {
      const dcol = Math.round((Math.random() * 2 - 1) * SCATTER_RADIUS);
      const drow = Math.round((Math.random() * 2 - 1) * SCATTER_RADIUS);
      e.secondaryBlasts.push({
        cells: this.applyPattern(e.tileX + dcol, e.tileY + drow, SCATTER_PATTERN, terrain),
      });
    }
  }

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase !== 'exploding') continue;
      if (Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.centralCells) cells.add(`${c},${r}`);
        for (const s of e.secondaryBlasts) {
          for (const [c, r] of s.cells) cells.add(`${c},${r}`);
        }
      }
    }
    return cells;
  }

  chainDetonate(fireCells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase === 'placed' && fireCells.has(`${e.tileX},${e.tileY}`)) {
        this.triggerExplosion(e, terrain);
      }
    }
  }

  explosionFrame(e: BarrelEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === 'placed' && !e.grace && e.tileX === col && e.tileY === row);
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e => e.phase === 'placed' && e.tileX === col && e.tileY === row);
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc; e.tileY = nr;
    return true;
  }

  getEntities(): BarrelEntity[] { return this.entities; }
}
