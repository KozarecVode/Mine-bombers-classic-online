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
  armedCells: [number, number][];     // reachable ground tiles (for armed visual + collision)
  explosionCells: [number, number][]; // ground tiles + adjacent stone ring (for blast + terrain damage)
  blocked?: (col: number, row: number) => boolean; // stored for re-computation at arm time
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACED_TICKS         = 60 * 2;  // 2s showing plastic_1
const ARMED_TICKS          = 60 * 2;  // 2s showing plastic_2 before auto-explode
const EXPLODE_FRAME_COUNT  = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF   = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** BFS flood-fill on passable (non-stone) ground tiles, capped by maxTiles count. */
function buildGroundCells(
  cx: number, cy: number,
  maxTiles: number,
  terrain: Terrain,
  blocked?: (col: number, row: number) => boolean,
): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const result: [number, number][] = [];
  const visited = new Set<string>([`${cx},${cy}`]);
  const queue: [number, number][] = [[cx, cy]];

  while (queue.length > 0 && result.length < maxTiles) {
    const [c, r] = queue.shift()!;
    if (c <= 0 || c >= cols - 1 || r <= 0 || r >= rows - 1) continue;
    if (isStone(terrain, c, r)) continue;
    if (blocked?.(c, r)) continue;
    result.push([c, r]);
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const key = `${c + dc},${r + dr}`;
      if (!visited.has(key)) { visited.add(key); queue.push([c + dc, r + dr]); }
    }
  }
  return result;
}

/** Add the immediately adjacent diggable stone tiles (non-border) around a set of ground cells. */
function addStoneBorder(groundCells: [number, number][], terrain: Terrain): [number, number][] {
  const rows = terrain.length, cols = terrain[0].length;
  const result: [number, number][] = [...groundCells];
  const seen = new Set<string>(groundCells.map(([c, r]) => `${c},${r}`));
  for (const [c, r] of groundCells) {
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nc = c + dc, nr = r + dr;
      if (nr <= 0 || nr >= rows - 1 || nc <= 0 || nc >= cols - 1) continue;
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      if (!isStone(terrain, nc, nr)) continue;
      seen.add(key);
      result.push([nc, nr]);
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
      armedCells: [[cx, cy]],  // just the center tile during placed phase
      explosionCells: [],      // computed at arm time from armed area
      blocked,
    });
  }

  hasCellAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase !== "done" && e.armedCells.some(([c, r]) => c === col && r === row));
  }

  private arm(e: PlasticEntity, terrain: Terrain): void {
    e.phase = "armed";
    e.tick = 0;
    e.armedCells = buildGroundCells(e.centerX, e.centerY, 55, terrain, e.blocked);
    e.explosionCells = addStoneBorder(e.armedCells, terrain);
  }
  private explode(e: PlasticEntity): void { e.phase = "exploding"; e.tick = 0; }

  update(terrain: Terrain): void {
    for (const e of this.entities) {
      e.tick++;
      if      (e.phase === "placed"    && e.tick >= PLACED_TICKS)                         this.arm(e, terrain);
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

  getNetState(): Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }> {
    return this.entities.map(e => ({ id: e.id, phase: e.phase, armedCells: e.armedCells.slice() as [number, number][], explosionCells: e.explosionCells.slice() as [number, number][] }));
  }

  applyNetState(data: Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }>): void {
    const byId = new Map(this.entities.map(e => [e.id, e]));
    for (const d of data) {
      const e = byId.get(d.id);
      if (e) {
        e.phase = d.phase as PlasticPhase;
        e.armedCells = d.armedCells.slice() as [number, number][];
        e.explosionCells = d.explosionCells.slice() as [number, number][];
      }
    }
    const hostIds = new Set(data.map(d => d.id));
    this.entities = this.entities.filter(e => hostIds.has(e.id));
  }

  getEntities(): PlasticEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
    this.digHp = new Map();
  }
}
