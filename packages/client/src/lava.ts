import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone, BASE_DIG_RATE } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LavaEntity {
  id: number;
  cellList: [number, number][];   // for renderer
  cells: Set<number>;             // fast lookup
  timers: Map<number, number>;    // cell key → ticks until next spread attempt
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SPREAD = 1;
const MAX_SPREAD = 140;

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ── Key helpers ───────────────────────────────────────────────────────────────

function key(col: number, row: number): number {
  return (col << 16) | row;
}

function keyCol(k: number): number { return k >> 16; }
function keyRow(k: number): number { return k & 0xffff; }

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class LavaManager {
  private entities: LavaEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    if (cx <= 0 || cx >= cols - 1 || cy <= 0 || cy >= rows - 1) return;
    if (isStone(terrain, cx, cy)) return;

    const k = key(cx, cy);
    const cells = new Set([k]);
    const timers = new Map([[k, rand(MIN_SPREAD, MAX_SPREAD)]]);
    this.entities.push({
      id: this.nextId++,
      cellList: [[cx, cy]],
      cells,
      timers,
    });
  }

  update(terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    const rows = terrain.length, cols = terrain[0].length;

    for (const e of this.entities) {
      // Iterate existing cells; collect new ones to add after
      const toAdd: [number, number][] = [];

      for (const [k, timer] of e.timers) {
        const newTimer = timer - 1;
        if (newTimer > 0) {
          e.timers.set(k, newTimer);
          continue;
        }

        // Timer fired — try all 4 directions in random order, spread to first passable
        const shuffled = DIRS.slice().sort(() => Math.random() - 0.5);
        for (const [dc, dr] of shuffled) {
          const nc = keyCol(k) + dc;
          const nr = keyRow(k) + dr;
          if (nc <= 0 || nc >= cols - 1 || nr <= 0 || nr >= rows - 1) continue;
          if (isStone(terrain, nc, nr) || isBlocked(nc, nr)) continue;
          const nk = key(nc, nr);
          if (!e.cells.has(nk)) {
            e.cells.add(nk);
            e.timers.set(nk, rand(MIN_SPREAD, MAX_SPREAD));
            toAdd.push([nc, nr]);
          }
          break;
        }

        // Reset this cell's timer
        e.timers.set(k, rand(MIN_SPREAD, MAX_SPREAD));
      }

      for (const cell of toAdd) e.cellList.push(cell);
    }
  }

  applyFire(fireCells: Set<string>, _terrain: Terrain, _isBlocked: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      for (const keyStr of fireCells) {
        const [c, r] = keyStr.split(",").map(Number);
        const k = key(c, r);
        if (!e.cells.has(k)) continue;
        e.cells.delete(k);
        e.timers.delete(k);
      }

      if (e.cells.size < e.cellList.length) {
        let write = 0;
        for (let i = 0; i < e.cellList.length; i++) {
          const [c, r] = e.cellList[i];
          if (e.cells.has(key(c, r))) e.cellList[write++] = e.cellList[i];
        }
        e.cellList.length = write;
      }
    }

    this.entities = this.entities.filter(e => e.cells.size > 0);
  }

  hasSolidAt(col: number, row: number): boolean {
    const k = key(col, row);
    return this.entities.some(e => e.cells.has(k));
  }

  private static readonly CELL_DIG_HP = BASE_DIG_RATE * 60 * 6;
  private digHp = new Map<number, number>();

  applyDigDamage(col: number, row: number, digPower: number): boolean {
    const k = key(col, row);
    if (!this.entities.some(e => e.cells.has(k))) return false;
    const hp = this.digHp.get(k) ?? LavaManager.CELL_DIG_HP;
    const next = hp - BASE_DIG_RATE * digPower;
    if (next <= 0) {
      this.digHp.delete(k);
      for (const e of this.entities) {
        if (e.cells.has(k)) {
          e.cells.delete(k);
          e.timers.delete(k);
          e.cellList = e.cellList.filter(([c, r]) => key(c, r) !== k);
          break;
        }
      }
      this.entities = this.entities.filter(e => e.cells.size > 0);
      return true;
    }
    this.digHp.set(k, next);
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean { return false; }
  getFireCells(): Set<string> { return new Set(); }
  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): LavaEntity[] { return this.entities; }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
    this.digHp = new Map();
  }

  /** Replace lava state from host snapshot (clients only). */
  applyNetState(lava: Array<{ id: number; cells: [number, number][] }>): void {
    this.entities = lava.map(ld => {
      const cells = new Set(ld.cells.map(([c, r]) => key(c, r)));
      return { id: ld.id, cellList: ld.cells.slice() as [number, number][], cells, timers: new Map() };
    });
  }
}
