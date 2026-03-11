import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type PlasticPhase = "placed" | "armed" | "exploding" | "done";

export interface PlasticEntity {
  id: number;
  phase: PlasticPhase;
  tick: number;
  centerX: number;
  centerY: number;
  armedCells: [number, number][];     // plastic_2 diamond (half=8)
  explosionCells: [number, number][]; // expanded diamond (half=10)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACED_TICKS         = 60 * 2;  // 2s showing plastic_1
const ARMED_TICKS          = 60 * 2;  // 2s showing plastic_2 before auto-explode
const EXPLODE_FRAME_COUNT  = 11;
const EXPLODE_TICKS_PER_FRAME = 2;
const CHAIN_FRAME_CUTOFF   = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDiamond(cx: number, cy: number, maxHalf: number, terrain: Terrain): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const result: [number, number][] = [];
  for (let dy = -maxHalf; dy <= maxHalf; dy++) {
    const half = maxHalf - Math.abs(dy);
    for (let dx = -half; dx <= half; dx++) {
      const col = cx + dx, row = cy + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row)) continue;
      result.push([col, row]);
    }
  }
  return result;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class PlasticManager {
  private entities: PlasticEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    this.entities.push({
      id: this.nextId++,
      phase: "placed",
      tick: 0,
      centerX: cx,
      centerY: cy,
      armedCells: buildDiamond(cx, cy, 8, terrain),
      explosionCells: buildDiamond(cx, cy, 10, terrain),
    });
  }

  private arm(e: PlasticEntity): void { e.phase = "armed"; e.tick = 0; }
  private explode(e: PlasticEntity): void { e.phase = "exploding"; e.tick = 0; }

  update(): void {
    for (const e of this.entities) {
      e.tick++;
      if      (e.phase === "placed"    && e.tick >= PLACED_TICKS)                         this.arm(e);
      else if (e.phase === "armed"     && e.tick >= ARMED_TICKS)                          this.explode(e);
      else if (e.phase === "exploding" && e.tick >= EXPLODE_FRAME_COUNT * EXPLODE_TICKS_PER_FRAME) e.phase = "done";
    }
    this.entities = this.entities.filter(e => e.phase !== "done");
  }

  chainDetonate(fireCells: Set<string>, _terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase !== "armed") continue;
      // Highly explosive: any fire touching armed cells triggers immediate explosion
      if (e.armedCells.some(([c, r]) => fireCells.has(`${c},${r}`))) this.explode(e);
    }
  }

  getFireCells(): Set<string> {
    const out = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === "exploding" && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.explosionCells) out.add(`${c},${r}`);
      }
    }
    return out;
  }

  hasSolidAt(col: number, row: number): boolean {
    for (const e of this.entities) {
      if (e.phase === "armed") {
        for (const [c, r] of e.armedCells) if (c === col && r === row) return true;
      }
    }
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean { return false; }

  explosionFrame(e: PlasticEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): PlasticEntity[] { return this.entities; }
}
