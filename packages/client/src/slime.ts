import { TILE_SIZE } from '@minebombers/shared';
import type { NetMonster } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { Dir } from './game.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED       = 0.5; // pixels per frame (quarter player speed)
const ANIM_TICKS  = 12;  // frames per animation step
const CHASE_RANGE = 10;  // tiles — chase player within this distance
const TURN_CHANCE = 0.1; // probability of picking a new patrol direction each step
const DIG_POWER   = 12;

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function dc(dir: Dir) { return dir === 'right' ? 1 : dir === 'left' ? -1 : 0; }
function dr(dir: Dir) { return dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0; }


// ── Types ─────────────────────────────────────────────────────────────────────

export type SlimePhase = 'alive' | 'dead';

export interface SlimeEntity {
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
  phase: SlimePhase;
  activated: boolean;
  teleportCooldown: number;
  digging: boolean;
  digTileX: number;
  digTileY: number;
  hp: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class SlimeManager {
  private slimes: SlimeEntity[] = [];

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.slimes.some(s => s.tileX === tileX && s.tileY === tileY)) return;
    const startDir: Dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.slimes.push({
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
      hp: 10,
    });
  }

  applyFire(fireCells: Set<string>, damage: number = 1): void {
    for (const s of this.slimes) {
      if (s.phase !== 'alive' || !fireCells.has(`${s.tileX},${s.tileY}`)) continue;
      s.hp -= damage;
      if (s.hp <= 0) { s.phase = 'dead'; s.moving = false; s.digging = false; }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    allPlayers: { tileX: number; tileY: number }[],
    applyDig?: (col: number, row: number, digPower: number) => void,
  ): void {
    for (const s of this.slimes) {
      if (s.phase === 'dead') continue;
      if (allPlayers.length === 0) continue;
      const { tileX: ptx, tileY: pty } = allPlayers.reduce((a, b) =>
        Math.max(Math.abs(b.tileX - s.tileX), Math.abs(b.tileY - s.tileY)) <
        Math.max(Math.abs(a.tileX - s.tileX), Math.abs(a.tileY - s.tileY)) ? b : a);
      if (!s.activated) {
        if (Math.max(Math.abs(ptx - s.tileX), Math.abs(pty - s.tileY)) <= CHASE_RANGE) s.activated = true;
        else continue;
      }

      if (s.digging) {
        if (!isStone(terrain, s.digTileX, s.digTileY)) {
          // Tile became passable — move into it
          s.targetTileX = s.digTileX;
          s.targetTileY = s.digTileY;
          s.digging = false;
          s.moving = true;
        } else {
          applyDig?.(s.digTileX, s.digTileY, DIG_POWER);
          s.animTick++;
          if (s.animTick >= ANIM_TICKS) { s.animTick = 0; s.animFrame = (s.animFrame + 1) % 4; }
        }
        continue;
      }

      if (s.moving) {
        const targetX = s.targetTileX * TILE_SIZE;
        const targetY = s.targetTileY * TILE_SIZE;
        const remX = targetX - s.x;
        const remY = targetY - s.y;

        if (Math.abs(remX) <= SPEED && Math.abs(remY) <= SPEED) {
          // Snap to target tile
          s.x = targetX;
          s.y = targetY;
          s.tileX = s.targetTileX;
          s.tileY = s.targetTileY;
          this.startMove(s, terrain, solidAt, ptx, pty, !!applyDig);
        } else {
          s.x += Math.sign(remX) * SPEED;
          s.y += Math.sign(remY) * SPEED;
        }

        s.animTick++;
        if (s.animTick >= ANIM_TICKS) {
          s.animTick = 0;
          s.animFrame = (s.animFrame + 1) % 4;
        }
      } else {
        this.startMove(s, terrain, solidAt, ptx, pty, !!applyDig);
      }
    }
  }

  private canMove(s: SlimeEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = s.tileX + dc(dir);
    const nr = s.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(s: SlimeEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, _ptx: number, _pty: number, _canDig: boolean): void {
    // Patrol randomly (prefer not to reverse)
    const reverseS: Dir = s.dir === 'up' ? 'down' : s.dir === 'down' ? 'up' : s.dir === 'left' ? 'right' : 'left';
    if (Math.random() < TURN_CHANCE || !this.canMove(s, s.dir, terrain, solidAt)) {
      const available = DIRS.filter(d => this.canMove(s, d, terrain, solidAt));
      const preferred = available.filter(d => d !== reverseS);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length > 0) s.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    if (this.canMove(s, s.dir, terrain, solidAt)) {
      s.targetTileX = s.tileX + dc(s.dir);
      s.targetTileY = s.tileY + dr(s.dir);
      s.moving = true;
      return;
    }
    s.moving = false;
  }

  getEntities(): SlimeEntity[] {
    return this.slimes;
  }

  clear(): void {
    this.slimes = [];
  }

  applyNetState(monsters: NetMonster[]): void {
    this.slimes = monsters.filter(m => m.kind === 'slime').map(m => ({
      x: m.x, y: m.y,
      tileX: m.tileX, tileY: m.tileY,
      targetTileX: m.targetTileX, targetTileY: m.targetTileY,
      dir: m.dir as Dir, moving: m.moving,
      animFrame: m.animFrame, animTick: m.animTick,
      phase: m.phase as SlimePhase,
      activated: true, teleportCooldown: 0,
      digging: m.digging, digTileX: m.digTileX, digTileY: m.digTileY,
      hp: m.hp,
    }));
  }
}
