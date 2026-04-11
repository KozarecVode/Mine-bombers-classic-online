import { TILE_SIZE } from '@minebombers/shared';
import type { NetMonster } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { Dir } from './game.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED       = 1.0; // pixels per frame (twice slime speed)
const ANIM_TICKS  = 6;   // frames per animation step (faster than slime)
const CHASE_RANGE = 10;
const TURN_CHANCE = 0.1;
const DIG_POWER   = 5;

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function dc(dir: Dir) { return dir === 'right' ? 1 : dir === 'left' ? -1 : 0; }
function dr(dir: Dir) { return dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0; }
function isBorder(terrain: Terrain, c: number, r: number): boolean {
  return r <= 0 || r >= terrain.length - 1 || c <= 0 || c >= (terrain[0]?.length ?? 0) - 1;
}


// ── Types ─────────────────────────────────────────────────────────────────────

export type BrownPhase = 'alive' | 'dead';

export interface BrownEntity {
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
  phase: BrownPhase;
  activated: boolean;
  teleportCooldown: number;
  digging: boolean;
  digTileX: number;
  digTileY: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class BrownManager {
  private browns: BrownEntity[] = [];

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.browns.some(b => b.tileX === tileX && b.tileY === tileY)) return;
    const startDir: Dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.browns.push({
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
      phase: 'alive',
      activated: false,
      teleportCooldown: 0,
      digging: false,
      digTileX: 0,
      digTileY: 0,
      hp: 29,
    });
  }

  applyFire(fireCells: Set<string>, damage: number = 1): void {
    for (const b of this.browns) {
      if (b.phase !== 'alive' || !fireCells.has(`${b.tileX},${b.tileY}`)) continue;
      b.hp -= damage;
      if (b.hp <= 0) { b.phase = 'dead'; b.moving = false; b.digging = false; }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    allPlayers: { tileX: number; tileY: number }[],
    applyDig?: (col: number, row: number, digPower: number) => void,
    tryPush?: (col: number, row: number, dcol: number, drow: number) => boolean,
  ): void {
    for (const b of this.browns) {
      if (b.phase === 'dead') continue;
      if (allPlayers.length === 0) continue;
      const { tileX: ptx, tileY: pty } = allPlayers.reduce((a, p) =>
        Math.max(Math.abs(p.tileX - b.tileX), Math.abs(p.tileY - b.tileY)) <
        Math.max(Math.abs(a.tileX - b.tileX), Math.abs(a.tileY - b.tileY)) ? p : a);
      if (!b.activated) {
        if (Math.max(Math.abs(ptx - b.tileX), Math.abs(pty - b.tileY)) <= CHASE_RANGE) b.activated = true;
        else continue;
      }

      if (b.digging) {
        if (!isStone(terrain, b.digTileX, b.digTileY)) {
          b.targetTileX = b.digTileX;
          b.targetTileY = b.digTileY;
          b.digging = false;
          b.moving = true;
        } else {
          applyDig?.(b.digTileX, b.digTileY, DIG_POWER);
          b.animTick++;
          if (b.animTick >= ANIM_TICKS) { b.animTick = 0; b.animFrame = (b.animFrame + 1) % 4; }
        }
        continue;
      }

      if (b.moving) {
        const targetX = b.targetTileX * TILE_SIZE;
        const targetY = b.targetTileY * TILE_SIZE;
        const remX = targetX - b.x;
        const remY = targetY - b.y;

        if (Math.abs(remX) <= SPEED && Math.abs(remY) <= SPEED) {
          b.x = targetX;
          b.y = targetY;
          b.tileX = b.targetTileX;
          b.tileY = b.targetTileY;
          this.startMove(b, terrain, solidAt, ptx, pty, !!applyDig, tryPush);
        } else {
          b.x += Math.sign(remX) * SPEED;
          b.y += Math.sign(remY) * SPEED;
        }

        b.animTick++;
        if (b.animTick >= ANIM_TICKS) {
          b.animTick = 0;
          b.animFrame = (b.animFrame + 1) % 4;
        }
      } else {
        this.startMove(b, terrain, solidAt, ptx, pty, !!applyDig, tryPush);
      }
    }
  }

  private canMove(b: BrownEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = b.tileX + dc(dir);
    const nr = b.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(b: BrownEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, _ptx: number, _pty: number, canDig: boolean, tryPush?: (col: number, row: number, dcol: number, drow: number) => boolean): void {
    const canPushDir = (dir: Dir): boolean => {
      if (!tryPush) return false;
      const nc = b.tileX + dc(dir), nr = b.tileY + dr(dir);
      if (isStone(terrain, nc, nr) || !solidAt(nc, nr)) return false;
      return !isStone(terrain, nc + dc(dir), nr + dr(dir)) && !solidAt(nc + dc(dir), nr + dr(dir));
    };
    // Patrol randomly (prefer not to reverse)
    const reverseB: Dir = b.dir === 'up' ? 'down' : b.dir === 'down' ? 'up' : b.dir === 'left' ? 'right' : 'left';
    if (Math.random() < TURN_CHANCE || (!this.canMove(b, b.dir, terrain, solidAt) && !canPushDir(b.dir))) {
      const available = DIRS.filter(d => this.canMove(b, d, terrain, solidAt) || canPushDir(d));
      const preferred = available.filter(d => d !== reverseB);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length > 0) {
        b.dir = choices[Math.floor(Math.random() * choices.length)];
      } else if (canDig) {
        const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
        for (const dir of shuffled) {
          const nc = b.tileX + dc(dir), nr = b.tileY + dr(dir);
          if (isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr)) {
            b.dir = dir; b.digTileX = nc; b.digTileY = nr; b.digging = true; return;
          }
        }
        b.moving = false; return;
      }
    }
    if (this.canMove(b, b.dir, terrain, solidAt)) {
      b.targetTileX = b.tileX + dc(b.dir);
      b.targetTileY = b.tileY + dr(b.dir);
      b.moving = true;
      return;
    }
    if (canDig) {
      const nc = b.tileX + dc(b.dir), nr = b.tileY + dr(b.dir);
      if (isStone(terrain, nc, nr) && !solidAt(nc, nr) && !isBorder(terrain, nc, nr)) {
        b.digTileX = nc; b.digTileY = nr; b.digging = true; return;
      }
    }
    if (canPushDir(b.dir)) {
      const dcol = dc(b.dir), drow = dr(b.dir);
      const nc = b.tileX + dcol, nr = b.tileY + drow;
      if (tryPush!(nc, nr, dcol, drow)) {
        b.targetTileX = nc; b.targetTileY = nr; b.moving = true;
        return;
      }
      const alt = DIRS.filter(d => d !== b.dir && this.canMove(b, d, terrain, solidAt));
      if (alt.length > 0) {
        b.dir = alt[Math.floor(Math.random() * alt.length)];
        b.targetTileX = b.tileX + dc(b.dir); b.targetTileY = b.tileY + dr(b.dir); b.moving = true; return;
      }
    }
    b.moving = false;
  }

  getEntities(): BrownEntity[] {
    return this.browns;
  }

  clear(): void {
    this.browns = [];
  }

  applyNetState(monsters: NetMonster[]): void {
    this.browns = monsters.filter(m => m.kind === 'brown').map(m => ({
      x: m.x, y: m.y,
      tileX: m.tileX, tileY: m.tileY,
      targetTileX: m.targetTileX, targetTileY: m.targetTileY,
      dir: m.dir as Dir, moving: m.moving,
      animFrame: m.animFrame, animTick: m.animTick,
      phase: m.phase as BrownPhase,
      activated: true, teleportCooldown: 0,
      digging: m.digging, digTileX: m.digTileX, digTileY: m.digTileY,
    }));
  }
}
