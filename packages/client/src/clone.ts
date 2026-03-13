import { TILE_SIZE, PLAYER_SPEED } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";
import { Dir } from "./game.js";
import { GrenadeManager } from "./grenade.js";
import { TreasureEntity } from "./treasure.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED         = PLAYER_SPEED; // same as player (2 px/frame)
const ANIM_TICKS    = 5;            // same as player
const TURN_CHANCE   = 0.2;
const LOS_RANGE     = 15;
const THROW_COOLDOWN = 90;
const TREASURE_RANGE = 25; // Manhattan-distance tile radius to search for treasure

const DIRS: Dir[] = ["up", "down", "left", "right"];

function dc(dir: Dir) { return dir === "right" ? 1 : dir === "left" ? -1 : 0; }
function dr(dir: Dir) { return dir === "down"  ? 1 : dir === "up"   ? -1 : 0; }

function chaseDirections(ex: number, ey: number, px: number, py: number): Dir[] {
  const dx = px - ex, dy = py - ey;
  const result: Dir[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) result.push("right"); else if (dx < 0) result.push("left");
    if (dy > 0) result.push("down");  else if (dy < 0) result.push("up");
  } else {
    if (dy > 0) result.push("down");  else if (dy < 0) result.push("up");
    if (dx > 0) result.push("right"); else if (dx < 0) result.push("left");
  }
  return result;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClonePhase = "alive" | "dead";

export interface CloneEntity {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  dir: Dir;
  moving: boolean;
  digging: boolean;
  digTileX: number;
  digTileY: number;
  animFrame: number;
  animTick: number;
  phase: ClonePhase;
  throwCooldown: number;
  shooting: boolean;
  cash: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class CloneManager {
  private entities: CloneEntity[] = [];

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
      digging: false,
      digTileX: 0,
      digTileY: 0,
      animFrame: 0,
      animTick: 0,
      phase: "alive",
      throwCooldown: THROW_COOLDOWN,
      shooting: false,
      cash: 0,
    });
  }

  applyFire(fireCells: Set<string>): void {
    for (const e of this.entities) {
      if (e.phase === "alive" && fireCells.has(`${e.tileX},${e.tileY}`)) {
        e.phase = "dead";
        e.moving = false;
        e.shooting = false;
        e.digging = false;
      }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    monsterTiles: Set<string>,
    treasures: TreasureEntity[],
    grenadeMgr: GrenadeManager,
    digPower: number,
    applyDig?: (col: number, row: number, digPower: number) => void,
  ): void {
    for (const e of this.entities) {
      if (e.phase === "dead") continue;

      if (e.throwCooldown > 0) e.throwCooldown--;

      // LOS check toward any monster
      const losDir = this.checkMonsterLOS(e, terrain, monsterTiles);

      if (losDir) {
        e.shooting = true;
        e.moving = false;
        e.digging = false;
        e.dir = losDir;
        if (e.throwCooldown <= 0) {
          grenadeMgr.placeAt(e.tileX, e.tileY, losDir as Exclude<Dir, "none">, terrain);
          e.throwCooldown = THROW_COOLDOWN;
        }
        e.animTick++;
        if (e.animTick >= ANIM_TICKS) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 4; }
        continue;
      }

      e.shooting = false;

      if (e.digging) {
        if (!isStone(terrain, e.digTileX, e.digTileY)) {
          e.targetTileX = e.digTileX;
          e.targetTileY = e.digTileY;
          e.digging = false;
          e.moving = true;
        } else {
          applyDig?.(e.digTileX, e.digTileY, digPower);
          e.animTick++;
          if (e.animTick >= ANIM_TICKS) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 4; }
        }
        continue;
      }

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
          this.startMove(e, terrain, solidAt, treasures, !!applyDig);
        } else {
          e.x += Math.sign(remX) * SPEED;
          e.y += Math.sign(remY) * SPEED;
        }

        e.animTick++;
        if (e.animTick >= ANIM_TICKS) { e.animTick = 0; e.animFrame = (e.animFrame + 1) % 4; }
      } else {
        this.startMove(e, terrain, solidAt, treasures, !!applyDig);
      }
    }
  }

  private checkMonsterLOS(e: CloneEntity, terrain: Terrain, monsterTiles: Set<string>): Exclude<Dir, "none"> | null {
    const directions: [Exclude<Dir, "none">, number, number][] = [
      ["right", 1, 0], ["left", -1, 0], ["down", 0, 1], ["up", 0, -1],
    ];
    for (const [dir, dCol, dRow] of directions) {
      for (let dist = 1; dist <= LOS_RANGE; dist++) {
        const c = e.tileX + dCol * dist;
        const r = e.tileY + dRow * dist;
        if (isStone(terrain, c, r)) break;
        if (monsterTiles.has(`${c},${r}`)) return dir;
      }
    }
    return null;
  }

  private canMove(e: CloneEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = e.tileX + dc(dir);
    const nr = e.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(
    e: CloneEntity,
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    treasures: TreasureEntity[],
    canDig: boolean,
  ): void {
    // Find nearest treasure within range
    let nearestTreasure: TreasureEntity | null = null;
    let nearestDist = Infinity;
    for (const t of treasures) {
      const dist = Math.abs(t.col - e.tileX) + Math.abs(t.row - e.tileY);
      if (dist > 0 && dist < nearestDist && dist <= TREASURE_RANGE) {
        nearestDist = dist;
        nearestTreasure = t;
      }
    }

    if (nearestTreasure) {
      const dirs = chaseDirections(e.tileX, e.tileY, nearestTreasure.col, nearestTreasure.row);
      for (const dir of dirs) {
        if (this.canMove(e, dir, terrain, solidAt)) {
          e.dir = dir;
          e.targetTileX = e.tileX + dc(dir);
          e.targetTileY = e.tileY + dr(dir);
          e.moving = true;
          return;
        }
      }
      if (canDig) {
        for (const dir of dirs) {
          const nc = e.tileX + dc(dir), nr = e.tileY + dr(dir);
          if (isStone(terrain, nc, nr) && !solidAt(nc, nr)) {
            e.dir = dir;
            e.digTileX = nc;
            e.digTileY = nr;
            e.digging = true;
            return;
          }
        }
      }
    }

    // Patrol
    const wantTurn = Math.random() < TURN_CHANCE;
    if (wantTurn || !this.canMove(e, e.dir, terrain, solidAt)) {
      const reverse: Dir = e.dir === "up" ? "down" : e.dir === "down" ? "up" :
                           e.dir === "left" ? "right" : "left";
      const available = DIRS.filter((d) => this.canMove(e, d, terrain, solidAt));
      const preferred = available.filter((d) => d !== reverse);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length === 0) { e.moving = false; return; }
      e.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    e.targetTileX = e.tileX + dc(e.dir);
    e.targetTileY = e.tileY + dr(e.dir);
    e.moving = true;
  }

  getEntities(): CloneEntity[] {
    return this.entities;
  }
}
