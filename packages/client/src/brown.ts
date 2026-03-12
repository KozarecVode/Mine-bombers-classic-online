import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { Dir } from './game.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED       = 1.0; // pixels per frame (twice slime speed)
const ANIM_TICKS  = 6;   // frames per animation step (faster than slime)
const TURN_CHANCE = 0.25;
const CHASE_RANGE = 12;

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function dc(dir: Dir) { return dir === 'right' ? 1 : dir === 'left' ? -1 : 0; }
function dr(dir: Dir) { return dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0; }

function chaseDirections(ex: number, ey: number, px: number, py: number): Dir[] {
  const dx = px - ex, dy = py - ey;
  const result: Dir[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) result.push('right'); else if (dx < 0) result.push('left');
    if (dy > 0) result.push('down');  else if (dy < 0) result.push('up');
  } else {
    if (dy > 0) result.push('down');  else if (dy < 0) result.push('up');
    if (dx > 0) result.push('right'); else if (dx < 0) result.push('left');
  }
  return result;
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
    });
  }

  applyFire(fireCells: Set<string>): void {
    for (const b of this.browns) {
      if (b.phase === 'alive' && fireCells.has(`${b.tileX},${b.tileY}`)) {
        b.phase = 'dead';
        b.moving = false;
      }
    }
  }

  update(terrain: Terrain, solidAt: (col: number, row: number) => boolean, ptx: number, pty: number): void {
    for (const b of this.browns) {
      if (b.phase === 'dead') continue;
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
          this.startMove(b, terrain, solidAt, ptx, pty);
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
        this.startMove(b, terrain, solidAt, ptx, pty);
      }
    }
  }

  private canMove(b: BrownEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = b.tileX + dc(dir);
    const nr = b.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(b: BrownEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, ptx: number, pty: number): void {
    const dist = Math.max(Math.abs(ptx - b.tileX), Math.abs(pty - b.tileY));
    if (dist <= CHASE_RANGE) {
      for (const dir of chaseDirections(b.tileX, b.tileY, ptx, pty)) {
        if (this.canMove(b, dir, terrain, solidAt)) {
          b.dir = dir;
          b.targetTileX = b.tileX + dc(dir);
          b.targetTileY = b.tileY + dr(dir);
          b.moving = true;
          return;
        }
      }
    }
    // Patrol
    const wantTurn = Math.random() < TURN_CHANCE;
    if (wantTurn || !this.canMove(b, b.dir, terrain, solidAt)) {
      const reverse: Dir = b.dir === 'up' ? 'down' : b.dir === 'down' ? 'up' :
                           b.dir === 'left' ? 'right' : 'left';
      const available = DIRS.filter(d => this.canMove(b, d, terrain, solidAt));
      const preferred = available.filter(d => d !== reverse);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length === 0) { b.moving = false; return; }
      b.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    b.targetTileX = b.tileX + dc(b.dir);
    b.targetTileY = b.tileY + dr(b.dir);
    b.moving = true;
  }

  getEntities(): BrownEntity[] {
    return this.browns;
  }
}
