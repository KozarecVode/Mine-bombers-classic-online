import { TILE_SIZE, PLAYER_SPEED } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';
import { TntManager } from './tnt.js';

export type Dir = 'up' | 'down' | 'left' | 'right' | 'none';

export interface LocalPlayer {
  x: number;           // pixel position (interpolated, top-left of sprite)
  y: number;
  tileX: number;       // current tile (source tile during slide)
  tileY: number;
  targetTileX: number; // destination tile during slide
  targetTileY: number;
  dir: Dir;
  moving: boolean;
  pendingStop: boolean; // stop at next tile boundary
  animFrame: number;
  animTick: number;
  color: number;
  name: string;
}

const ANIM_TICKS = 5;

export function createLocalPlayer(name: string, color: number): LocalPlayer {
  const startTileX = 2;
  const startTileY = 2;
  return {
    x: startTileX * TILE_SIZE,
    y: startTileY * TILE_SIZE,
    tileX: startTileX,
    tileY: startTileY,
    targetTileX: startTileX,
    targetTileY: startTileY,
    dir: 'down',
    moving: false,
    pendingStop: false,
    animFrame: 0,
    animTick: 0,
    color,
    name,
  };
}

export function updatePlayer(
  player: LocalPlayer,
  dir: Dir,
  stopPressed: boolean,
  terrain: Terrain,
  tntMgr?: TntManager,
): void {
  if (stopPressed) player.pendingStop = true;

  if (player.moving) {
    // Mid-slide direction change: snap to nearest tile and redirect immediately
    if (dir !== 'none' && dir !== player.dir) {
      player.tileX = Math.round(player.x / TILE_SIZE);
      player.tileY = Math.round(player.y / TILE_SIZE);
      player.x = player.tileX * TILE_SIZE;
      player.y = player.tileY * TILE_SIZE;
      player.targetTileX = player.tileX;
      player.targetTileY = player.tileY;
      player.dir = dir;
      player.pendingStop = false;
      startMove(player, dir, terrain, tntMgr);
    }

    if (player.moving) {
      const targetX = player.targetTileX * TILE_SIZE;
      const targetY = player.targetTileY * TILE_SIZE;
      const remX = targetX - player.x;
      const remY = targetY - player.y;

      if (Math.abs(remX) <= PLAYER_SPEED && Math.abs(remY) <= PLAYER_SPEED) {
        // Reached target tile — snap to it
        player.x = targetX;
        player.y = targetY;
        player.tileX = player.targetTileX;
        player.tileY = player.targetTileY;

        if (player.pendingStop) {
          player.moving = false;
          player.pendingStop = false;
        } else {
          const nextDir = dir !== 'none' ? dir : player.dir;
          if (dir !== 'none') player.dir = dir;
          startMove(player, nextDir, terrain, tntMgr);
        }
      } else {
        // Advance toward target tile
        if (remX !== 0) player.x += Math.sign(remX) * PLAYER_SPEED;
        if (remY !== 0) player.y += Math.sign(remY) * PLAYER_SPEED;
      }
    }
  } else {
    // At rest — start moving if a direction is pressed
    if (dir !== 'none') {
      player.dir = dir;
      player.pendingStop = false;
      startMove(player, dir, terrain, tntMgr);
    }
  }

  if (player.moving) {
    player.animTick++;
    if (player.animTick >= ANIM_TICKS) {
      player.animTick = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }
  } else {
    player.animFrame = 0;
    player.animTick = 0;
  }
}

function startMove(
  player: LocalPlayer,
  dir: Dir,
  terrain: Terrain,
  tntMgr?: TntManager,
): void {
  const dcol = dir === 'right' ? 1 : dir === 'left' ? -1 : 0;
  const drow = dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0;
  const nc = player.tileX + dcol;
  const nr = player.tileY + drow;

  if (isStone(terrain, nc, nr)) {
    player.moving = false;
    return;
  }
  if (tntMgr && tntMgr.hasSolidAt(nc, nr)) {
    if (!tntMgr.tryPush(nc, nr, dcol, drow, terrain)) {
      player.moving = false;
      return;
    }
  }

  player.targetTileX = nc;
  player.targetTileY = nr;
  player.moving = true;
}
