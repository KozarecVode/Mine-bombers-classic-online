// Network protocol for the game

export type NetDir = 'up' | 'down' | 'left' | 'right' | 'none';

export interface NetPushable {
  kind: string;
  id: number;
  tileX: number;
  tileY: number;
  phase?: string;
  tick?: number;
  fuseTicks?: number;
  explosionsLeft?: number;
}

export interface NetMonster {
  kind: 'slime' | 'brown' | 'grenadier' | 'grey';
  x: number; y: number;
  tileX: number; tileY: number;
  targetTileX: number; targetTileY: number;
  dir: NetDir;
  moving: boolean;
  animFrame: number;
  animTick: number;
  digging: boolean;
  digTileX: number; digTileY: number;
  phase: 'alive' | 'dead';
  hp: number;
  shooting?: boolean;   // grenadier only
}

export interface NetClone {
  id: number;
  x: number; y: number;
  tileX: number; tileY: number;
  targetTileX: number; targetTileY: number;
  dir: NetDir;
  animFrame: number;
  moving: boolean;
  digging: boolean;
  digTileX: number; digTileY: number;
  phase: 'alive' | 'dead';
  shooting: boolean;
  ownerId: number;
  color: number;
}

export interface NetPlayer {
  id: number;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  dir: NetDir;
  animFrame: number;
  moving: boolean;
  digging: boolean;
  health: number;
  dead: boolean;
  color: number;
  name: string;
  cash: number;
  digPower: number;
  lastInputSeq?: number; // host echoes back last processed input seq for reconciliation
}

/** A player entry shown in the pre-game lobby */
export interface LobbyPlayer {
  id: number;
  name: string;
  color: number;
  isReady?: boolean;
}

/** Full level state sent from host to clients on game start */
export interface LevelInitData {
  terrain: boolean[][];
  detailMap: Array<Array<{ type: string; hp: number }>>;
  entities: Array<{ kind: string; col: number; row: number; subtype?: string }>;
  spawnCol: number;
  spawnRow: number;
  /** Per-player spawn corner assignments (randomly shuffled each game) */
  playerSpawns?: Array<{ playerId: number; col: number; row: number }>;
}

/** A single terrain+detail tile change */
export interface TerrainChange {
  col: number;
  row: number;
  solid: boolean;
  cellType: string;
  burnedGround?: boolean;
}

export type NetMsg =
  // Server → client: room management
  | { type: 'assign'; playerId: number; isHost: boolean }
  | { type: 'player_join'; playerId: number }
  | { type: 'player_leave'; playerId: number }
  | { type: 'promoted_host' }
  // Host → all clients (relayed by server)
  | ({ type: 'init' } & LevelInitData)
  | { type: 'state'; tick: number; roundTick: number; players: NetPlayer[]; monsters: NetMonster[]; pushables: NetPushable[]; clones?: NetClone[]; doorSwitchOn?: boolean; doorOpen?: boolean; lava?: Array<{ id: number; cells: [number, number][] }>; urethane?: Array<{ id: number; phase: string; cells: [number, number][] }>; plastic?: Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }> }
  // Host → all clients: tournament finished, full standings
  | { type: 'tournament_over'; slots: Array<{ name: string; color: number; totalCash: number; roundsWon: number; active: boolean }> }
  | { type: 'terrain'; changes: TerrainChange[] }
  | { type: 'lobby'; players: LobbyPlayer[] }
  // Any player → host (relayed by server, tagged with fromPlayerId)
  | { type: 'player_name'; name: string; fromPlayerId?: number }
  // Client → host (relayed by server, tagged with fromPlayerId)
  | { type: 'input'; dir: NetDir; actions: string[]; digPower?: number; gold?: number; fromPlayerId?: number }
  // Host → all clients: items removed from world this tick
  | { type: 'item_remove'; pickable: number[]; treasure: number[] }
  // Host → all clients: game over, return to lobby (balances carries per-client new banked cash)
  | { type: 'game_over'; balances?: Array<{ playerId: number; bankedCash: number }> }
  // Host → all clients: host placed a weapon (relayed for visual sync)
  | { type: 'weapon_act'; weapon: string; x: number; y: number; tileX: number; tileY: number; dir: NetDir; moving: boolean; actorColor?: number; ownerId?: number }
  // Chat message
  | { type: 'chat'; name: string; text: string; fromPlayerId?: number; senderPlayerId?: number }
  // Player ready state
  | { type: 'player_ready'; isReady: boolean; fromPlayerId?: number }
  // Host → all clients: selected map changed
  | { type: 'map_select'; level: string | null }
  // Host → joining client: authoritative tournament config
  | { type: 'game_config'; rounds: number; startingCash: number; treasures: number; timeLimitSec: number; bombDamagePct: number; freeMarker: boolean; selling: boolean; winCondition: 'money' | 'wins' };
