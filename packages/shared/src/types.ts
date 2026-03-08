// ─── Tiles ────────────────────────────────────────────────────────────────────

export enum Tile {
  Empty = 0,
  Wall = 1,      // indestructible
  Soft = 2,      // destructible block
  Bomb = 3,      // occupied by a bomb (logical, not rendered separately)
}

// ─── Powerups ─────────────────────────────────────────────────────────────────

export enum PowerupType {
  ExtraBomb = 'extra_bomb',
  BombRange = 'bomb_range',
  Speed = 'speed',
}

export interface Powerup {
  id: string;
  type: PowerupType;
  x: number; // tile coords
  y: number;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

export interface Player {
  id: string;
  name: string;
  x: number; // pixel position (sub-tile movement)
  y: number;
  alive: boolean;
  bombCount: number;    // current bombs available to place
  maxBombs: number;     // max bombs at once
  bombRange: number;    // explosion radius in tiles
  speed: number;        // pixels per tick
  color: number;        // 0-3, for rendering
}

// ─── Bomb ─────────────────────────────────────────────────────────────────────

export interface Bomb {
  id: string;
  ownerId: string;
  x: number; // tile coords
  y: number;
  range: number;
  fuseTicksLeft: number;
}

// ─── Explosion ────────────────────────────────────────────────────────────────

export interface ExplosionCell {
  x: number;
  y: number;
}

export interface Explosion {
  id: string;
  cells: ExplosionCell[];
  durationTicksLeft: number;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  tick: number;
  phase: 'lobby' | 'playing' | 'gameover';
  winner: string | null; // player id
  map: number[][]; // Tile values, [row][col]
  players: Record<string, Player>;
  bombs: Record<string, Bomb>;
  explosions: Record<string, Explosion>;
  powerups: Record<string, Powerup>;
}

// ─── Network Messages (Client → Server) ───────────────────────────────────────

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'input'; direction: Direction; placeBomb: boolean }
  | { type: 'ready' };

// ─── Network Messages (Server → Client) ───────────────────────────────────────

export type ServerMessage =
  | { type: 'joined'; playerId: string; state: GameState }
  | { type: 'state'; state: GameState }
  | { type: 'error'; message: string };
