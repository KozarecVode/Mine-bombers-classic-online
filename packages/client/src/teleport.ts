import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeleportPhase = "placed" | "exploding" | "done";

export interface TeleportEntity {
  id: number;
  col: number;
  row: number;
  phase: TeleportPhase;
  tick: number;
  cells: [number, number][];
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Circle of radius 2 (dx² + dy² ≤ 4)
const EXPLODE_PATTERN: [number, number][] = [
  [-2, 0],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -2],
  [0, -1],
  [0, 0],
  [0, 1],
  [0, 2],
  [1, -1],
  [1, 0],
  [1, 1],
  [2, 0],
];

const EXPLODE_FRAME_COUNT = 11;
const EXPLODE_TICKS_PER_FRAME = 1;
const CHAIN_FRAME_CUTOFF = 6; // fire cells active for first 6 of 11 frames

// ── Manager ───────────────────────────────────────────────────────────────────

export class TeleportManager {
  private entities: TeleportEntity[] = [];
  private nextId = 0;
  private cooldown = 0; // shared cooldown (single-player)

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, col, row)) return;
    if (this.entities.some((e) => e.col === col && e.row === row && e.phase === "placed")) return;
    this.entities.push({ id: this.nextId++, col, row, phase: "placed", tick: 0, cells: [] });
  }

  /**
   * Call each frame after updatePlayer.
   * If the player is standing on a placed teleport and there is at least one
   * other placed teleport, snap the player to a random other one.
   * Returns true if a teleport occurred (caller should update player coords).
   */
  tryTeleport(tileX: number, tileY: number): [number, number] | null {
    const placed = this.entities.filter((e) => e.phase === "placed");
    const src = placed.find((e) => e.col === tileX && e.row === tileY);
    if (!src) return null;

    const others = placed.filter((e) => e.id !== src.id);
    if (others.length === 0) return null;

    const dest = others[Math.floor(Math.random() * others.length)];
    return [dest.col, dest.row];
  }

  update(terrain: Terrain): void {
    if (this.cooldown > 0) this.cooldown--;

    for (const e of this.entities) {
      if (e.phase !== "exploding") continue;
      e.tick++;
      if (e.tick >= EXPLODE_TICKS_PER_FRAME * EXPLODE_FRAME_COUNT) {
        e.phase = "done";
      }
    }
    this.entities = this.entities.filter((e) => e.phase !== "done");
    void terrain;
  }

  private triggerExplosion(e: TeleportEntity, terrain: Terrain): void {
    e.phase = "exploding";
    e.tick = 0;
    const rows = terrain.length,
      cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of EXPLODE_PATTERN) {
      const col = e.col + dx,
        row = e.row + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      visual.push([col, row]);
    }
    e.cells = visual;
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

  chainDetonate(fireCells: Set<string>, terrain: Terrain): void {
    for (const e of this.entities) {
      if (e.phase === "placed" && fireCells.has(`${e.col},${e.row}`)) {
        this.triggerExplosion(e, terrain);
      }
    }
  }

  hasPlacedAt(col: number, row: number): boolean {
    return this.entities.some((e) => e.phase === "placed" && e.col === col && e.row === row);
  }

  hasSolidAt(_col: number, _row: number): boolean {
    return false; // player walks into teleports
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    return false;
  }

  explosionFrame(e: TeleportEntity): number {
    return Math.min(Math.floor(e.tick / EXPLODE_TICKS_PER_FRAME), EXPLODE_FRAME_COUNT - 1);
  }

  getEntities(): TeleportEntity[] {
    return this.entities;
  }
}
