import { TILE_SIZE, PLAYER_SPEED } from "@minebombers/shared";
import type { NetClone, NetDir } from "@minebombers/shared";
import { Terrain, isStone } from "./terrain.js";
import { Dir } from "./game.js";
import { GrenadeManager } from "./grenade.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED = PLAYER_SPEED;
const ANIM_TICKS = 5;
const TURN_CHANCE = 0.25;
const DIG_CHANCE = 0.35; // chance to randomly dig a wall instead of walking
const LOS_RANGE = 15;
const THROW_COOLDOWN = 90;

const DIRS: Dir[] = ["up", "down", "left", "right"];

function dc(dir: Dir) {
  return dir === "right" ? 1 : dir === "left" ? -1 : 0;
}
function dr(dir: Dir) {
  return dir === "down" ? 1 : dir === "up" ? -1 : 0;
}
function isBorder(terrain: Terrain, c: number, r: number): boolean {
  return r <= 0 || r >= terrain.length - 1 || c <= 0 || c >= (terrain[0]?.length ?? 0) - 1;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClonePhase = "alive" | "dead";

export interface CloneEntity {
  id: number;
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
  ownerId: number;
  color: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class CloneManager {
  private entities: CloneEntity[] = [];
  private nextId = 0;

  place(playerX: number, playerY: number, terrain: Terrain, ownerId = 0, color = 0): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.entities.some((e) => e.tileX === tileX && e.tileY === tileY)) return;
    const startDir: Dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.entities.push({
      id: this.nextId++,
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
      ownerId,
      color,
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
    grenadeMgr: GrenadeManager,
    digPower: number,
    applyDig?: (col: number, row: number, digPower: number) => void,
    allPlayerTiles: Map<string, number> = new Map(),
  ): Array<{ tileX: number; tileY: number; dir: Exclude<Dir, "none">; color: number }> {
    const grenadeThrows: Array<{ tileX: number; tileY: number; dir: Exclude<Dir, "none">; color: number }> = [];

    for (const e of this.entities) {
      if (e.phase === "dead") continue;

      if (e.throwCooldown > 0) e.throwCooldown--;

      // LOS check toward any monster or hostile player/clone
      const losDir = this.checkMonsterLOS(e, terrain, monsterTiles, allPlayerTiles);

      if (losDir) {
        e.shooting = true;
        e.moving = false;
        e.digging = false;
        e.dir = losDir;
        if (e.throwCooldown <= 0) {
          grenadeMgr.placeAt(e.tileX, e.tileY, losDir as Exclude<Dir, "none">, terrain);
          e.throwCooldown = THROW_COOLDOWN;
          grenadeThrows.push({ tileX: e.tileX, tileY: e.tileY, dir: losDir as Exclude<Dir, "none">, color: e.color });
        }
        e.animTick++;
        if (e.animTick >= ANIM_TICKS) {
          e.animTick = 0;
          e.animFrame = (e.animFrame + 1) % 4;
        }
        continue;
      }

      e.shooting = false;

      if (e.digging) {
        // Abort dig if the target became a non-diggable entity (wall, door, etc.)
        if (solidAt(e.digTileX, e.digTileY)) {
          e.digging = false;
          this.startMove(e, terrain, solidAt, !!applyDig);
          continue;
        }
        if (!isStone(terrain, e.digTileX, e.digTileY)) {
          e.targetTileX = e.digTileX;
          e.targetTileY = e.digTileY;
          e.digging = false;
          e.moving = true;
        } else {
          applyDig?.(e.digTileX, e.digTileY, digPower);
          e.animTick++;
          if (e.animTick >= ANIM_TICKS) {
            e.animTick = 0;
            e.animFrame = (e.animFrame + 1) % 4;
          }
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
          this.startMove(e, terrain, solidAt, !!applyDig);
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
        this.startMove(e, terrain, solidAt, !!applyDig);
      }
    }

    return grenadeThrows;
  }

  getNetState(): NetClone[] {
    return this.entities.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      tileX: e.tileX,
      tileY: e.tileY,
      targetTileX: e.targetTileX,
      targetTileY: e.targetTileY,
      dir: e.dir as NetDir,
      animFrame: e.animFrame,
      moving: e.moving,
      digging: e.digging,
      digTileX: e.digTileX,
      digTileY: e.digTileY,
      phase: e.phase,
      shooting: e.shooting,
      ownerId: e.ownerId,
      color: e.color,
    }));
  }

  applyNetState(netClones: NetClone[]): void {
    const existingById = new Map(this.entities.map((e) => [e.id, e]));
    this.entities = netClones.map((nc) => {
      const e = existingById.get(nc.id);
      if (e) {
        e.x = nc.x;
        e.y = nc.y;
        e.tileX = nc.tileX;
        e.tileY = nc.tileY;
        e.targetTileX = nc.targetTileX;
        e.targetTileY = nc.targetTileY;
        e.dir = nc.dir as Dir;
        e.animFrame = nc.animFrame;
        e.moving = nc.moving;
        e.digging = nc.digging;
        e.digTileX = nc.digTileX;
        e.digTileY = nc.digTileY;
        e.phase = nc.phase;
        e.shooting = nc.shooting;
        return e;
      }
      return {
        id: nc.id,
        x: nc.x,
        y: nc.y,
        tileX: nc.tileX,
        tileY: nc.tileY,
        targetTileX: nc.targetTileX,
        targetTileY: nc.targetTileY,
        dir: nc.dir as Dir,
        animFrame: nc.animFrame,
        animTick: 0,
        moving: nc.moving,
        digging: nc.digging,
        digTileX: nc.digTileX,
        digTileY: nc.digTileY,
        phase: nc.phase,
        shooting: nc.shooting,
        throwCooldown: THROW_COOLDOWN,
        cash: 0,
        ownerId: nc.ownerId,
        color: nc.color,
      };
    });
  }

  private checkMonsterLOS(
    e: CloneEntity,
    terrain: Terrain,
    monsterTiles: Set<string>,
    allPlayerTiles: Map<string, number>,
  ): Exclude<Dir, "none"> | null {
    const directions: [Exclude<Dir, "none">, number, number][] = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["down", 0, 1],
      ["up", 0, -1],
    ];
    for (const [dir, dCol, dRow] of directions) {
      for (let dist = 1; dist <= LOS_RANGE; dist++) {
        const c = e.tileX + dCol * dist;
        const r = e.tileY + dRow * dist;
        if (isStone(terrain, c, r)) break;
        if (monsterTiles.has(`${c},${r}`)) return dir;
        // Hostile player in LOS
        const playerId = allPlayerTiles.get(`${c},${r}`);
        if (playerId !== undefined && playerId !== e.ownerId) return dir;
        // Hostile clone (different owner) in LOS
        if (
          this.entities.some(
            (other) => other !== e && other.phase === "alive" && other.ownerId !== e.ownerId && other.tileX === c && other.tileY === r,
          )
        )
          return dir;
      }
    }
    return null;
  }

  private canMove(e: CloneEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = e.tileX + dc(dir);
    const nr = e.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(e: CloneEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, canDig: boolean): void {
    const wantTurn = Math.random() < TURN_CHANCE;
    if (wantTurn || !this.canMove(e, e.dir, terrain, solidAt)) {
      const reverse: Dir = e.dir === "up" ? "down" : e.dir === "down" ? "up" : e.dir === "left" ? "right" : "left";
      const walkable = DIRS.filter((d) => this.canMove(e, d, terrain, solidAt));

      // Occasionally dig through a wall even when walking is possible
      if (canDig && Math.random() < DIG_CHANCE) {
        const diggable = DIRS.filter((d) => {
          const nc = e.tileX + dc(d),
            nr = e.tileY + dr(d);
          return isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr);
        }).filter((d) => d !== reverse);
        const allDiggable =
          diggable.length > 0
            ? diggable
            : DIRS.filter((d) => {
                const nc = e.tileX + dc(d),
                  nr = e.tileY + dr(d);
                return isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr);
              });
        if (allDiggable.length > 0) {
          const dir = allDiggable[Math.floor(Math.random() * allDiggable.length)];
          e.dir = dir;
          e.digTileX = e.tileX + dc(dir);
          e.digTileY = e.tileY + dr(dir);
          e.digging = true;
          return;
        }
      }

      const preferred = walkable.filter((d) => d !== reverse);
      const choices = preferred.length > 0 ? preferred : walkable;
      if (choices.length > 0) {
        e.dir = choices[Math.floor(Math.random() * choices.length)];
      } else if (canDig) {
        // All directions blocked — dig through a random wall
        const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
        for (const dir of shuffled) {
          const nc = e.tileX + dc(dir),
            nr = e.tileY + dr(dir);
          if (isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr)) {
            e.dir = dir;
            e.digTileX = nc;
            e.digTileY = nr;
            e.digging = true;
            return;
          }
        }
        e.moving = false;
        return;
      } else {
        e.moving = false;
        return;
      }
    }

    // If can't move in chosen direction, optionally dig through it
    if (!this.canMove(e, e.dir, terrain, solidAt) && canDig) {
      const nc = e.tileX + dc(e.dir),
        nr = e.tileY + dr(e.dir);
      if (isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr)) {
        e.digTileX = nc;
        e.digTileY = nr;
        e.digging = true;
        return;
      }
    }

    e.targetTileX = e.tileX + dc(e.dir);
    e.targetTileY = e.tileY + dr(e.dir);
    e.moving = true;
  }

  getEntities(): CloneEntity[] {
    return this.entities;
  }

  clear(): void {
    this.entities = [];
    this.nextId = 0;
  }
}
