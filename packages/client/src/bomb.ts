import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type BombPhase = "fusing" | "disabled" | "exploding" | "done";

export interface BombEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: BombPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS_PER_FRAME = 20;
const EXPLODE_FRAME_COUNT = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const DUD_CHANCE = 0.09;
const CHAIN_FRAME_CUTOFF = 6;

// ── Manager ──────────────────────────────────────────────────────────────────

export class BombManager {
  private entities: BombEntity[] = [];
  private nextId = 0;
  private static readonly MARGIN = 1;
  private static readonly HB = 12;
  constructor(private readonly pattern: [number, number][]) {}

  place(playerX: number, playerY: number, dir: "up" | "down" | "left" | "right" | "none", terrain: Terrain): void {
    const playerTileX = Math.round(playerX / TILE_SIZE);
    const playerTileY = Math.round(playerY / TILE_SIZE);
    const delta: Record<string, [number, number]> = {
      right: [1, 0],
      left: [-1, 0],
      down: [0, 1],
      up: [0, -1],
      none: [0, 0],
    };
    const [dcol, drow] = delta[dir];
    const tileX = playerTileX + dcol;
    const tileY = playerTileY + drow;
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some((e) => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: "fusing", tick: 0, grace: true, cells: [] });
  }

  update(playerX: number, playerY: number, terrain: Terrain): void {
    const { MARGIN, HB } = BombManager;
    const pl = playerX + MARGIN,
      pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN,
      pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE,
          ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (!overlaps) e.grace = false;
      }
      if (e.phase === "fusing" && e.tick >= FUSE_TICKS_PER_FRAME * 3) {
        if (Math.random() < DUD_CHANCE) {
          e.phase = "disabled";
          e.tick = 0;
        } else {
          e.phase = "exploding";
          e.tick = 0;
          this.applyExplosion(e, terrain);
        }
      } else if (e.phase === "exploding" && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = "done";
      }
      // disabled phase: stays on map indefinitely
    }

    this.chainDetonate(this.getFireCells(), terrain);
    this.entities = this.entities.filter((e) => e.phase !== "done");
  }

  forcePhase(id: number, phase: BombPhase, terrain: Terrain): void {
    const e = this.entities.find(e => e.id === id);
    if (!e || e.phase === phase) return;
    if (phase === 'disabled') {
      e.phase = 'disabled';
      e.tick = 0;
    } else if (phase === 'exploding' && e.phase === 'fusing') {
      e.phase = 'exploding';
      e.tick = 0;
      this.applyExplosion(e, terrain);
    }
  }

  applyExplosion(e: BombEntity, terrain: Terrain): void {
    const rows = terrain.length, cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of this.pattern) {
      const col = e.tileX + dx, row = e.tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      visual.push([col, row]);
    }
    e.cells = visual;
  }

  fuseFrame(e: BombEntity): number {
    return Math.min(Math.floor(e.tick / FUSE_TICKS_PER_FRAME), 2);
  }

  explosionFrame(e: BombEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  explosionCells(e: BombEntity): [number, number][] {
    return e.cells;
  }

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === "exploding" && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [col, row] of e.cells) cells.add(`${col},${row}`);
      }
    }
    return cells;
  }

  chainDetonate(cells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if ((e.phase === "fusing" || e.phase === "disabled") && cells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "exploding";
        e.tick = 0;
        this.applyExplosion(e, terrain);
      }
    }
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some((e) => (e.phase === "fusing" || e.phase === "disabled") && !e.grace && e.tileX === col && e.tileY === row);
  }


  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find((e) => (e.phase === "fusing" || e.phase === "disabled") && e.tileX === col && e.tileY === row);
    if (!e) return true;
    const nc = col + dcol,
      nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc;
    e.tileY = nr;
    return true;
  }

  extinguishAt(col: number, row: number): void {
    for (const e of this.entities) {
      if (e.phase === 'fusing' && e.tileX === col && e.tileY === row) {
        e.phase = 'disabled';
        e.tick = 0;
      }
    }
  }

  getEntities(): BombEntity[] {
    return this.entities;
  }
}

// ── Preset patterns ───────────────────────────────────────────────────────────

// Small bomb: simple cross  .x. / xxx / .x.
export const SMALL_BOMB_PATTERN: [number, number][] = [
  [0, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [0, 1],
];

// Big bomb: expanded diamond  ..x.. / .xxx. / xxxxx / .xxx. / ..x..
export const BIG_BOMB_PATTERN: [number, number][] = [
  [0, -2],
  [-1, -1],
  [0, -1],
  [1, -1],
  [-2, 0],
  [-1, 0],
  [0, 0],
  [1, 0],
  [2, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [0, 2],
];
