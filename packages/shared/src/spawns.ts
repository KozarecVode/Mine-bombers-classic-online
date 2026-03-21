import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, PLAYER_SPEED, TICK_RATE, DEFAULT_BOMB_COUNT, DEFAULT_BOMB_RANGE } from './constants.js';
import { Player } from './types.js';

const SPAWN_TILES: [number, number][] = [
  [1, 1],
  [1, MAP_WIDTH - 2],
  [MAP_HEIGHT - 2, 1],
  [MAP_HEIGHT - 2, MAP_WIDTH - 2],
];

const PLAYER_COLORS = [0, 1, 2, 3];

export function createPlayer(id: string, name: string, index: number): Player {
  const [tileRow, tileCol] = SPAWN_TILES[index % SPAWN_TILES.length];
  return {
    id,
    name,
    x: tileCol * TILE_SIZE,
    y: tileRow * TILE_SIZE,
    alive: true,
    bombCount: DEFAULT_BOMB_COUNT,
    maxBombs: DEFAULT_BOMB_COUNT,
    bombRange: DEFAULT_BOMB_RANGE,
    speed: Math.round((PLAYER_SPEED * TILE_SIZE) / TICK_RATE),
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  };
}
