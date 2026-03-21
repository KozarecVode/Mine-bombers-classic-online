import { MAP_WIDTH, MAP_HEIGHT } from '@minebombers/shared';

// true = wall (impassable), false = ground (walkable)
export type Terrain = boolean[][];

export type TerrainTileType =
  | 'ground'
  | 'border'
  | 'brick_1' | 'brick_2' | 'brick_3'
  | 'solid_rock_1' | 'solid_rock_2' | 'solid_rock_3' | 'solid_rock_4'
  | 'rock_1' | 'rock_2' | 'rock_3' | 'rock_4'
  | 'rock_destroyed_1' | 'rock_destroyed_2'
  | 'sand_1' | 'sand_2' | 'sand_3'
  | 'sand_rock_1' | 'sand_rock_2';

export interface TerrainDetailCell {
  type: TerrainTileType;
  hp: number;
  burnedGround?: boolean;
}

export type TerrainDetailMap = TerrainDetailCell[][];

export const TILE_MAX_HP: Record<TerrainTileType, number> = {
  ground:           0,
  border:           Infinity,
  brick_1:          8000,
  brick_2:          4000,
  brick_3:          2000,
  solid_rock_1:     2000,
  solid_rock_2:     2150,
  solid_rock_3:     2200,
  solid_rock_4:     2100,
  rock_1:           1227,
  rock_2:           1227,
  rock_3:           1227,
  rock_4:           1227,
  rock_destroyed_1: 1000,
  rock_destroyed_2: 500,
  sand_1:           22,
  sand_2:           23,
  sand_3:           24,
  sand_rock_1:      108,
  sand_rock_2:      347,
};

// What a tile becomes when fully dug through
const TILE_DIG_NEXT: Partial<Record<TerrainTileType, TerrainTileType>> = {
  brick_1: 'brick_2',         brick_2: 'brick_3',         brick_3: 'ground',
  solid_rock_1: 'rock_destroyed_1', solid_rock_2: 'rock_destroyed_1',
  solid_rock_3: 'rock_destroyed_1', solid_rock_4: 'rock_destroyed_1',
  rock_1: 'rock_destroyed_2', rock_2: 'rock_destroyed_2',
  rock_3: 'rock_destroyed_2', rock_4: 'rock_destroyed_2',
  rock_destroyed_1: 'rock_destroyed_2', rock_destroyed_2: 'ground',
  sand_1: 'ground', sand_2: 'ground', sand_3: 'ground',
  sand_rock_1: 'ground', sand_rock_2: 'ground',
};

// What a tile becomes after a single explosion hit (normal bombs)
const TILE_EXPLOSION_NEXT: Partial<Record<TerrainTileType, TerrainTileType>> = {
  brick_1: 'brick_2',         brick_2: 'brick_3',         brick_3: 'ground',
  solid_rock_1: 'rock_destroyed_2', solid_rock_2: 'rock_destroyed_2',
  solid_rock_3: 'rock_destroyed_2', solid_rock_4: 'rock_destroyed_2',
  rock_1: 'rock_destroyed_2', rock_2: 'rock_destroyed_2',
  rock_3: 'rock_destroyed_2', rock_4: 'rock_destroyed_2',
  rock_destroyed_1: 'rock_destroyed_2', rock_destroyed_2: 'ground',
  sand_1: 'ground', sand_2: 'ground', sand_3: 'ground',
  sand_rock_1: 'rock_destroyed_2', sand_rock_2: 'rock_destroyed_2',
};

// With digPower=1, solid_rock_1 (2000 HP) takes 12 s at 60 fps = 720 frames
export const BASE_DIG_RATE = 2000 / (12 * 60); // ≈ 2.778 HP per frame per digPower unit

export function isDiggable(type: TerrainTileType): boolean {
  return type !== 'ground' && type !== 'border';
}

export function isPassable(type: TerrainTileType): boolean {
  return type === 'ground';
}

// Hard tiles use the digging animation; soft tiles use the walk animation
export function isHardDigTile(type: TerrainTileType): boolean {
  return (
    type === 'brick_1' || type === 'brick_2' || type === 'brick_3' ||
    type === 'solid_rock_1' || type === 'solid_rock_2' ||
    type === 'solid_rock_3' || type === 'solid_rock_4' ||
    type === 'rock_1' || type === 'rock_2' ||
    type === 'rock_3' || type === 'rock_4' ||
    type === 'rock_destroyed_1' || type === 'rock_destroyed_2'
  );
}

// ── Map generation ─────────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export function generateTerrain(): Terrain {
  const grid: Terrain = [];
  const rng = seededRng(42);
  for (let row = 0; row < MAP_HEIGHT; row++) {
    grid[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      const border = row === 0 || row === MAP_HEIGHT - 1 || col === 0 || col === MAP_WIDTH - 1;
      // Open corridor grid: tiles where both row and col are odd are always walkable
      const isCorridorTile = row % 2 === 1 && col % 2 === 1;
      // Clear player spawn area
      const nearStart = row <= 3 && col <= 3;
      grid[row][col] = border || (!isCorridorTile && !nearStart && rng() < 0.85);
    }
  }
  return grid;
}

export function generateDetailMap(terrain: Terrain): TerrainDetailMap {
  const rng = seededRng(123);
  const detail: TerrainDetailMap = [];

  const sandTypes:  TerrainTileType[] = ['sand_1', 'sand_2', 'sand_3', 'sand_rock_1', 'sand_rock_2'];
  const rockTypes:  TerrainTileType[] = ['rock_1', 'rock_2', 'rock_3', 'rock_4'];
  const solidTypes: TerrainTileType[] = ['solid_rock_1', 'solid_rock_2', 'solid_rock_3', 'solid_rock_4'];

  const SPAWN_COL = 2, SPAWN_ROW = 2;

  for (let row = 0; row < MAP_HEIGHT; row++) {
    detail[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      const border = row === 0 || row === MAP_HEIGHT - 1 || col === 0 || col === MAP_WIDTH - 1;
      if (border) {
        detail[row][col] = { type: 'border', hp: Infinity };
        continue;
      }
      if (!terrain[row][col]) {
        detail[row][col] = { type: 'ground', hp: 0 };
        continue;
      }
      // Rare brick tiles
      if (rng() < 0.06) {
        detail[row][col] = { type: 'brick_1', hp: TILE_MAX_HP['brick_1'] };
        continue;
      }
      // Type varies with Manhattan distance from spawn
      const dist = Math.abs(col - SPAWN_COL) + Math.abs(row - SPAWN_ROW);
      let pool: TerrainTileType[];
      if (dist < 5)       pool = sandTypes;
      else if (dist < 10) pool = [...sandTypes, ...rockTypes];
      else if (dist < 16) pool = [...rockTypes, ...solidTypes];
      else                pool = solidTypes;

      const type = pool[Math.floor(rng() * pool.length)];
      detail[row][col] = { type, hp: TILE_MAX_HP[type] };
    }
  }
  return detail;
}

export function isStone(terrain: Terrain, col: number, row: number): boolean {
  if (row < 0 || row >= MAP_HEIGHT || col < 0 || col >= MAP_WIDTH) return true;
  return terrain[row][col];
}

/** Apply dig damage to a tile. Returns true if the tile changed type (broke through). */
export function applyDigDamage(
  detail: TerrainDetailMap,
  terrain: Terrain,
  col: number,
  row: number,
  digPower: number,
): boolean {
  if (row <= 0 || row >= MAP_HEIGHT - 1 || col <= 0 || col >= MAP_WIDTH - 1) return false;
  const cell = detail[row][col];
  if (!isDiggable(cell.type)) return false;
  cell.hp -= digPower * BASE_DIG_RATE;
  if (cell.hp <= 0) {
    const nextType = TILE_DIG_NEXT[cell.type] ?? 'ground';
    detail[row][col] = { type: nextType, hp: TILE_MAX_HP[nextType] };
    terrain[row][col] = !isPassable(nextType);
    return true;
  }
  return false;
}

/**
 * Degrade tiles first touched by explosion fire this frame (newFireCells),
 * then correct terrain passability for all active fire cells.
 * Returns true if any tile changed.
 */
export function applyExplosionToTerrain(
  newFireCells: Set<string>,
  allFireCells: Set<string>,
  terrain: Terrain,
  detail: TerrainDetailMap,
  nuclear = false,
): boolean {
  let changed = false;

  for (const key of newFireCells) {
    const comma = key.indexOf(',');
    const c = parseInt(key.slice(0, comma)), r = parseInt(key.slice(comma + 1));
    if (r <= 0 || r >= detail.length - 1 || c <= 0 || c >= detail[0].length - 1) continue;
    const cell = detail[r][c];
    if (!isDiggable(cell.type)) continue;
    const nextType = nuclear ? 'ground' : (TILE_EXPLOSION_NEXT[cell.type] ?? 'ground');
    const burnedGround = nextType === 'ground' ? true : undefined;
    detail[r][c] = { type: nextType, hp: TILE_MAX_HP[nextType], burnedGround };
    terrain[r][c] = !isPassable(nextType);
    changed = true;
  }

  // Correct terrain for all fire cells: managers may have set impassable-but-degraded
  // tiles to false (passable), so restore the correct value from the detail map.
  for (const key of allFireCells) {
    const comma = key.indexOf(',');
    const c = parseInt(key.slice(0, comma)), r = parseInt(key.slice(comma + 1));
    if (r < 0 || r >= detail.length || c < 0 || c >= detail[0].length) continue;
    const { type } = detail[r][c];
    if (type === 'ground' || type === 'border') continue;
    terrain[r][c] = true; // still impassable according to detail map
  }

  return changed;
}

/** Place a specific tile type (e.g. when a boulder is destroyed by fire). */
export function setTerrainTile(
  detail: TerrainDetailMap,
  terrain: Terrain,
  col: number,
  row: number,
  type: TerrainTileType,
  burnedGround?: boolean,
): void {
  if (row < 0 || row >= detail.length || col < 0 || col >= detail[0].length) return;
  const cell: TerrainDetailCell = { type, hp: TILE_MAX_HP[type] };
  if (burnedGround) cell.burnedGround = true;
  detail[row][col] = cell;
  terrain[row][col] = !isPassable(type);
}
