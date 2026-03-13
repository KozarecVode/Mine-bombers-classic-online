import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone, BASE_DIG_RATE } from "./terrain.js";

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
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF   = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDiamond(cx: number, cy: number, maxHalf: number, terrain: Terrain, blocked?: (col: number, row: number) => boolean): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const result: [number, number][] = [];
  const visited = new Set<string>();
  const queue: [number, number][] = [[cx, cy]];
  visited.add(`${cx},${cy}`);

  while (queue.length > 0) {
    const [c, r] = queue.shift()!;

    // Skip out-of-bounds, boundary, stone, or blocked — these stop expansion
    if (c <= 0 || c >= cols - 1 || r <= 0 || r >= rows - 1) continue;
    if (isStone(terrain, c, r)) continue;
    if (blocked?.(c, r)) continue;

    result.push([c, r]);

    const dist = Math.abs(c - cx) + Math.abs(r - cy);
    if (dist >= maxHalf) continue;

    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const key = `${c + dc},${r + dr}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([c + dc, r + dr]);
      }
    }
  }
  return result;
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class PlasticManager {
  private entities: PlasticEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain, blocked?: (col: number, row: number) => boolean): void {
    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    this.entities.push({
      id: this.nextId++,
      phase: "placed",
      tick: 0,
      centerX: cx,
      centerY: cy,
      armedCells: buildDiamond(cx, cy, 8, terrain, blocked),
      explosionCells: buildDiamond(cx, cy, 10, terrain, blocked),
    });
  }

  hasCellAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase !== "done" && e.armedCells.some(([c, r]) => c === col && r === row));
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

  private static readonly CELL_DIG_HP = BASE_DIG_RATE * 60 * 2; // ~2 s at digPower=1
  private digHp = new Map<string, number>();

  /** Dig into an armed plastic cell. Returns true when the cell is fully dug through. */
  applyDigDamage(col: number, row: number, digPower: number): boolean {
    if (!this.hasSolidAt(col, row)) return false;
    const k = `${col},${row}`;
    const hp = this.digHp.get(k) ?? PlasticManager.CELL_DIG_HP;
    const next = hp - BASE_DIG_RATE * digPower;
    if (next <= 0) {
      this.digHp.delete(k);
      for (const e of this.entities) {
        if (e.phase === 'armed')
          e.armedCells = e.armedCells.filter(([c, r]) => !(c === col && r === row));
      }
      return true;
    }
    this.digHp.set(k, next);
    return false;
  }

  explosionFrame(e: PlasticEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): PlasticEntity[] { return this.entities; }
}
