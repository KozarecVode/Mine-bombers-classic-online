import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone, BASE_DIG_RATE } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LavaEntity {
  id: number;
  cellList: [number, number][];   // for renderer
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SPREAD = 1;
const MAX_SPREAD = 140;

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ── Key helpers ───────────────────────────────────────────────────────────────

function key(col: number, row: number): number { return (col << 16) | row; }
function keyCol(k: number): number { return k >> 16; }
function keyRow(k: number): number { return k & 0xffff; }
function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class LavaManager {
  private entityMap = new Map<number, LavaEntity>();
  private nextId = 0;

  /** All lava cell keys across all entities — O(1) membership test. */
  private allCells = new Set<number>();
  /**
   * Frontier: cells that have ≥1 free (in-bounds, non-stone, non-lava) neighbor.
   * Only these are checked each update tick. key → countdown timer.
   */
  private frontier = new Map<number, number>();
  /** Which entity owns each cell. */
  private cellOwner = new Map<number, number>();

  private static readonly CELL_DIG_HP = BASE_DIG_RATE * 60 * 6;
  private digHp = new Map<number, number>();

  // Cached from the most recent update/place call.
  private terrain: Terrain | null = null;
  private mapCols = 0;
  private mapRows = 0;

  // ── Private helpers ──────────────────────────────────────────────────────────

  private inBounds(c: number, r: number): boolean {
    return c > 0 && c < this.mapCols - 1 && r > 0 && r < this.mapRows - 1;
  }

  /** True if (c, r) is a valid spread target: in bounds, not stone, not already lava. */
  private isFree(c: number, r: number): boolean {
    if (!this.inBounds(c, r)) return false;
    if (this.terrain && isStone(this.terrain, c, r)) return false;
    return !this.allCells.has(key(c, r));
  }

  /** True if cell key k has at least one free neighbor. */
  private hasFreeNeighbor(k: number): boolean {
    const c = keyCol(k), r = keyRow(k);
    for (const [dc, dr] of DIRS) {
      if (this.isFree(c + dc, r + dr)) return true;
    }
    return false;
  }

  /**
   * Add a lava cell to allCells and update the frontier.
   * New cell enters frontier if it has a free neighbor.
   * Existing frontier neighbors are evicted if they are now fully surrounded.
   */
  private addLavaCell(c: number, r: number, entityId: number): void {
    const k = key(c, r);
    if (this.allCells.has(k)) return;
    this.allCells.add(k);
    this.cellOwner.set(k, entityId);
    this.entityMap.get(entityId)?.cellList.push([c, r]);

    if (this.hasFreeNeighbor(k)) {
      this.frontier.set(k, rand(MIN_SPREAD, MAX_SPREAD));
    }

    // A neighbor that was on the frontier might now be fully surrounded.
    for (const [dc, dr] of DIRS) {
      const nk = key(c + dc, r + dr);
      if (this.frontier.has(nk) && !this.hasFreeNeighbor(nk)) {
        this.frontier.delete(nk);
      }
    }
  }

  /**
   * Remove a lava cell from allCells, frontier, and cellOwner.
   * Lava neighbors that were interior are re-added to the frontier.
   * Does NOT update entityMap.cellList — caller is responsible.
   */
  private removeLavaCell(c: number, r: number): void {
    const k = key(c, r);
    this.allCells.delete(k);
    this.frontier.delete(k);
    this.cellOwner.delete(k);
    this.digHp.delete(k);

    // Neighbors that were interior (surrounded) now have a free slot.
    for (const [dc, dr] of DIRS) {
      const nk = key(c + dc, r + dr);
      if (this.allCells.has(nk) && !this.frontier.has(nk)) {
        this.frontier.set(nk, rand(MIN_SPREAD, MAX_SPREAD));
      }
    }
  }

  /** Rebuild a single entity's cellList in-place, removing deleted cells. */
  private compactCellList(entity: LavaEntity): void {
    let write = 0;
    for (let i = 0; i < entity.cellList.length; i++) {
      const [c, r] = entity.cellList[i];
      if (this.allCells.has(key(c, r))) entity.cellList[write++] = entity.cellList[i];
    }
    entity.cellList.length = write;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  place(playerX: number, playerY: number, terrain: Terrain): void {
    this.terrain = terrain;
    this.mapRows = terrain.length;
    this.mapCols = terrain[0].length;

    const cx = Math.round(playerX / TILE_SIZE);
    const cy = Math.round(playerY / TILE_SIZE);
    if (!this.inBounds(cx, cy) || isStone(terrain, cx, cy)) return;

    const id = this.nextId++;
    this.entityMap.set(id, { id, cellList: [] });
    this.addLavaCell(cx, cy, id);
  }

  update(terrain: Terrain, isBlocked: (col: number, row: number) => boolean): void {
    this.terrain = terrain;
    this.mapRows = terrain.length;
    this.mapCols = terrain[0].length;

    // Phase 1 — tick timers; collect spread targets without mutating frontier.
    const toSpread: Array<{ nc: number; nr: number; entityId: number }> = [];
    const fired: number[] = [];

    for (const [k, timer] of this.frontier) {
      if (timer > 1) {
        this.frontier.set(k, timer - 1);
        continue;
      }
      fired.push(k);

      const c = keyCol(k), r = keyRow(k);
      const entityId = this.cellOwner.get(k)!;

      const shuffled = DIRS.slice().sort(() => Math.random() - 0.5);
      for (const [dc, dr] of shuffled) {
        const nc = c + dc, nr = r + dr;
        if (!this.inBounds(nc, nr)) continue;
        if (isStone(terrain, nc, nr)) continue;
        const nk = key(nc, nr);
        if (this.allCells.has(nk) || isBlocked(nc, nr)) continue;
        toSpread.push({ nc, nr, entityId });
        break;
      }
    }

    // Phase 2 — apply spreads (may evict some fired keys from frontier).
    for (const { nc, nr, entityId } of toSpread) {
      this.addLavaCell(nc, nr, entityId);
    }

    // Phase 3 — reset or evict fired cells now that allCells is final.
    for (const k of fired) {
      if (!this.frontier.has(k)) continue; // already evicted in phase 2
      if (this.hasFreeNeighbor(k)) {
        this.frontier.set(k, rand(MIN_SPREAD, MAX_SPREAD));
      } else {
        this.frontier.delete(k);
      }
    }
  }

  applyFire(fireCells: Set<string>, terrain: Terrain, _isBlocked: (col: number, row: number) => boolean): void {
    this.terrain = terrain;
    this.mapRows = terrain.length;
    this.mapCols = terrain[0].length;

    const affectedEntities = new Set<number>();

    for (const keyStr of fireCells) {
      const comma = keyStr.indexOf(",");
      const c = +keyStr.slice(0, comma);
      const r = +keyStr.slice(comma + 1);
      const k = key(c, r);
      if (!this.allCells.has(k)) continue;
      affectedEntities.add(this.cellOwner.get(k)!);
      this.removeLavaCell(c, r);
    }

    for (const entityId of affectedEntities) {
      const entity = this.entityMap.get(entityId);
      if (!entity) continue;
      this.compactCellList(entity);
      if (entity.cellList.length === 0) this.entityMap.delete(entityId);
    }
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.allCells.has(key(col, row));
  }

  applyDigDamage(col: number, row: number, digPower: number): boolean {
    const k = key(col, row);
    if (!this.allCells.has(k)) return false;
    const hp = this.digHp.get(k) ?? LavaManager.CELL_DIG_HP;
    const next = hp - BASE_DIG_RATE * digPower;
    if (next <= 0) {
      const entityId = this.cellOwner.get(k)!;
      this.removeLavaCell(col, row);
      const entity = this.entityMap.get(entityId);
      if (entity) {
        this.compactCellList(entity);
        if (entity.cellList.length === 0) this.entityMap.delete(entityId);
      }
      return true;
    }
    this.digHp.set(k, next);
    return false;
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean { return false; }
  getFireCells(): Set<string> { return new Set(); }
  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): LavaEntity[] { return [...this.entityMap.values()]; }

  clear(): void {
    this.entityMap.clear();
    this.nextId = 0;
    this.allCells.clear();
    this.frontier.clear();
    this.cellOwner.clear();
    this.digHp.clear();
    this.terrain = null;
    this.mapCols = 0;
    this.mapRows = 0;
  }

  /** Replace lava state from host snapshot (clients only). Frontier is not rebuilt — clients render only. */
  applyNetState(lava: Array<{ id: number; cells: [number, number][] }>): void {
    this.clear();
    for (const ld of lava) {
      const cellList = ld.cells.slice() as [number, number][];
      this.entityMap.set(ld.id, { id: ld.id, cellList });
      for (const [c, r] of ld.cells) {
        const k = key(c, r);
        this.allCells.add(k);
        this.cellOwner.set(k, ld.id);
      }
      if (ld.id >= this.nextId) this.nextId = ld.id + 1;
    }
  }
}
