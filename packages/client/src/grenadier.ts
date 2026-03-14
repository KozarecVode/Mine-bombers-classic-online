import { TILE_SIZE } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";
import { Dir } from "./game.js";
import { GrenadeManager } from "./grenade.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED = 1.0;
const ANIM_TICKS = 6;
const LOS_RANGE = 15;   // max tiles of line-of-sight
const CHASE_RANGE = 10; // tiles — chase player within this distance
const TURN_CHANCE = 0.1;
const THROW_COOLDOWN = 90; // frames between throws (~1.5 s at 60 fps)
const DIG_POWER = 12;

const DIRS: Dir[] = ["up", "down", "left", "right"];
function dcf(dir: Dir) {
  return dir === "right" ? 1 : dir === "left" ? -1 : 0;
}
function drf(dir: Dir) {
  return dir === "down" ? 1 : dir === "up" ? -1 : 0;
}


// ── Types ─────────────────────────────────────────────────────────────────────

export type GrenadierPhase = "alive" | "dead";

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
  activated: boolean;
  teleportCooldown: number;
  throwCooldown: number;
  shooting: boolean;
  digging: boolean;
  digTileX: number;
  digTileY: number;
  hp: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class GrenadierManager {
  private entities: GrenadierEntity[] = [];

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
      activated: false,
      teleportCooldown: 0,
      throwCooldown: THROW_COOLDOWN,
      shooting: false,
      digging: false,
      digTileX: 0,
      digTileY: 0,
      hp: 29,
    });
  }

  applyFire(fireCells: Set<string>): void {
    for (const e of this.entities) {
      if (e.phase !== "alive" || !fireCells.has(`${e.tileX},${e.tileY}`)) continue;
      e.hp--;
      if (e.hp <= 0) { e.phase = "dead"; e.moving = false; e.shooting = false; e.digging = false; }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    playerTileX: number,
    playerTileY: number,
    grenadeMgr: GrenadeManager,
    applyDig?: (col: number, row: number, digPower: number) => void,
  ): void {
    for (const e of this.entities) {
      if (e.phase === "dead") continue;
      if (!e.activated) {
        if (Math.max(Math.abs(playerTileX - e.tileX), Math.abs(playerTileY - e.tileY)) <= CHASE_RANGE) e.activated = true;
        else continue;
      }

      const losDir = this.checkLOS(e, terrain, playerTileX, playerTileY);

      if (losDir) {
        // Face the player, stop moving/digging, tick throw cooldown
        e.shooting = true;
        e.moving = false;
        e.digging = false;
        e.dir = losDir;
        e.throwCooldown--;
        if (e.throwCooldown <= 0) {
          grenadeMgr.placeAt(e.tileX, e.tileY, losDir as Exclude<Dir, "none">, terrain);
          e.throwCooldown = THROW_COOLDOWN;
        }
      } else {
        e.shooting = false;
        if (e.throwCooldown > 0) e.throwCooldown--;

        if (e.digging) {
          if (!isStone(terrain, e.digTileX, e.digTileY)) {
            e.targetTileX = e.digTileX;
            e.targetTileY = e.digTileY;
            e.digging = false;
            e.moving = true;
          } else {
            applyDig?.(e.digTileX, e.digTileY, DIG_POWER);
            e.animTick++;
            if (e.animTick >= ANIM_TICKS) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 4; }
          }
          continue;
        }

        // Patrol movement
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
            this.startMove(e, terrain, solidAt, playerTileX, playerTileY, !!applyDig);
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
          this.startMove(e, terrain, solidAt, playerTileX, playerTileY, !!applyDig);
        }
      }
    }
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

  private startMove(e: GrenadierEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, _ptx: number, _pty: number, _canDig: boolean): void {
    // Patrol randomly (prefer not to reverse)
    const reverseE: Dir = e.dir === 'up' ? 'down' : e.dir === 'down' ? 'up' : e.dir === 'left' ? 'right' : 'left';
    if (Math.random() < TURN_CHANCE || !this.canMove(e, e.dir, terrain, solidAt)) {
      const available = DIRS.filter(d => this.canMove(e, d, terrain, solidAt));
      const preferred = available.filter(d => d !== reverseE);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length > 0) e.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    if (this.canMove(e, e.dir, terrain, solidAt)) {
      e.targetTileX = e.tileX + dcf(e.dir);
      e.targetTileY = e.tileY + drf(e.dir);
      e.moving = true;
      return;
    }
    e.moving = false;
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  getEntities(): GrenadierEntity[] {
    return this.entities;
  }
}
