import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export const PICKABLE_TYPES = [
  "dig_power_1",
  "dig_power_2",
  "dig_power_3",
  "random_weapon",
  "medpac",
] as const;

export type PickableType = (typeof PICKABLE_TYPES)[number];

export interface PickableEntity {
  id: number;
  col: number;
  row: number;
  type: PickableType;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class PickableManager {
  private entities: PickableEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain, type: PickableType): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);

    if (isStone(terrain, col, row)) return;
    if (this.entities.some((e) => e.col === col && e.row === row)) return;

    this.entities.push({ id: this.nextId++, col, row, type });
  }

  /** Returns types of all pickables collected this tick. */
  update(playerTileX: number, playerTileY: number): PickableType[] {
    const collected: PickableType[] = [];
    let write = 0;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.col === playerTileX && e.row === playerTileY) {
        collected.push(e.type);
      } else {
        this.entities[write++] = e;
      }
    }

    this.entities.length = write;
    return collected;
  }

  /** Remove any pickables occupied by monsters (no effect applied). */
  consumeByMonsters(positions: { tileX: number; tileY: number }[]): void {
    const occupied = new Set(positions.map(p => `${p.tileX},${p.tileY}`));
    let write = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!occupied.has(`${e.col},${e.row}`)) {
        this.entities[write++] = e;
      }
    }
    this.entities.length = write;
  }

  applyFire(fireCells: Set<string>): void {
    let write = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!fireCells.has(`${e.col},${e.row}`)) {
        this.entities[write++] = e;
      }
    }
    this.entities.length = write;
  }

  getEntities(): PickableEntity[] {
    return this.entities;
  }
}
