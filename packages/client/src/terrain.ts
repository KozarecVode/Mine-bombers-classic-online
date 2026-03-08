import { MAP_WIDTH, MAP_HEIGHT } from '@minebombers/shared';

// true = wall (impassable), false = ground (walkable)
export type Terrain = boolean[][];

/** Simple map: wall border, open ground interior. */
export function generateTerrain(): Terrain {
  const grid: Terrain = [];
  for (let row = 0; row < MAP_HEIGHT; row++) {
    grid[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      const border = row === 0 || row === MAP_HEIGHT - 1 || col === 0 || col === MAP_WIDTH - 1;
      grid[row][col] = border;
    }
  }
  return grid;
}

export function isStone(terrain: Terrain, col: number, row: number): boolean {
  if (row < 0 || row >= MAP_HEIGHT || col < 0 || col >= MAP_WIDTH) return true;
  return terrain[row][col];
}
