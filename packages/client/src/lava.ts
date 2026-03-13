import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone, BASE_DIG_RATE } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingCell {
  col: number;
  row: number;
  activateAt: number;
}

export interface LavaEntity {
  id: number;
  tick: number;

  cells: Set<number>;
  cellList: [number, number][];

  pending: PendingCell[];
  pendingKeys: Set<number>;

  blockedNeighbors: Set<number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SPREAD = 40;
const MAX_SPREAD = 120;

const DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// ── Key helpers ───────────────────────────────────────────────────────────────

function key(col: number, row: number): number {
  return (col << 16) | row;
}

function keyCol(k: number): number {
  return k >> 16;
}

function keyRow(k: number): number {
  return k & 0xffff;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

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

    const rows = terrain.length;
    const cols = terrain[0].length;

    if (cx <= 0 || cx >= cols - 1 || cy <= 0 || cy >= rows - 1) return;
    if (isStone(terrain, cx, cy)) return;

    const k = key(cx, cy);

    const e: LavaEntity = {
      id: this.nextId++,
      tick: 0,
      cells: new Set([k]),
      cellList: [[cx, cy]],
      pending: [],
      pendingKeys: new Set(),
      blockedNeighbors: new Set(),
    };

    this.scheduleNeighbors(e, cx, cy, terrain, () => false);
    this.entities.push(e);
  }

  private scheduleNeighbors(e: LavaEntity, col: number, row: number, terrain: Terrain, isBlocked: (c: number, r: number) => boolean): void {
    const rows = terrain.length;
    const cols = terrain[0].length;

    for (const [dc, dr] of DIRS) {
      const nc = col + dc;
      const nr = row + dr;

      if (nc <= 0 || nc >= cols - 1 || nr <= 0 || nr >= rows - 1) continue;
      if (isStone(terrain, nc, nr)) continue;

      const k = key(nc, nr);

      if (e.cells.has(k) || e.pendingKeys.has(k)) continue;

      if (isBlocked(nc, nr)) {
        e.blockedNeighbors.add(k);
        continue;
      }

      e.blockedNeighbors.delete(k);

      e.pendingKeys.add(k);
      e.pending.push({
        col: nc,
        row: nr,
        activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD),
      });
    }
  }

  update(terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      e.tick++;

      // process pending without allocating new arrays
      let write = 0;

      for (let i = 0; i < e.pending.length; i++) {
        const p = e.pending[i];

        if (p.activateAt <= e.tick) {
          const k = key(p.col, p.row);

          e.pendingKeys.delete(k);

          if (!e.cells.has(k) && !isBlocked(p.col, p.row)) {
            e.cells.add(k);
            e.cellList.push([p.col, p.row]);

            this.scheduleNeighbors(e, p.col, p.row, terrain, isBlocked);
          }
        } else {
          e.pending[write++] = p;
        }
      }

      e.pending.length = write;

      // re-check blocked neighbors
      const toRemove: number[] = [];

      for (const k of e.blockedNeighbors) {
        if (e.cells.has(k) || e.pendingKeys.has(k)) {
          toRemove.push(k);
          continue;
        }

        const nc = keyCol(k);
        const nr = keyRow(k);

        if (isBlocked(nc, nr)) continue;

        let hasLavaNeighbor = false;

        for (const [dc, dr] of DIRS) {
          if (e.cells.has(key(nc + dc, nr + dr))) {
            hasLavaNeighbor = true;
            break;
          }
        }

        toRemove.push(k);

        if (hasLavaNeighbor) {
          e.pendingKeys.add(k);
          e.pending.push({
            col: nc,
            row: nr,
            activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD),
          });
        }
      }

      for (const k of toRemove) e.blockedNeighbors.delete(k);
    }
  }

  applyFire(fireCells: Set<string>, terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      const cleared: [number, number][] = [];

      for (const keyStr of fireCells) {
        const [c, r] = keyStr.split(",").map(Number);
        const k = key(c, r);

        if (e.cells.has(k)) {
          e.cells.delete(k);
          cleared.push([c, r]);
        }

        if (e.pendingKeys.has(k)) {
          e.pendingKeys.delete(k);
          e.blockedNeighbors.add(k);
        }
      }

      if (cleared.length === 0) continue;

      // rebuild cellList
      let write = 0;
      for (let i = 0; i < e.cellList.length; i++) {
        const [c, r] = e.cellList[i];
        if (e.cells.has(key(c, r))) {
          e.cellList[write++] = e.cellList[i];
        }
      }
      e.cellList.length = write;

      // clean pending
      write = 0;
      for (let i = 0; i < e.pending.length; i++) {
        const p = e.pending[i];
        if (e.pendingKeys.has(key(p.col, p.row))) {
          e.pending[write++] = p;
        }
      }
      e.pending.length = write;

      if (e.cells.size === 0) {
        e.pending = [];
        e.pendingKeys.clear();
        continue;
      }

      // reschedule cleared tiles
      for (const [cc, cr] of cleared) {
        const k = key(cc, cr);

        if (e.pendingKeys.has(k) || isStone(terrain, cc, cr)) continue;

        if (isBlocked(cc, cr)) {
          e.blockedNeighbors.add(k);
          continue;
        }

        for (const [dc, dr] of DIRS) {
          if (e.cells.has(key(cc + dc, cr + dr))) {
            e.pendingKeys.add(k);
            e.pending.push({
              col: cc,
              row: cr,
              activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD),
            });
            break;
          }
        }
      }
    }

    this.entities = this.entities.filter((e) => e.cells.size > 0 || e.pending.length > 0);
  }

  hasSolidAt(col: number, row: number): boolean {
    const k = key(col, row);

    for (const e of this.entities) {
      if (e.cells.has(k)) return true;
    }

    return false;
  }

  private static readonly CELL_DIG_HP = BASE_DIG_RATE * 60 * 6; // ~6 s at digPower=1
  private digHp = new Map<number, number>();

  /** Dig into a lava cell. Returns true when the cell is fully dug through. */
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
          e.cellList = e.cellList.filter(([c, r]) => key(c, r) !== k);
          break;
        }
      }
      this.entities = this.entities.filter(e => e.cells.size > 0 || e.pending.length > 0);
      return true;
    }
    this.digHp.set(k, next);
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    return false;
  }

  getFireCells(): Set<string> {
    return new Set();
  }

  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): LavaEntity[] {
    return this.entities;
  }
}
