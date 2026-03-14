import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export const TREASURE_NAMES = ["bar", "bracelet", "cross", "crown", "diamond", "egg", "mushroom", "ring", "scepter", "shield"] as const;

export type TreasureType = (typeof TREASURE_NAMES)[number];

const TREASURE_VALUES: Record<TreasureType, number> = {
  crown: 100,
  ring: 65,
  scepter: 50,
  cross: 35,
  egg: 25,
  bar: 20,
  mushroom: 15,
  shield: 15,
  bracelet: 10,
  diamond: 500,
};

export interface TreasureEntity {
  id: number;
  col: number;
  row: number;
  type: TreasureType;
  value: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class TreasureManager {
  private entities: TreasureEntity[] = [];
  private nextId = 0;
  lastRemovedIds: number[] = [];

  place(playerX: number, playerY: number, terrain: Terrain, type?: TreasureType): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);

    if (isStone(terrain, col, row)) return;
    if (this.entities.some((e) => e.col === col && e.row === row)) return;

    const resolvedType = type ?? TREASURE_NAMES[Math.floor(Math.random() * TREASURE_NAMES.length)];
    this.entities.push({ id: this.nextId++, col, row, type: resolvedType, value: TREASURE_VALUES[resolvedType] });
  }

  /** Call each tick. Returns cash gained from any treasure the player walked over. */
  update(playerTileX: number, playerTileY: number): number {
    let gained = 0;
    let write = 0;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.col === playerTileX && e.row === playerTileY) {
        gained += e.value;
        this.lastRemovedIds.push(e.id);
      } else {
        this.entities[write++] = e;
      }
    }

    this.entities.length = write;
    return gained;
  }

  /** Remove any treasure at the given tile and return its value (0 if none). */
  collectAt(col: number, row: number): number {
    let gained = 0;
    let write = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.col === col && e.row === row) { gained += e.value; this.lastRemovedIds.push(e.id); }
      else { this.entities[write++] = e; }
    }
    this.entities.length = write;
    return gained;
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.entities.some((e) => e.col === col && e.row === row);
  }

  applyFire(fireCells: Set<string>): void {
    let write = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!fireCells.has(`${e.col},${e.row}`)) {
        this.entities[write++] = e;
      } else {
        this.lastRemovedIds.push(e.id);
      }
    }
    this.entities.length = write;
  }

  removeById(ids: number[]): void {
    if (ids.length === 0) return;
    const set = new Set(ids);
    this.entities = this.entities.filter(e => !set.has(e.id));
  }

  getEntities(): TreasureEntity[] {
    return this.entities;
  }
}
