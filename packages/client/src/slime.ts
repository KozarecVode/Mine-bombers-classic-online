import { TILE_SIZE } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { Dir } from './game.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED       = 0.5; // pixels per frame (quarter player speed)
const ANIM_TICKS  = 12;  // frames per animation step
const TURN_CHANCE = 0.25; // probability of randomly turning at each tile arrival
const CHASE_RANGE = 12;  // tiles — switch from patrol to chase

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
    });
  }

  applyFire(fireCells: Set<string>): void {
    for (const s of this.slimes) {
      if (s.phase === 'alive' && fireCells.has(`${s.tileX},${s.tileY}`)) {
        s.phase = 'dead';
        s.moving = false;
      }
    }
  }

  update(terrain: Terrain, solidAt: (col: number, row: number) => boolean, ptx: number, pty: number): void {
    for (const s of this.slimes) {
      if (s.phase === 'dead') continue;
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
          this.startMove(s, terrain, solidAt, ptx, pty);
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
        this.startMove(s, terrain, solidAt, ptx, pty);
      }
    }
  }

  private canMove(s: SlimeEntity, dir: Dir, terrain: Terrain, solidAt: (col: number, row: number) => boolean): boolean {
    const nc = s.tileX + dc(dir);
    const nr = s.tileY + dr(dir);
    return !isStone(terrain, nc, nr) && !solidAt(nc, nr);
  }

  private startMove(s: SlimeEntity, terrain: Terrain, solidAt: (col: number, row: number) => boolean, ptx: number, pty: number): void {
    const dist = Math.max(Math.abs(ptx - s.tileX), Math.abs(pty - s.tileY));
    if (dist <= CHASE_RANGE) {
      for (const dir of chaseDirections(s.tileX, s.tileY, ptx, pty)) {
        if (this.canMove(s, dir, terrain, solidAt)) {
          s.dir = dir;
          s.targetTileX = s.tileX + dc(dir);
          s.targetTileY = s.tileY + dr(dir);
          s.moving = true;
          return;
        }
      }
    }
    // Patrol
    const wantTurn = Math.random() < TURN_CHANCE;
    if (wantTurn || !this.canMove(s, s.dir, terrain, solidAt)) {
      const reverse: Dir = s.dir === 'up' ? 'down' : s.dir === 'down' ? 'up' :
                           s.dir === 'left' ? 'right' : 'left';
      const available = DIRS.filter(d => this.canMove(s, d, terrain, solidAt));
      const preferred = available.filter(d => d !== reverse);
      const choices = preferred.length > 0 ? preferred : available;
      if (choices.length === 0) { s.moving = false; return; }
      s.dir = choices[Math.floor(Math.random() * choices.length)];
    }
    s.targetTileX = s.tileX + dc(s.dir);
    s.targetTileY = s.tileY + dr(s.dir);
    s.moving = true;
  }

  getEntities(): SlimeEntity[] {
    return this.slimes;
  }
}
