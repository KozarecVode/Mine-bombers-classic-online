import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type DetBombPhase = "placed" | "exploding" | "done";

export interface DetBombEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: DetBombPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPLODE_FRAME_COUNT     = 11;
const EXPLODE_TICKS_PER_FRAME = 2;
const CHAIN_FRAME_CUTOFF      = 6;

// ── Manager ──────────────────────────────────────────────────────────────────

export class DetBombManager {
  private entities: DetBombEntity[] = [];
  private nextId = 0;
  private static readonly MARGIN = 1;
  private static readonly HB = 12;

  constructor(private readonly pattern: [number, number][]) {}

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some((e) => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: "placed", tick: 0, grace: true, cells: [] });
  }

  /** Manually detonate all placed bombs. */
  detonate(terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase === "placed") {
        e.phase = "exploding";
        e.tick = 0;
        this.applyExplosion(e, terrain);
      }
    }
  }

  update(playerX: number, playerY: number, terrain: Terrain): void {
    const { MARGIN, HB } = DetBombManager;
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        const overlaps = pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty;
        if (!overlaps) e.grace = false;
      }
      if (e.phase === "exploding") {
        e.tick++;
        if (e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
          e.phase = "done";
        }
      }
    }
    this.entities = this.entities.filter((e) => e.phase !== "done");
  }

  private applyExplosion(e: DetBombEntity, terrain: Terrain): void {
    const rows = terrain.length, cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of this.pattern) {
      const col = e.tileX + dx, row = e.tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row)) {
        terrain[row][col] = false;
      } else {
        visual.push([col, row]);
      }
    }
    e.cells = visual;
  }

  explosionFrame(e: DetBombEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
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
      if (e.phase === "placed" && cells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "exploding";
        e.tick = 0;
        this.applyExplosion(e, terrain);
      }
    }
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some((e) => e.phase === "placed" && !e.grace && e.tileX === col && e.tileY === row);
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find((e) => e.phase === "placed" && e.tileX === col && e.tileY === row);
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc;
    e.tileY = nr;
    return true;
  }

  extinguishAt(_col: number, _row: number): void {
    // det bombs cannot be extinguished — they only respond to manual detonation
  }

  getEntities(): DetBombEntity[] { return this.entities; }
}

// ── Patterns ──────────────────────────────────────────────────────────────────

// small_detonate:
// 11011
// 10001
// 00000
// 10001
// 11011
export const SMALL_DETONATE_PATTERN: [number, number][] = [
  [0, -2],
  [-1, -1], [0, -1], [1, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-1, 1], [0, 1], [1, 1],
  [0, 2],
];

// big_detonate:
// 1100011
// 1000001
// 0000000
// 0000000
// 0000000
// 1000001
// 1100011
export const BIG_DETONATE_PATTERN: [number, number][] = [
  [-1, -3], [0, -3], [1, -3],
  [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
  [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
  [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
  [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
  [-1, 3], [0, 3], [1, 3],
];
