import { TILE_SIZE, EXPLOSION_DURATION_TICKS, MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import {
  GameState, Player, Bomb, Explosion, ExplosionCell,
  Powerup, PowerupType, Tile, Direction,
} from './types.js';
import { isWalkable, tileAt } from './map.js';

let _nextId = 0;
export function nextId(): string {
  return (++_nextId).toString(36);
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PlayerInput {
  direction: Direction;
  placeBomb: boolean;
}

// ─── Movement ─────────────────────────────────────────────────────────────────

const DIR_VEC: Record<Direction, [number, number]> = {
  up:    [0, -1],
  down:  [0,  1],
  left:  [-1, 0],
  right: [ 1, 0],
  none:  [0,  0],
};

function movePlayer(player: Player, dir: Direction, map: number[][]): void {
  if (dir === 'none') return;

  const [dx, dy] = DIR_VEC[dir];
  const newX = player.x + dx * player.speed;
  const newY = player.y + dy * player.speed;

  // Collision: check all 4 corners of the player hitbox (player is ~0.8 tile)
  const margin = Math.floor(TILE_SIZE * 0.1);
  const size = TILE_SIZE - margin * 2;

  const corners = [
    [newX + margin,        newY + margin       ],
    [newX + margin + size, newY + margin       ],
    [newX + margin,        newY + margin + size],
    [newX + margin + size, newY + margin + size],
  ];

  const blocked = corners.some(([cx, cy]) => {
    const col = Math.floor(cx / TILE_SIZE);
    const row = Math.floor(cy / TILE_SIZE);
    return !isWalkable(map, row, col);
  });

  if (!blocked) {
    player.x = newX;
    player.y = newY;
  }
}

// ─── Bomb placement ───────────────────────────────────────────────────────────

function placeBomb(state: GameState, player: Player, fuseTicksLeft: number): void {
  const activeBombs = Object.values(state.bombs).filter(b => b.ownerId === player.id);
  if (activeBombs.length >= player.maxBombs) return;

  const col = Math.round(player.x / TILE_SIZE);
  const row = Math.round(player.y / TILE_SIZE);

  // Don't place on top of another bomb
  const alreadyBomb = Object.values(state.bombs).some(b => b.x === col && b.y === row);
  if (alreadyBomb) return;

  const id = nextId();
  state.bombs[id] = {
    id,
    ownerId: player.id,
    x: col,
    y: row,
    range: player.bombRange,
    fuseTicksLeft,
  };
}

// ─── Explosion logic ──────────────────────────────────────────────────────────

function detonateBomb(state: GameState, bomb: Bomb): void {
  delete state.bombs[bomb.id];

  const cells: ExplosionCell[] = [{ x: bomb.x, y: bomb.y }];

  const directions: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const [dx, dy] of directions) {
    for (let i = 1; i <= bomb.range; i++) {
      const col = bomb.x + dx * i;
      const row = bomb.y + dy * i;
      const tile = tileAt(state.map, row, col);

      if (tile === Tile.Wall) break;

      cells.push({ x: col, y: row });

      if (tile === Tile.Soft) {
        state.map[row][col] = Tile.Empty;
        maybeDrop(state, col, row);
        break; // explosion stops at soft block
      }
    }
  }

  // Chain-detonate bombs caught in explosion
  for (const cell of cells) {
    const chainBomb = Object.values(state.bombs).find(b => b.x === cell.x && b.y === cell.y);
    if (chainBomb) detonateBomb(state, chainBomb);
  }

  const id = nextId();
  state.explosions[id] = { id, cells, durationTicksLeft: EXPLOSION_DURATION_TICKS };
}

function maybeDrop(state: GameState, col: number, row: number): void {
  const roll = Math.random();
  let type: PowerupType | null = null;
  if (roll < 0.2) type = PowerupType.ExtraBomb;
  else if (roll < 0.4) type = PowerupType.BombRange;
  else if (roll < 0.5) type = PowerupType.Speed;
  if (!type) return;
  const id = nextId();
  state.powerups[id] = { id, type, x: col, y: row };
}

// ─── Powerup pickup ───────────────────────────────────────────────────────────

function checkPowerups(state: GameState, player: Player): void {
  const col = Math.round(player.x / TILE_SIZE);
  const row = Math.round(player.y / TILE_SIZE);

  for (const [id, pu] of Object.entries(state.powerups)) {
    if (pu.x === col && pu.y === row) {
      applyPowerup(player, pu);
      delete state.powerups[id];
    }
  }
}

function applyPowerup(player: Player, pu: Powerup): void {
  switch (pu.type) {
    case PowerupType.ExtraBomb:
      player.maxBombs = Math.min(player.maxBombs + 1, 8);
      player.bombCount = Math.min(player.bombCount + 1, player.maxBombs);
      break;
    case PowerupType.BombRange:
      player.bombRange = Math.min(player.bombRange + 1, 8);
      break;
    case PowerupType.Speed:
      player.speed = Math.min(player.speed + 1, 12);
      break;
  }
}

// ─── Death check ──────────────────────────────────────────────────────────────

function checkDeaths(state: GameState): void {
  const explosionCells = new Set<string>();
  for (const exp of Object.values(state.explosions)) {
    for (const cell of exp.cells) {
      explosionCells.add(`${cell.x},${cell.y}`);
    }
  }

  for (const player of Object.values(state.players)) {
    if (!player.alive) continue;
    const col = Math.round(player.x / TILE_SIZE);
    const row = Math.round(player.y / TILE_SIZE);
    if (explosionCells.has(`${col},${row}`)) {
      player.alive = false;
    }
  }
}

// ─── Win condition ────────────────────────────────────────────────────────────

function checkWinCondition(state: GameState): void {
  const alivePlayers = Object.values(state.players).filter(p => p.alive);
  if (alivePlayers.length === 1) {
    state.phase = 'gameover';
    state.winner = alivePlayers[0].id;
  } else if (alivePlayers.length === 0) {
    state.phase = 'gameover';
    state.winner = null;
  }
}

// ─── Main tick ────────────────────────────────────────────────────────────────

export function tick(
  state: GameState,
  inputs: Map<string, PlayerInput>,
  fuseTicks: number,
): void {
  if (state.phase !== 'playing') return;

  state.tick++;

  // Process player inputs
  for (const [playerId, input] of inputs) {
    const player = state.players[playerId];
    if (!player || !player.alive) continue;

    movePlayer(player, input.direction, state.map);
    if (input.placeBomb) placeBomb(state, player, fuseTicks);
    checkPowerups(state, player);
  }

  // Tick bombs
  for (const bomb of Object.values(state.bombs)) {
    bomb.fuseTicksLeft--;
    if (bomb.fuseTicksLeft <= 0) {
      detonateBomb(state, bomb);
    }
  }

  // Tick explosions
  for (const [id, exp] of Object.entries(state.explosions)) {
    exp.durationTicksLeft--;
    if (exp.durationTicksLeft <= 0) {
      delete state.explosions[id];
    }
  }

  checkDeaths(state);
  checkWinCondition(state);
}
