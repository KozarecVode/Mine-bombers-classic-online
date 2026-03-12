import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingCell {
  col: number;
  row: number;
  activateAt: number;
}

export interface LavaEntity {
  id: number;
  tick: number;
  cells: Set<string>;
  cellList: [number, number][];
  pending: PendingCell[];
  pendingKeys: Set<string>;
  blockedNeighbors: Set<string>; // adjacent tiles that were blocked; re-checked each tick
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SPREAD = 40;  // ~0.67s
const MAX_SPREAD = 120; // ~2s

const DIRS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

// ── Manager ───────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export class LavaManager {
  private entities: LavaEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    if (cx <= 0 || cx >= cols - 1 || cy <= 0 || cy >= rows - 1) return;
    if (isStone(terrain, cx, cy)) return;

    const cells = new Set<string>();
    cells.add(`${cx},${cy}`);
    const e: LavaEntity = {
      id: this.nextId++,
      tick: 0,
      cells,
      cellList: [[cx, cy]],
      pending: [],
      pendingKeys: new Set(),
      blockedNeighbors: new Set(),
    };
    this.scheduleNeighbors(e, cx, cy, terrain, () => false);
    this.entities.push(e);
  }

  private scheduleNeighbors(e: LavaEntity, col: number, row: number, terrain: Terrain, isBlocked: (c: number, r: number) => boolean): void {
    const rows = terrain.length, cols = terrain[0].length;
    for (const [dc, dr] of DIRS) {
      const nc = col + dc, nr = row + dr;
      if (nc <= 0 || nc >= cols - 1 || nr <= 0 || nr >= rows - 1) continue;
      if (isStone(terrain, nc, nr)) continue;
      const key = `${nc},${nr}`;
      if (e.cells.has(key) || e.pendingKeys.has(key)) continue;
      if (isBlocked(nc, nr)) {
        e.blockedNeighbors.add(key);
        continue;
      }
      e.blockedNeighbors.delete(key);
      e.pendingKeys.add(key);
      e.pending.push({ col: nc, row: nr, activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD) });
    }
  }

  update(terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      e.tick++;
      const stillPending: PendingCell[] = [];
      for (const p of e.pending) {
        if (p.activateAt <= e.tick) {
          const key = `${p.col},${p.row}`;
          e.pendingKeys.delete(key);
          if (!e.cells.has(key) && !isBlocked(p.col, p.row)) {
            e.cells.add(key);
            e.cellList.push([p.col, p.row]);
            this.scheduleNeighbors(e, p.col, p.row, terrain, isBlocked);
          }
        } else {
          stillPending.push(p);
        }
      }
      e.pending = stillPending;

      // Re-check tiles that were previously blocked — schedule them if now free
      const nowUnblocked: string[] = [];
      for (const key of e.blockedNeighbors) {
        if (e.cells.has(key) || e.pendingKeys.has(key)) { nowUnblocked.push(key); continue; }
        const [nc, nr] = key.split(',').map(Number);
        if (isBlocked(nc, nr)) continue;
        // Only schedule if still adjacent to an active lava cell
        let hasLavaNeighbor = false;
        for (const [dc, dr] of DIRS) {
          if (e.cells.has(`${nc + dc},${nr + dr}`)) { hasLavaNeighbor = true; break; }
        }
        nowUnblocked.push(key);
        if (hasLavaNeighbor) {
          e.pendingKeys.add(key);
          e.pending.push({ col: nc, row: nr, activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD) });
        }
      }
      for (const key of nowUnblocked) e.blockedNeighbors.delete(key);
    }
  }

  applyFire(fireCells: Set<string>, terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    for (const e of this.entities) {
      const cleared: [number, number][] = [];

      for (const key of fireCells) {
        if (e.cells.has(key)) {
          e.cells.delete(key);
          const [c, r] = key.split(',').map(Number);
          cleared.push([c, r]);
        }
        if (e.pendingKeys.has(key)) {
          e.pendingKeys.delete(key);
          // Don't lose this candidate — re-check it once fire clears
          e.blockedNeighbors.add(key);
        }
      }

      if (cleared.length === 0) continue;

      e.cellList = e.cellList.filter(([c, r]) => e.cells.has(`${c},${r}`));
      e.pending  = e.pending.filter(p => e.pendingKeys.has(`${p.col},${p.row}`));

      if (e.cells.size === 0) {
        e.pending = [];
        e.pendingKeys.clear();
        continue;
      }

      // Re-schedule cleared tiles from any adjacent surviving lava cell
      for (const [cc, cr] of cleared) {
        const key = `${cc},${cr}`;
        if (e.pendingKeys.has(key) || isStone(terrain, cc, cr)) continue;
        if (isBlocked(cc, cr)) { e.blockedNeighbors.add(key); continue; }
        for (const [dc, dr] of DIRS) {
          if (e.cells.has(`${cc + dc},${cr + dr}`)) {
            e.pendingKeys.add(key);
            e.pending.push({ col: cc, row: cr, activateAt: e.tick + rand(MIN_SPREAD, MAX_SPREAD) });
            break;
          }
        }
      }
    }
    this.entities = this.entities.filter(e => e.cells.size > 0 || e.pending.length > 0);
  }

  hasSolidAt(col: number, row: number): boolean {
    for (const e of this.entities) {
      if (e.cells.has(`${col},${row}`)) return true;
    }
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    return false;
  }

  getFireCells(): Set<string> { return new Set(); }
  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): LavaEntity[] { return this.entities; }
}
