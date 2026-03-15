import { TILE_SIZE } from '@minebombers/shared';
import type { NetMonster } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { Dir } from './game.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED       = 1.5; // 1.5× brown speed
const ANIM_TICKS  = 4;   // proportionally faster animation
const CHASE_RANGE = 10;
const TURN_CHANCE = 0.1;
const DIG_POWER   = 52;

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function dc(dir: Dir) { return dir === 'right' ? 1 : dir === 'left' ? -1 : 0; }
function dr(dir: Dir) { return dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0; }


// ── Types ─────────────────────────────────────────────────────────────────────

export type GreyPhase = 'alive' | 'dead';

export interface GreyEntity {
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
  phase: GreyPhase;
  activated: boolean;
  teleportCooldown: number;
  digging: boolean;
  digTileX: number;
  digTileY: number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class GreyManager {
  private greys: GreyEntity[] = [];

  place(playerX: number, playerY: number, terrain: Terrain): void {
    const tileX = Math.round(playerX / TILE_SIZE);
    const tileY = Math.round(playerY / TILE_SIZE);
    if (isStone(terrain, tileX, tileY)) return;
    if (this.greys.some(g => g.tileX === tileX && g.tileY === tileY)) return;
    const startDir: Dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.greys.push({
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
      hp: 66,
    });
  }

  applyFire(fireCells: Set<string>, damage: number = 1): void {
    for (const g of this.greys) {
      if (g.phase !== 'alive' || !fireCells.has(`${g.tileX},${g.tileY}`)) continue;
      g.hp -= damage;
      if (g.hp <= 0) { g.phase = 'dead'; g.moving = false; g.digging = false; }
    }
  }

  update(
    terrain: Terrain,
    solidAt: (col: number, row: number) => boolean,
    allPlayers: { tileX: number; tileY: number }[],
    applyDig?: (col: number, row: number, digPower: number) => void,
  ): void {
    for (const g of this.greys) {
      if (g.phase === 'dead') continue;
      if (allPlayers.length === 0) continue;
      const { tileX: ptx, tileY: pty } = allPlayers.reduce((a, p) =>
        Math.max(Math.abs(p.tileX - g.tileX), Math.abs(p.tileY - g.tileY)) <
        Math.max(Math.abs(a.tileX - g.tileX), Math.abs(a.tileY - g.tileY)) ? p : a);
      if (!g.activated) {
        if (Math.max(Math.abs(ptx - g.tileX), Math.abs(pty - g.tileY)) <= CHASE_RANGE) g.activated = true;
        else continue;
      }

      if (g.digging) {
        if (!isStone(terrain, g.digTileX, g.digTileY)) {
          g.targetTileX = g.digTileX;
          g.targetTileY = g.digTileY;
          g.digging = false;
          g.moving = true;
        } else {
          applyDig?.(g.digTileX, g.digTileY, DIG_POWER);
          g.animTick++;
          if (g.animTick >= ANIM_TICKS) { g.animTick = 0; g.animFrame = (g.animFrame + 1) % 4; }
        }
        continue;
      }

      if (g.moving) {
        const targetX = g.targetTileX * TILE_SIZE;
        const targetY = g.targetTileY * TILE_SIZE;
        const remX = targetX - g.x;
        const remY = targetY - g.y;

        if (Math.abs(remX) <= SPEED && Math.abs(remY) <= SPEED) {
          g.x = targetX;
          g.y = targetY;
          g.tileX = g.targetTileX;
          g.tileY = g.targetTileY;
          this.startMove(g, terrain, solidAt, ptx, pty, !!applyDig);
        } else {
          g.x += Math.sign(remX) * SPEED;
          g.y += Math.sign(remY) * SPEED;
        }

        g.animTick++;
        if (g.animTick >= ANIM_TICKS) {
          g.animTick = 0;
          g.animFrame = (g.animFrame + 1) % 4;
        }
      } else {
        this.startMove(g, terrain, solidAt, ptx, pty, !!applyDig);
      }
    }
  }

  private canMove(g: GreyEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = g.tileX + dc(dir);
    const nr = g.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(g: GreyEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, _ptx: number, _pty: number, _canDig: boolean): void {
    // Patrol randomly (prefer not to reverse)
    const reverseG: Dir = g.dir === 'up' ? 'down' : g.dir === 'down' ? 'up' : g.dir === 'left' ? 'right' : 'left';
    if (Math.random() < TURN_CHANCE || !this.canMove(g, g.dir, terrain, solidAt)) {
      const available = DIRS.filter(d => this.canMove(g, d, terrain, solidAt));
      const preferred = available.filter(d => d !== reverseG);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length > 0) g.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    if (this.canMove(g, g.dir, terrain, solidAt)) {
      g.targetTileX = g.tileX + dc(g.dir);
      g.targetTileY = g.tileY + dr(g.dir);
      g.moving = true;
      return;
    }
    g.moving = false;
  }

  getEntities(): GreyEntity[] {
    return this.greys;
  }

  clear(): void {
    this.greys = [];
  }

  applyNetState(monsters: NetMonster[]): void {
    this.greys = monsters.filter(m => m.kind === 'grey').map(m => ({
      x: m.x, y: m.y,
      tileX: m.tileX, tileY: m.tileY,
      targetTileX: m.targetTileX, targetTileY: m.targetTileY,
      dir: m.dir as Dir, moving: m.moving,
      animFrame: m.animFrame, animTick: m.animTick,
      phase: m.phase as GreyPhase,
      activated: true, teleportCooldown: 0,
      digging: m.digging, digTileX: m.digTileX, digTileY: m.digTileY,
    }));
  }
}
