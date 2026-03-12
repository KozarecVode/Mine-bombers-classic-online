import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WallEntity {
  col: number;
  row: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class WallManager {
  private walls: WallEntity[] = [];
  private wallKeys = new Set<string>();

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length,
      cols = terrain[0].length;
    if (col <= 0 || col >= cols - 1 || row <= 0 || row >= rows - 1) return;
    if (isStone(terrain, col, row)) return;
    const key = `${col},${row}`;
    if (this.wallKeys.has(key)) return;
    terrain[row][col] = true;
    this.wallKeys.add(key);
    this.walls.push({ col, row });
  }

  /** Remove any wall tiles whose terrain has been cleared by an explosion. */
  applyFire(_fireCells: Set<string>, _terrain: Terrain): void {
    // this.walls = this.walls.filter(w => {
    //   if (!_terrain[w.row][w.col]) {
    //     this.wallKeys.delete(`${w.col},${w.row}`);
    //     return false;
    //   }
    //   return true;
    // });
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.wallKeys.has(`${col},${row}`);
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    return false;
  }

  getFireCells(): Set<string> {
    return new Set();
  }
  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  /** Re-stamp wall tiles in terrain after explosions may have cleared them. */
  restoreTerrain(terrain: Terrain): void {
    for (const w of this.walls) terrain[w.row][w.col] = true;
  }

  getEntities(): WallEntity[] {
    return this.walls;
  }
}
