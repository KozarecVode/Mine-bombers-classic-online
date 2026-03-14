import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";
import { Dir } from "./game.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type GrenadePhase = "flying" | "exploding" | "done";

export interface GrenadeEntity {
  id: number;
  tileX: number;
  tileY: number;
  dir: "up" | "down" | "left" | "right";
  phase: GrenadePhase;
  tick: number;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TILES_PER_TICK = 1.5;
const EXPLODE_FRAME_COUNT = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF = 6;

// Simple cross:  .x. / xxx / .x.
const CROSS_OFFSETS: [number, number][] = [
  [0, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [0, 1],
];

// ── Manager ──────────────────────────────────────────────────────────────────

type SolidChecker = { hasSolidAt: (col: number, row: number) => boolean };

export class GrenadeManager {
  private entities: GrenadeEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, dir: Dir, terrain: Terrain): void {
    if (dir === "none") return;
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    this.placeAt(tileX, tileY, dir, terrain);
  }

  placeAt(tileX: number, tileY: number, dir: Exclude<Dir, "none">, terrain: Terrain): void {
    const [dc, dr] = dirDelta(dir);
    const startX = tileX + dc;
    const startY = tileY + dr;
    // If wall is immediately in front, explode at player's tile right away
    const wallAhead = isStone(terrain, startX, startY);
    const e: GrenadeEntity = {
      id: this.nextId++,
      tileX: wallAhead ? tileX : startX,
      tileY: wallAhead ? tileY : startY,
      dir,
      phase: "flying",
      tick: 0,
      cells: [],
    };
    this.entities.push(e);
    if (wallAhead) this.triggerExplosion(e, terrain);
  }

  update(terrain: Terrain, solidCheckers: SolidChecker[] = [], playerOccupied: (col: number, row: number) => boolean = () => false): void {
    for (const e of this.entities) {
      e.tick++;
      if (e.phase === "flying") {
        // If the grenade was placed onto a solid tile (e.g. burning urethane), explode immediately
        if (solidCheckers.some((s) => s.hasSolidAt(e.tileX, e.tileY))) {
          this.triggerExplosion(e, terrain);
          continue;
        }
        const [dc, dr] = dirDelta(e.dir);
        for (let i = 0; i < TILES_PER_TICK && e.phase === "flying"; i++) {
          const nc = e.tileX + dc,
            nr = e.tileY + dr;
          if (isStone(terrain, nc, nr) || solidCheckers.some((s) => s.hasSolidAt(nc, nr)) || playerOccupied(nc, nr)) {
            this.triggerExplosion(e, terrain);
          } else {
            e.tileX = nc;
            e.tileY = nr;
          }
        }
      } else if (e.phase === "exploding" && e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = "done";
      }
    }
    this.entities = this.entities.filter((e) => e.phase !== "done");
  }

  private triggerExplosion(e: GrenadeEntity, terrain: Terrain): void {
    e.phase = "exploding";
    e.tick = 0;
    const visual: [number, number][] = [];
    for (const [col, row] of this.computeCells(e.tileX, e.tileY, terrain)) {
      visual.push([col, row]);
    }
    e.cells = visual;
  }

  private computeCells(tileX: number, tileY: number, terrain: Terrain): [number, number][] {
    const rows = terrain.length,
      cols = terrain[0].length;
    return CROSS_OFFSETS.map(([dx, dy]) => [tileX + dx, tileY + dy] as [number, number]).filter(([c, r]) => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      return !(r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
    });
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

  chainDetonate(cells: Set<string>, terrain: Terrain): void {}

  /** Grenades are flying — never a solid obstacle for players or other weapons. */
  hasSolidAt(_col: number, _row: number): boolean {
    return false;
  }

  explosionFrame(e: GrenadeEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): GrenadeEntity[] {
    return this.entities;
  }
}

function dirDelta(dir: "up" | "down" | "left" | "right"): [number, number] {
  switch (dir) {
    case "right":
      return [1, 0];
    case "left":
      return [-1, 0];
    case "down":
      return [0, 1];
    case "up":
      return [0, -1];
  }
}
