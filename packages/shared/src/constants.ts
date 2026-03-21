export const TILE_SIZE = 10; // matches ground.png / wall.png tile size
export const MAP_WIDTH  = 64; // 64 × 10 = 640px canvas width
export const MAP_HEIGHT = 45; // 45 × 10 = 450px canvas height

export const HUD_HEIGHT = 56;

export const TICK_RATE = 20;
export const TICK_MS   = 1000 / TICK_RATE;

export const PLAYER_SPEED = 2; // pixels per frame

export const BOMB_FUSE_TICKS          = TICK_RATE * 3;
export const EXPLOSION_DURATION_TICKS = Math.round(TICK_RATE * 0.5);

export const DEFAULT_BOMB_RANGE = 2;
export const DEFAULT_BOMB_COUNT = 1;

export const MAX_PLAYERS = 4;
