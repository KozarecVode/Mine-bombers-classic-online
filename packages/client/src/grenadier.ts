import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";
import { Dir } from "./game.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED = 1.0;
const ANIM_TICKS = 6;
const TURN_CHANCE = 0.25;
const LOS_RANGE = 15; // max tiles of line-of-sight
const CHASE_RANGE = 12; // tiles — switch from patrol to chase
const THROW_COOLDOWN = 90; // frames between throws (~1.5 s at 60 fps)
const GRENADE_TPT = 1.5; // tiles per tick (same as player grenade)
const EXPLODE_FRAMES = 11;
const EXPLODE_TPF = 2;
const CHAIN_CUTOFF = 6;

const DIRS: Dir[] = ["up", "down", "left", "right"];
function dcf(dir: Dir) {
  return dir === "right" ? 1 : dir === "left" ? -1 : 0;
}
function drf(dir: Dir) {
  return dir === "down" ? 1 : dir === "up" ? -1 : 0;
}

function chaseDirections(ex: number, ey: number, px: number, py: number): Dir[] {
  const dx = px - ex,
    dy = py - ey;
  const result: Dir[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) result.push("right");
    else if (dx < 0) result.push("left");
    if (dy > 0) result.push("down");
    else if (dy < 0) result.push("up");
  } else {
    if (dy > 0) result.push("down");
    else if (dy < 0) result.push("up");
    if (dx > 0) result.push("right");
    else if (dx < 0) result.push("left");
  }
  return result;
}

const CROSS: [number, number][] = [
  [0, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [0, 1],
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type GrenadierPhase = "alive" | "dead";

export interface GrenadierGrenade {
  tileX: number;
  tileY: number;
  dc: number;
  dr: number;
  phase: "flying" | "exploding" | "done";
  tick: number;
  cells: [number, number][];
}

export interface GrenadierEntity {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  dir: Dir;
  moving: boolean;
  animFrame: number;
  animTick: number;
  phase: GrenadierPhase;
  throwCooldown: number;
  shooting: boolean; // true when LOS is active — suppress patrol movement
}

// ── Manager ───────────────────────────────────────────────────────────────────
type SolidChecker = { hasSolidAt: (col: number, row: number) => boolean };

export class GrenadierManager {
  private entities: GrenadierEntity[] = [];
  private grenades: GrenadierGrenade[] = [];

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some((e) => e.tileX === tileX && e.tileY === tileY)) return;
    const startDir: Dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.entities.push({
      x: tileX * TILE_SIZE,
      y: tileY * TILE_SIZE,
      tileX,
      tileY,
      targetTileX: tileX,
      targetTileY: tileY,
      dir: startDir,
      moving: false,
      animFrame: 0,
      animTick: 0,
      phase: "alive",
      throwCooldown: THROW_COOLDOWN,
      shooting: false,
    });
  }

  applyFire(fireCells: Set<string>): void {
    for (const e of this.entities) {
      if (e.phase === "alive" && fireCells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "dead";
        e.moving = false;
        e.shooting = false;
      }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    playerTileX: number,
    playerTileY: number,
    solidCheckers: SolidChecker[] = [],
  ): void {
    // ── Grenadier entities ────────────────────────────────────────────────────
    for (const e of this.entities) {
      if (e.phase === "dead") continue;

      const losDir = this.checkLOS(e, terrain, playerTileX, playerTileY);

      if (losDir) {
        // Face the player, stop moving, tick throw cooldown
        e.shooting = true;
        e.moving = false;
        e.dir = losDir;
        e.throwCooldown--;
        if (e.throwCooldown <= 0) {
          this.throwGrenade(e, losDir, terrain);
          e.throwCooldown = THROW_COOLDOWN;
        }
      } else {
        e.shooting = false;
        if (e.throwCooldown > 0) e.throwCooldown--;

        // Patrol movement (identical to BrownManager)
        if (e.moving) {
          const targetX = e.targetTileX * TILE_SIZE;
          const targetY = e.targetTileY * TILE_SIZE;
          const remX = targetX - e.x;
          const remY = targetY - e.y;

          if (Math.abs(remX) <= SPEED && Math.abs(remY) <= SPEED) {
            e.x = targetX;
            e.y = targetY;
            e.tileX = e.targetTileX;
            e.tileY = e.targetTileY;
            this.startMove(e, terrain, solidAt, playerTileX, playerTileY);
          } else {
            e.x += Math.sign(remX) * SPEED;
            e.y += Math.sign(remY) * SPEED;
          }

          e.animTick++;
          if (e.animTick >= ANIM_TICKS) {
            e.animTick = 0;
            e.animFrame = (e.animFrame + 1) % 4;
          }
        } else {
          this.startMove(e, terrain, solidAt, playerTileX, playerTileY);
        }
      }
    }

    // ── Monster grenades ──────────────────────────────────────────────────────
    for (const g of this.grenades) {
      g.tick++;
      if (g.phase === "flying") {
        if (solidCheckers.some((s) => s.hasSolidAt(g.tileX, g.tileY))) {
          this.explodeGrenade(g, terrain);
          continue;
        }

        for (let i = 0; i < GRENADE_TPT && g.phase === "flying"; i++) {
          const nc = g.tileX + g.dc,
            nr = g.tileY + g.dr;
          if (isStone(terrain, nc, nr) || solidCheckers.some((s) => s.hasSolidAt(nc, nr))) {
            this.explodeGrenade(g, terrain);
          } else {
            g.tileX = nc;
            g.tileY = nr;
          }
        }
      } else if (g.phase === "exploding" && g.tick >= EXPLODE_TPF * EXPLODE_FRAMES) {
        g.phase = "done";
      }
    }
    this.grenades = this.grenades.filter((g) => g.phase !== "done");
  }

  // ── LOS ──────────────────────────────────────────────────────────────────────

  private checkLOS(e: GrenadierEntity, terrain: Terrain, ptx: number, pty: number): Dir | null {
    const ec = e.tileX,
      er = e.tileY;

    // Same row
    if (er === pty) {
      const dist = Math.abs(ptx - ec);
      if (dist > 0 && dist <= LOS_RANGE) {
        const step = ptx > ec ? 1 : -1;
        for (let c = ec + step; c !== ptx; c += step) {
          if (isStone(terrain, c, er)) return null;
        }
        return ptx > ec ? "right" : "left";
      }
    }

    // Same column
    if (ec === ptx) {
      const dist = Math.abs(pty - er);
      if (dist > 0 && dist <= LOS_RANGE) {
        const step = pty > er ? 1 : -1;
        for (let r = er + step; r !== pty; r += step) {
          if (isStone(terrain, ec, r)) return null;
        }
        return pty > er ? "down" : "up";
      }
    }

    return null;
  }

  // ── Patrol helpers ────────────────────────────────────────────────────────────

  private canMove(e: GrenadierEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = e.tileX + dcf(dir),
      nr = e.tileY + drf(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(e: GrenadierEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, ptx: number, pty: number): void {
    const dist = Math.max(Math.abs(ptx - e.tileX), Math.abs(pty - e.tileY));
    if (dist <= CHASE_RANGE) {
      for (const dir of chaseDirections(e.tileX, e.tileY, ptx, pty)) {
        if (this.canMove(e, dir, terrain, solidAt)) {
          e.dir = dir;
          e.targetTileX = e.tileX + dcf(dir);
          e.targetTileY = e.tileY + drf(dir);
          e.moving = true;
          return;
        }
      }
    }
    // Patrol
    const wantTurn = Math.random() < TURN_CHANCE;
    if (wantTurn || !this.canMove(e, e.dir, terrain, solidAt)) {
      const reverse: Dir = e.dir === "up" ? "down" : e.dir === "down" ? "up" : e.dir === "left" ? "right" : "left";
      const available = DIRS.filter((d) => this.canMove(e, d, terrain, solidAt));
      const preferred = available.filter((d) => d !== reverse);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length === 0) {
        e.moving = false;
        return;
      }
      e.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    e.targetTileX = e.tileX + dcf(e.dir);
    e.targetTileY = e.tileY + drf(e.dir);
    e.moving = true;
  }

  // ── Grenade helpers ───────────────────────────────────────────────────────────

  private throwGrenade(e: GrenadierEntity, dir: Dir, terrain: Terrain): void {
    const dc = dcf(dir),
      dr = drf(dir);
    const startC = e.tileX + dc,
      startR = e.tileY + dr;
    if (isStone(terrain, startC, startR)) return;
    this.grenades.push({ tileX: startC, tileY: startR, dc, dr, phase: "flying", tick: 0, cells: [] });
  }

  private explodeGrenade(g: GrenadierGrenade, terrain: Terrain): void {
    g.phase = "exploding";
    g.tick = 0;
    const rows = terrain.length,
      cols = terrain[0].length;
    const visual: [number, number][] = [];
    for (const [dx, dy] of CROSS) {
      const col = g.tileX + dx,
        row = g.tileY + dy;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) continue;
      if (isStone(terrain, col, row)) {
        terrain[row][col] = false;
      } else {
        visual.push([col, row]);
      }
    }
    g.cells = visual;
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  getFireCells(): Set<string> {
    const cells = new Set<string>();
    for (const g of this.grenades) {
      if (g.phase === "exploding" && Math.floor(g.tick / EXPLODE_TPF) < CHAIN_CUTOFF) {
        for (const [c, r] of g.cells) cells.add(`${c},${r}`);
      }
    }
    return cells;
  }

  explosionFrame(g: GrenadierGrenade): number {
    return Math.min(Math.floor(g.tick / EXPLODE_TPF), EXPLODE_FRAMES - 1);
  }

  getEntities(): GrenadierEntity[] {
    return this.entities;
  }
  getGrenades(): GrenadierGrenade[] {
    return this.grenades;
  }
}
