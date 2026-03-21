import { MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import { Tile } from './types.js';

/**
 * Generates a classic Bomberman-style map.
 * - Border + inner grid positions are indestructible walls
 * - Corners (2 tiles) are always empty for player spawns
 * - Remaining interior tiles are randomly soft blocks
 */
export function generateMap(softDensity = 0.6): number[][] {
  const map: number[][] = [];

  for (let row = 0; row < MAP_HEIGHT; row++) {
    map[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      if (
        row === 0 || row === MAP_HEIGHT - 1 ||
        col === 0 || col === MAP_WIDTH - 1
      ) {
        map[row][col] = Tile.Wall;
      } else if (row % 2 === 0 && col % 2 === 0) {
        map[row][col] = Tile.Wall;
      } else {
        map[row][col] = Tile.Empty;
      }
    }
  }

  // Spawn corners: top-left, top-right, bottom-left, bottom-right
  // Keep 2x2 area around each spawn clear
  const spawnZones = [
    [1, 1], [1, 2], [2, 1],
    [1, MAP_WIDTH - 2], [1, MAP_WIDTH - 3], [2, MAP_WIDTH - 2],
    [MAP_HEIGHT - 2, 1], [MAP_HEIGHT - 2, 2], [MAP_HEIGHT - 3, 1],
    [MAP_HEIGHT - 2, MAP_WIDTH - 2], [MAP_HEIGHT - 2, MAP_WIDTH - 3], [MAP_HEIGHT - 3, MAP_WIDTH - 2],
  ];

  const spawnSet = new Set(spawnZones.map(([r, c]) => `${r},${c}`));

  // Fill interior with soft blocks
  for (let row = 1; row < MAP_HEIGHT - 1; row++) {
    for (let col = 1; col < MAP_WIDTH - 1; col++) {
      if (map[row][col] === Tile.Empty && !spawnSet.has(`${row},${col}`)) {
        if (Math.random() < softDensity) {
          map[row][col] = Tile.Soft;
        }
      }
    }
  }

  return map;
}

export function tileAt(map: number[][], row: number, col: number): number {
  if (row < 0 || row >= MAP_HEIGHT || col < 0 || col >= MAP_WIDTH) return Tile.Wall;
  return map[row][col];
}

export function isWalkable(map: number[][], row: number, col: number): boolean {
  const t = tileAt(map, row, col);
  return t === Tile.Empty;
}
