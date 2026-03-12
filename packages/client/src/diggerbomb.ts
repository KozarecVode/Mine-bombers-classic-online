import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiggerBombPhase = "fusing" | "exploding" | "done";

export interface DiggerBombEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: DiggerBombPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS           = 120; // 2 seconds at 60 fps
const EXPLODE_FRAME_COUNT  = 11;
const EXPLODE_TICKS_PER_FRAME = 2;
const CHAIN_FRAME_CUTOFF   = 6;
const MARGIN = 1;
const HB     = 12;

// ── Manager ───────────────────────────────────────────────────────────────────

export class DiggerBombManager {
  private entities: DiggerBombEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: "fusing", tick: 0, grace: true, cells: [] });
  }

  update(playerX: number, playerY: number, terrain: Terrain): void {
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;

    for (const e of this.entities) {
      e.tick++;
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        if (!(pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty)) e.grace = false;
      }
      if (e.phase === "fusing" && e.tick >= FUSE_TICKS) {
        e.phase = "exploding";
        e.tick = 0;
        this.applyExplosion(e, terrain);
      } else if (e.phase === "exploding" && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = "done";
      }
    }
    this.entities = this.entities.filter(e => e.phase !== "done");
  }

  private applyExplosion(e: DiggerBombEntity, terrain: Terrain): void {
    const rows = terrain.length, cols = terrain[0].length;
    const col = e.tileX, row = e.tileY;
    if (row <= 0 || row >= rows - 1 || col <= 0 || col >= cols - 1) { e.cells = []; return; }
    if (isStone(terrain, col, row)) {
      terrain[row][col] = false;
      e.cells = [];
    } else {
      e.cells = [[col, row]];
    }
  }

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === "exploding" && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  chainDetonate(fireCells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase === "fusing" && fireCells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "exploding";
        e.tick = 0;
        this.applyExplosion(e, terrain);
      }
    }
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === "fusing" && !e.grace && e.tileX === col && e.tileY === row);
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e => e.phase === "fusing" && e.tileX === col && e.tileY === row);
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc; e.tileY = nr;
    return true;
  }

  explosionFrame(e: DiggerBombEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): DiggerBombEntity[] { return this.entities; }
}
