import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwitchEntity {
  col: number;
  row: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class DoorSwitchManager {
  private switches: SwitchEntity[] = [];
  private switchKeys = new Set<string>();
  private on = false;

  // bump-activation state
  private pending = false;
  private lastBumpKey: string | null = null;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    if (col <= 0 || col >= cols - 1 || row <= 0 || row >= rows - 1) return;
    if (isStone(terrain, col, row)) return;
    const key = `${col},${row}`;
    if (this.switchKeys.has(key)) return;
    this.switchKeys.add(key);
    this.switches.push({ col, row });
  }

  isOn(): boolean {
    return this.on;
  }

  // Called by main.ts after updatePlayer each frame
  consumePending(): boolean {
    if (!this.pending) return false;
    this.pending = false;
    this.on = !this.on;
    return true;
  }

  // Call when the player moves to a new tile so the next bump re-triggers
  resetBump(): void {
    this.lastBumpKey = null;
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.switchKeys.has(`${col},${row}`);
  }

  tryPush(col: number, row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    const key = `${col},${row}`;
    if (this.switchKeys.has(key) && this.lastBumpKey !== key) {
      this.lastBumpKey = key;
      this.pending = true;
    }
    return false; // always blocks — can't push a switch
  }

  getFireCells(): Set<string> {
    return new Set();
  }

  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): SwitchEntity[] {
    return this.switches;
  }
}
