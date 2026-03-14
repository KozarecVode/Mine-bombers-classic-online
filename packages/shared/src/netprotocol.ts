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
}

/** A player entry shown in the pre-game lobby */
export interface LobbyPlayer {
  id: number;
  name: string;
  color: number;
}

/** Full level state sent from host to clients on game start */
export interface LevelInitData {
  terrain: boolean[][];
  detailMap: Array<Array<{ type: string; hp: number }>>;
  entities: Array<{ kind: string; col: number; row: number; subtype?: string }>;
  spawnCol: number;
  spawnRow: number;
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
  | { type: 'state'; tick: number; players: NetPlayer[]; monsters: NetMonster[]; pushables: NetPushable[]; clones?: NetClone[]; doorSwitchOn?: boolean; doorOpen?: boolean; lava?: Array<{ id: number; cells: [number, number][] }>; urethane?: Array<{ id: number; phase: string; cells: [number, number][] }>; plastic?: Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }> }
  | { type: 'terrain'; changes: TerrainChange[] }
  | { type: 'lobby'; players: LobbyPlayer[] }
  // Any player → host (relayed by server, tagged with fromPlayerId)
  | { type: 'player_name'; name: string; fromPlayerId?: number }
  // Client → host (relayed by server, tagged with fromPlayerId)
  | { type: 'input'; dir: NetDir; actions: string[]; fromPlayerId?: number }
  // Host → all clients: items removed from world this tick
  | { type: 'item_remove'; pickable: number[]; treasure: number[] }
  // Host → all clients: game over, return to lobby
  | { type: 'game_over' }
  // Host → all clients: host placed a weapon (relayed for visual sync)
  | { type: 'weapon_act'; weapon: string; x: number; y: number; tileX: number; tileY: number; dir: NetDir; moving: boolean; actorColor?: number };
