import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DoorEntity {
  col: number;
  row: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class DoorManager {
  private doors: DoorEntity[] = [];
  private doorKeys = new Set<string>();
  private open = false;

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const col = Math.round(playerX / TILE_SIZE);
    const row = Math.round(playerY / TILE_SIZE);
    const rows = terrain.length, cols = terrain[0].length;
    if (col <= 0 || col >= cols - 1 || row <= 0 || row >= rows - 1) return;
    if (isStone(terrain, col, row)) return;
    const key = `${col},${row}`;
    if (this.doorKeys.has(key)) return;
    this.doorKeys.add(key);
    this.doors.push({ col, row });
  }

  toggle(): void {
    this.open = !this.open;
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(value: boolean): void {
    this.open = value;
  }

  hasSolidAt(col: number, row: number): boolean {
    return !this.open && this.doorKeys.has(`${col},${row}`);
  }

  tryPush(_col: number, _row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    return false;
  }

  getFireCells(): Set<string> {
    return new Set();
  }

  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): DoorEntity[] {
    return this.doors;
  }
}
