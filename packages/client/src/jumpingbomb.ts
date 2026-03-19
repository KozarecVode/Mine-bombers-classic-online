import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface JumpingBombExplosion {
  tick: number;
  cells: [number, number][];
}

export interface JumpingBombEntity {
  id: number;
  tick: number;
  fuseTicks: number;
  tileX: number;
  tileY: number;
  explosionsLeft: number;
  done: boolean;
  explosions: JumpingBombExplosion[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_EXPLOSIONS        = 10;
const MIN_FUSE                = 0;    // 0s
const MAX_FUSE                = 120;  // 2s
const MIN_RADIUS              = 1;
const MAX_RADIUS              = 5;
const MIN_JUMP                = 1;
const MAX_JUMP                = 6;
const EXPLODE_FRAME_COUNT     = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const EXPLODE_TICKS           = EXPLODE_FRAME_COUNT * EXPLODE_TICKS_PER_FRAME;
const CHAIN_FRAME_CUTOFF      = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIRS: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildCircle(cx: number, cy: number, radius: number, terrain: Terrain, blocked: (c: number, r: number) => boolean): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const result: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const col = cx + dx, row = cy + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row) || blocked(col, row)) continue;
      result.push([col, row]);
    }
  }
  return result;
}

function computeJump(cx: number, cy: number, terrain: Terrain, blocked: (c: number, r: number) => boolean): [number, number] {
  const rows = terrain.length, cols = terrain[0].length;
  const [dx, dy] = DIRS[Math.floor(Math.random() * DIRS.length)];
  const dist = rand(MIN_JUMP, MAX_JUMP);
  for (let d = dist; d >= 1; d--) {
    const nx = cx + dx * d, ny = cy + dy * d;
    if (nx < 1 || nx >= cols - 1 || ny < 1 || ny >= rows - 1) continue;
    if (!isStone(terrain, nx, ny) && !blocked(nx, ny)) return [nx, ny];
  }
  return [cx, cy];
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class JumpingBombManager {
  private entities: JumpingBombEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, _terrain: Terrain, blocked: (c: number, r: number) => boolean = () => false): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (blocked(tileX, tileY)) return; // don't place on walls/doors/switches
    this.entities.push({
      id: this.nextId++,
      tick: 0,
      fuseTicks: rand(MIN_FUSE, MAX_FUSE),
      tileX,
      tileY,
      explosionsLeft: TOTAL_EXPLOSIONS,
      done: false,
      explosions: [],
    });
  }

  private triggerExplosion(e: JumpingBombEntity, terrain: Terrain, blocked: (c: number, r: number) => boolean): void {
    // Spawn explosion visual at current position
    e.explosions.push({
      tick: 0,
      cells: buildCircle(e.tileX, e.tileY, rand(MIN_RADIUS, MAX_RADIUS), terrain, blocked),
    });
    e.explosionsLeft--;

    if (e.explosionsLeft <= 0) {
      e.done = true;
      return;
    }

    // Immediately jump to new position and start new fuse
    const [nx, ny] = computeJump(e.tileX, e.tileY, terrain, blocked);
    e.tileX = nx;
    e.tileY = ny;
    e.fuseTicks = rand(MIN_FUSE, MAX_FUSE);
    e.tick = 0;
  }

  update(terrain: Terrain, blocked: (c: number, r: number) => boolean = () => false): void {
    for (const e of this.entities) {
      if (!e.done) {
        e.tick++;
        if (e.tick >= e.fuseTicks) {
          this.triggerExplosion(e, terrain, blocked);
        }
      }
      // Advance all explosion animations
      for (const ex of e.explosions) ex.tick++;
      e.explosions = e.explosions.filter(ex => ex.tick < EXPLODE_TICKS);
    }
    // Remove entities only once done AND all explosion animations finished
    this.entities = this.entities.filter(e => !e.done || e.explosions.length > 0);
  }

  chainDetonate(fireCells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      // Immune for full explosion duration after each jump so own fire can't cascade
      if (e.done || e.tick <= EXPLODE_TICKS) continue;
      if (fireCells.has(`${e.tileX},${e.tileY}`)) this.triggerExplosion(e, terrain);
    }
  }

  getFireCells(): Set<string> {
    const out = new Set<string>();
    for (const e of this.entities) {
      for (const ex of e.explosions) {
        if (Math.floor(ex.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
          for (const [c, r] of ex.cells) out.add(`${c},${r}`);
        }
      }
    }
    return out;
  }

  hasSolidAt(_col: number, _row: number): boolean { return false; }
  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean { return true; }

  explosionFrame(ex: JumpingBombExplosion): number {
    return Math.min(Math.floor(ex.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  applyNetState(entities: Array<{ id: number; tileX: number; tileY: number; tick: number; fuseTicks: number; explosionsLeft: number }>): void {
    const seen = new Set<number>();
    for (const p of entities) {
      seen.add(p.id);
      const e = this.entities.find(e => e.id === p.id);
      if (e) {
        e.tileX = p.tileX; e.tileY = p.tileY;
        e.tick = p.tick; e.fuseTicks = p.fuseTicks; e.explosionsLeft = p.explosionsLeft;
      } else {
        this.entities.push({ id: p.id, tick: p.tick, fuseTicks: p.fuseTicks, tileX: p.tileX, tileY: p.tileY, explosionsLeft: p.explosionsLeft, done: false, explosions: [] });
      }
    }
    // Remove active entities no longer present on the host
    this.entities = this.entities.filter(e => e.done || seen.has(e.id));
  }

  getEntities(): JumpingBombEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
