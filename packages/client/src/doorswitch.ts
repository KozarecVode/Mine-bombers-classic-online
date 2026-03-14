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

  // Per-frame hold tracking: fires on first touch, re-arms after all players leave
  private heldThisFrame = new Set<string>();
  private heldLastFrame = new Set<string>();
  private pending = false;
  // Post-fire cooldown prevents rapid double-toggles from network jitter
  private cooldown = 0;
  private readonly SWITCH_COOLDOWN = 20;

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

  setOn(value: boolean): void {
    this.on = value;
  }

  // Called by main.ts after all updatePlayer calls each frame
  consumePending(): boolean {
    if (!this.pending) return false;
    this.pending = false;
    this.on = !this.on;
    this.cooldown = this.SWITCH_COOLDOWN;
    return true;
  }

  // Call at end of frame (after all player movements) to advance hold state
  endFrame(): void {
    this.heldLastFrame = new Set(this.heldThisFrame);
    this.heldThisFrame.clear();
    if (this.cooldown > 0) this.cooldown--;
  }

  hasSolidAt(col: number, row: number): boolean {
    return this.switchKeys.has(`${col},${row}`);
  }

  tryPush(col: number, row: number, _dc: number, _dr: number, _terrain: Terrain): boolean {
    const key = `${col},${row}`;
    if (this.switchKeys.has(key)) {
      this.heldThisFrame.add(key);
      if (!this.heldLastFrame.has(key) && this.cooldown <= 0) {
        this.pending = true; // first touch this contact, cooldown expired — fire
      }
      return false; // always blocks
    }
    return true;
  }

  getFireCells(): Set<string> {
    return new Set();
  }

  chainDetonate(_fireCells: Set<string>, _terrain: Terrain): void {}

  getEntities(): SwitchEntity[] {
    return this.switches;
  }
}
