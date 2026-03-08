import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PLAYER_SPEED } from '@minebombers/shared';
import { Terrain, isStone } from './terrain.js';

export type Dir = 'up' | 'down' | 'left' | 'right' | 'none';

export interface LocalPlayer {
  x: number;      // pixel, top-left of sprite
  y: number;
  dir: Dir;
  moving: boolean;
  animFrame: number;
  animTick: number;
  color: number;
  name: string;
}

const ANIM_TICKS = 5;
const SPRITE_SIZE = 14; // hitbox in pixels

export function createLocalPlayer(name: string, color: number): LocalPlayer {
  // Spawn in top-left open corner
  const cx = 2 * TILE_SIZE;
  const cy = 2 * TILE_SIZE;
  return { x: cx, y: cy, dir: 'down', moving: false, animFrame: 0, animTick: 0, color, name };
}

export function updatePlayer(player: LocalPlayer, dir: Dir, terrain: Terrain): void {
  player.moving = dir !== 'none';
  if (dir !== 'none') player.dir = dir;

  if (dir !== 'none') {
    const dx = dir === 'left' ? -PLAYER_SPEED : dir === 'right' ? PLAYER_SPEED : 0;
    const dy = dir === 'up'   ? -PLAYER_SPEED : dir === 'down'  ? PLAYER_SPEED : 0;

    const nx = player.x + dx;
    const ny = player.y + dy;

    if (!collidesWithTerrain(terrain, nx, player.y)) player.x = nx;
    if (!collidesWithTerrain(terrain, player.x, ny)) player.y = ny;

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

function collidesWithTerrain(terrain: Terrain, px: number, py: number): boolean {
  const margin = 1;
  const s = SPRITE_SIZE - margin * 2;
  const corners: [number, number][] = [
    [px + margin,     py + margin    ],
    [px + margin + s, py + margin    ],
    [px + margin,     py + margin + s],
    [px + margin + s, py + margin + s],
  ];
  return corners.some(([cx, cy]) => isStone(terrain, Math.floor(cx / TILE_SIZE), Math.floor(cy / TILE_SIZE)));
}
