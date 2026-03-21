import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type NuclearPhase = "fusing" | "exploding" | "done";

export interface NuclearEntity {
  id: number;
  phase: NuclearPhase;
  tick: number;
  centerX: number;
  centerY: number;
  cells: [number, number][]; // circle radius 24, excluding walls
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS = 60 * 4; // 4 seconds
const FUSE_FRAME_COUNT = 3;
const FUSE_TICKS_PER_FRAME = 2;

const FLASH_TICKS = 20; // white flash duration before explosion shows
const EXPLODE_FRAME_COUNT = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const TOTAL_EXPLODE_TICKS = FLASH_TICKS + EXPLODE_FRAME_COUNT * EXPLODE_TICKS_PER_FRAME;
const CHAIN_FRAME_CUTOFF = 6;
const CIRCLE_RADIUS = 14;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCircle(cx: number, cy: number, terrain: Terrain): [number, number][] {
  const rows = terrain.length,
    cols = terrain[0].length;
  const result: [number, number][] = [];
  for (let dy = -CIRCLE_RADIUS; dy <= CIRCLE_RADIUS; dy++) {
    for (let dx = -CIRCLE_RADIUS; dx <= CIRCLE_RADIUS; dx++) {
      if (dx * dx + dy * dy > CIRCLE_RADIUS * CIRCLE_RADIUS) continue;
      const col = cx + dx,
        row = cy + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      result.push([col, row]); // include stone tiles — nuclear destroys everything
    }
  }
  return result;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class NuclearManager {
  private entities: NuclearEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    this.entities.push({
      id: this.nextId++,
      phase: "fusing",
      tick: 0,
      centerX: cx,
      centerY: cy,
      cells: buildCircle(cx, cy, terrain),
    });
  }

  update(): void {
    for (const e of this.entities) {
      e.tick++;
      if (e.phase === "fusing" && e.tick >= FUSE_TICKS) {
        e.phase = "exploding";
        e.tick = 0;
      } else if (e.phase === "exploding" && e.tick >= TOTAL_EXPLODE_TICKS) {
        e.phase = "done";
      }
    }
    this.entities = this.entities.filter((e) => e.phase !== "done");
  }

  chainDetonate(fireCells: Set<string>, _terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase !== "fusing") continue;
      if (fireCells.has(`${e.centerX},${e.centerY}`)) {
        e.phase = "exploding";
        e.tick = 0;
      }
    }
  }

  getFireCells(): Set<string> {
    const out = new Set<string>();
    for (const e of this.entities) {
      if (e.phase !== "exploding") continue;
      // Fire active from the start; chain cutoff based on explosion frame
      const explodeFrame = Math.max(0, Math.floor((e.tick - FLASH_TICKS) / EXPLODE_TICKS_PER_FRAME));
      if (explodeFrame < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) out.add(`${c},${r}`);
      }
    }
    return out;
  }

  /** 1.0 = full white, 0.0 = no flash. Used by renderer for overlay. */
  getFlashIntensity(): number {
    for (const e of this.entities) {
      if (e.phase === "exploding" && e.tick < FLASH_TICKS) {
        return 1 - e.tick / FLASH_TICKS;
      }
    }
    return 0;
  }

  /** 1.0 = max shake, 0.0 = no shake. Decays over the entire explosion. */
  getShakeIntensity(): number {
    for (const e of this.entities) {
      if (e.phase === "exploding") {
        return 1 - e.tick / TOTAL_EXPLODE_TICKS;
      }
    }
    return 0;
  }

  fuseFrame(e: NuclearEntity): number {
    return Math.floor(e.tick / FUSE_TICKS_PER_FRAME) % FUSE_FRAME_COUNT;
  }

  explosionFrame(e: NuclearEntity): number {
    const t = Math.max(0, e.tick - FLASH_TICKS);
    return Math.min(Math.floor(t / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === "fusing" && e.centerX === col && e.centerY === row);
  }

  tryPush(col: number, row: number, dc: number, dr: number, terrain: Terrain): boolean {
    const e = this.entities.find(e => e.phase === "fusing" && e.centerX === col && e.centerY === row);
    if (!e) return true;
    const nc = col + dc, nr = row + dr;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.centerX = nc;
    e.centerY = nr;
    e.cells = buildCircle(nc, nr, terrain);
    return true;
  }

  getEntities(): NuclearEntity[] {
    return this.entities;
  }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
