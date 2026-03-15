import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone, BASE_DIG_RATE } from "./terrain.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type UrethanePhase = "placed" | "burning" | "done";

export interface UrethaneEntity {
  id: number;
  phase: UrethanePhase;
  tick: number;
  centerX: number;          // tile where urethane_1 is shown
  centerY: number;
  cells: [number, number][]; // full diamond — revealed only when burning
}

export interface UrethaneFire {
  col: number;
  row: number;
  tick: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS = 60 * 1.5; // 1.5 seconds before auto-expanding
const FIRE_FRAME_COUNT = 11;
const FIRE_TICKS_PER_FRAME = 2;

// ── Pattern ───────────────────────────────────────────────────────────────────
//
// Diamond: center row 11 wide, each level ±1 loses 2 tiles, 5 levels up/down.

function buildPattern(): [number, number][] {
  const result: [number, number][] = [];
  for (let dy = -5; dy <= 5; dy++) {
    const half = 5 - Math.abs(dy);
    for (let dx = -half; dx <= half; dx++) {
      result.push([dx, dy]);
    }
  }
  return result;
}

const PATTERN = buildPattern();

// ── Manager ──────────────────────────────────────────────────────────────────

export class UrethaneManager {
  private entities: UrethaneEntity[] = [];
  private fires: UrethaneFire[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain, blocked?: (col: number, row: number) => boolean): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    const MAX_HALF = 5;

    // BFS flood-fill: terrain tiles stop expansion entirely (not just skip)
    const cells: [number, number][] = [];
    const visited = new Set<string>();
    visited.add(`${tileX},${tileY}`);
    const queue: [number, number][] = [[tileX, tileY]];

    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      if (c <= 0 || c >= cols - 1 || r <= 0 || r >= rows - 1) continue;
      if (isStone(terrain, c, r)) continue;
      if (blocked?.(c, r)) continue;
      cells.push([c, r]);
      if (Math.abs(c - tileX) + Math.abs(r - tileY) >= MAX_HALF) continue;
      for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
        const key = `${c+dc},${r+dr}`;
        if (!visited.has(key)) { visited.add(key); queue.push([c+dc, r+dr]); }
      }
    }

    this.entities.push({ id: this.nextId++, phase: "placed", tick: 0, centerX: tileX, centerY: tileY, cells });
  }

  hasCellAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase !== "done" && e.cells.some(([c, r]) => c === col && r === row));
  }

  /** Place a single urethane tile from a level file — no spread, no fuse, just draws urethane_2.png at that tile. */
  placeTile(tileX: number, tileY: number): void {
    this.entities.push({ id: this.nextId++, phase: "burning", tick: 0, centerX: tileX, centerY: tileY, cells: [[tileX, tileY]] });
  }

  private _justSpread = false;

  private ignite(e: UrethaneEntity): void {
    e.phase = "burning";
    e.tick = 0;
    this._justSpread = true;
  }

  justSpread(): boolean {
    const v = this._justSpread;
    this._justSpread = false;
    return v;
  }

  private addFireAt(col: number, row: number): void {
    this.fires.push({ col, row, tick: 0 });
  }

  update(): void {
    for (const e of this.entities) {
      e.tick++;
      if (e.phase === "placed" && e.tick >= FUSE_TICKS) {
        this.ignite(e);
      }
    }
    this.entities = this.entities.filter(e => e.phase !== "done");
    for (const f of this.fires) f.tick++;
    this.fires = this.fires.filter(f => f.tick < FIRE_FRAME_COUNT * FIRE_TICKS_PER_FRAME);
  }

  chainDetonate(fireCells: Set<string>, _terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.isStatic) continue;
      if (e.phase === "placed") {
        // Any fire on center tile ignites early
        if (fireCells.has(`${e.centerX},${e.centerY}`)) this.ignite(e);
      } else if (e.phase === "burning") {
        // Fire destroys burning urethane cells — record explosion positions
        const remaining: [number, number][] = [];
        for (const [col, row] of e.cells) {
          if (fireCells.has(`${col},${row}`)) {
            this.addFireAt(col, row);
          } else {
            remaining.push([col, row]);
          }
        }
        e.cells = remaining;
        if (e.cells.length === 0) e.phase = "done";
      }
    }
  }

  getFireCells(): Set<string> {
    return new Set();
  }

  hasSolidAt(col: number, row: number): boolean {
    for (const e of this.entities) {
      if (e.phase === "burning" && !e.isStatic) {
        for (const [c, r] of e.cells) if (c === col && r === row) return true;
      }
    }
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean { return false; }

  /**
   * Flamebomb/flamethrower fire hitting burning urethane spreads inward via BFS,
   * weakening over distance. Reached cells are destroyed and converted to fire.
   */
  spreadFireThrough(flameFire: Set<string>, allFire: Set<string>): void {
    const SPREAD_DEPTH = 4;
    for (const e of this.entities) {
      if (e.phase !== "burning" || e.isStatic) continue;

      const cellSet = new Set(e.cells.map(([c, r]) => `${c},${r}`));
      const toDestroy = new Set<string>();

      // Seed: urethane cells directly touched by flame fire
      let frontier: [number, number][] = [];
      for (const [c, r] of e.cells) {
        if (flameFire.has(`${c},${r}`)) {
          toDestroy.add(`${c},${r}`);
          frontier.push([c, r]);
        }
      }
      if (frontier.length === 0) continue;

      // BFS spread — weakens over each tile step
      for (let depth = 1; depth <= SPREAD_DEPTH && frontier.length > 0; depth++) {
        const next: [number, number][] = [];
        for (const [c, r] of frontier) {
          for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
            const key = `${c+dc},${r+dr}`;
            if (cellSet.has(key) && !toDestroy.has(key)) {
              toDestroy.add(key);
              next.push([c+dc, r+dr]);
            }
          }
        }
        frontier = next;
      }

      // Convert destroyed cells to fire, record explosions, and remove from entity
      for (const [c, r] of e.cells) {
        if (toDestroy.has(`${c},${r}`)) {
          allFire.add(`${c},${r}`);
          this.addFireAt(c, r);
        }
      }
      e.cells = e.cells.filter(([c, r]) => !toDestroy.has(`${c},${r}`));
      if (e.cells.length === 0) e.phase = "done";
    }
  }

  private static readonly CELL_DIG_HP = BASE_DIG_RATE * 60 * 4; // ~4 s at digPower=1
  private digHp = new Map<string, number>();

  /** Dig into a burning urethane cell. Returns true when the cell is fully dug through. */
  applyDigDamage(col: number, row: number, digPower: number): boolean {
    if (!this.hasSolidAt(col, row)) return false;
    const k = `${col},${row}`;
    const hp = this.digHp.get(k) ?? UrethaneManager.CELL_DIG_HP;
    const next = hp - BASE_DIG_RATE * digPower;
    if (next <= 0) {
      this.digHp.delete(k);
      for (const e of this.entities) {
        e.cells = e.cells.filter(([c, r]) => !(c === col && r === row));
        if (e.cells.length === 0 && e.phase === 'burning') e.phase = 'done';
      }
      return true;
    }
    this.digHp.set(k, next);
    return false;
  }

  fireFrame(f: UrethaneFire): number {
    return Math.min(Math.floor(f.tick / FIRE_TICKS_PER_FRAME), FIRE_FRAME_COUNT - 1);
  }

  getNetState(): Array<{ id: number; phase: string; cells: [number, number][] }> {
    return this.entities.map(e => ({ id: e.id, phase: e.phase, cells: e.cells.slice() as [number, number][] }));
  }

  applyNetState(data: Array<{ id: number; phase: string; cells: [number, number][] }>): void {
    const byId = new Map(this.entities.map(e => [e.id, e]));
    for (const d of data) {
      const e = byId.get(d.id);
      if (e) {
        e.phase = d.phase as UrethanePhase;
        e.cells = d.cells.slice() as [number, number][];
      }
    }
    // Remove entities not in the host state
    const hostIds = new Set(data.map(d => d.id));
    this.entities = this.entities.filter(e => hostIds.has(e.id));
  }

  getEntities(): UrethaneEntity[] { return this.entities; }
  getFires(): UrethaneFire[] { return this.fires; }

  clear(): void {
    this.entities = [];
    this.fires = [];
    this.nextId = 0;
    this.digHp = new Map();
  }
}
