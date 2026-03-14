import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, TerrainDetailMap, isStone, setTerrainTile } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiggerBombPhase = "fusing" | "exploding" | "done";

export interface DiggerBombEntity {
  id: number;
  tileX: number;
  tileY: number;
  phase: DiggerBombPhase;
  tick: number;
  grace: boolean;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUSE_TICKS           = 120; // 2 seconds at 60 fps
const EXPLODE_FRAME_COUNT  = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF   = 6;
const CHAIN_LENGTH         = 10; // max tiles destroyed in each direction
const MARGIN = 1;
const HB     = 12;

// ── Manager ───────────────────────────────────────────────────────────────────

export class DiggerBombManager {
  private entities: DiggerBombEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some(e => e.tileX === tileX && e.tileY === tileY)) return;
    this.entities.push({ id: this.nextId++, tileX, tileY, phase: "fusing", tick: 0, grace: true, cells: [] });
  }

  update(playerX: number, playerY: number, terrain: Terrain, detailMap: TerrainDetailMap): boolean {
    const pl = playerX + MARGIN, pr = playerX + MARGIN + HB;
    const pt = playerY + MARGIN, pb = playerY + MARGIN + HB;
    let terrainChanged = false;

    for (const e of this.entities) {
      e.tick++;
      if (e.grace) {
        const tx = e.tileX * TILE_SIZE, ty = e.tileY * TILE_SIZE;
        if (!(pl < tx + TILE_SIZE && pr > tx && pt < ty + TILE_SIZE && pb > ty)) e.grace = false;
      }
      if (e.phase === "fusing" && e.tick >= FUSE_TICKS) {
        e.phase = "exploding";
        e.tick = 0;
        if (this.applyExplosion(e, terrain, detailMap)) terrainChanged = true;
      } else if (e.phase === "exploding" && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = "done";
      }
    }
    this.entities = this.entities.filter(e => e.phase !== "done");
    return terrainChanged;
  }

  private applyExplosion(e: DiggerBombEntity, terrain: Terrain, detailMap: TerrainDetailMap): boolean {
    const rows = terrain.length, cols = terrain[0].length;
    const col = e.tileX, row = e.tileY;
    if (row <= 0 || row >= rows - 1 || col <= 0 || col >= cols - 1) { e.cells = []; return false; }

    e.cells = [[col, row]];
    let terrainChanged = false;

    // BFS flood-fill: destroy all connected solid_rock tiles within range
    const visited = new Set<string>([`${col},${row}`]);
    const queue: [number, number][] = [[col, row]];
    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      const neighbors: [number, number][] = [[c+1,r],[c-1,r],[c,r+1],[c,r-1]];
      for (const [nc, nr] of neighbors) {
        const key = `${nc},${nr}`;
        if (visited.has(key)) continue;
        if (nr <= 0 || nr >= rows - 1 || nc <= 0 || nc >= cols - 1) continue;
        if (Math.abs(nc - col) + Math.abs(nr - row) > CHAIN_LENGTH) continue;
        visited.add(key);
        const t = detailMap[nr][nc].type;
        if (!t.startsWith("solid_rock") && !t.startsWith("rock_")) continue;
        setTerrainTile(detailMap, terrain, nc, nr, "ground");
        e.cells.push([nc, nr]);
        queue.push([nc, nr]);
        terrainChanged = true;
      }
    }
    return terrainChanged;
  }

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const e of this.entities) {
      if (e.phase === "exploding" && Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME) < CHAIN_FRAME_CUTOFF) {
        for (const [c, r] of e.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  chainDetonate(fireCells: Set<string>, terrain: Terrain, detailMap: TerrainDetailMap): boolean {
    let terrainChanged = false;
    for (const e of this.entities) {
      if (e.phase === "fusing" && fireCells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "exploding";
        e.tick = 0;
        if (this.applyExplosion(e, terrain, detailMap)) terrainChanged = true;
      }
    }
    return terrainChanged;
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some(e => e.phase === "fusing" && !e.grace && e.tileX === col && e.tileY === row);
  }

  tryPush(col: number, row: number, dcol: number, drow: number, terrain: Terrain): boolean {
    const e = this.entities.find(e => e.phase === "fusing" && e.tileX === col && e.tileY === row);
    if (!e) return true;
    const nc = col + dcol, nr = row + drow;
    if (isStone(terrain, nc, nr)) return false;
    if (this.hasSolidAt(nc, nr)) return false;
    e.tileX = nc; e.tileY = nr;
    return true;
  }

  explosionFrame(e: DiggerBombEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): DiggerBombEntity[] { return this.entities; }
}
