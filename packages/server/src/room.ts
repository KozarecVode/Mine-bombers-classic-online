import { WebSocket } from 'ws';
import {
  GameState, ClientMessage, ServerMessage,
  tick, PlayerInput, generateMap, createPlayer,
  TICK_MS, BOMB_FUSE_TICKS, MAX_PLAYERS,
} from '../../shared/src/index.js';

interface Connection {
  ws: WebSocket;
  playerId: string;
  name: string;
  lastInput: PlayerInput;
}

export class Room {
  readonly id: string;
  private connections: Map<string, Connection> = new Map();
  state: GameState;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private playerIndex = 0;

  constructor(id: string) {
    this.id = id;
    this.state = this.freshState();
  }

  private freshState(): GameState {
    return {
      tick: 0,
      phase: 'lobby',
      winner: null,
      map: generateMap(),
      players: {},
      bombs: {},
      explosions: {},
      powerups: {},
    };
  }

  get playerCount(): number {
    return this.connections.size;
  }

  get isFull(): boolean {
    return this.connections.size >= MAX_PLAYERS;
  }

  addPlayer(ws: WebSocket, name: string): string {
    const playerId = Math.random().toString(36).slice(2, 8);
    const index = this.playerIndex++;
    const player = createPlayer(playerId, name, index);
    this.state.players[playerId] = player;

    const conn: Connection = {
      ws,
      playerId,
      name,
      lastInput: { direction: 'none', placeBomb: false },
    };
    this.connections.set(playerId, conn);

    this.send(ws, { type: 'joined', playerId, state: this.state });
    this.broadcast({ type: 'state', state: this.state }, playerId);

    ws.on('message', (raw) => this.handleMessage(playerId, raw.toString()));
    ws.on('close', () => this.removePlayer(playerId));

    return playerId;
  }

  private removePlayer(playerId: string): void {
    delete this.state.players[playerId];
    this.connections.delete(playerId);
    if (this.connections.size === 0) {
      this.stopLoop();
    } else {
      this.broadcast({ type: 'state', state: this.state });
    }
  }

  private handleMessage(playerId: string, raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const conn = this.connections.get(playerId);
    if (!conn) return;

    switch (msg.type) {
      case 'input':
        conn.lastInput = { direction: msg.direction, placeBomb: msg.placeBomb };
        break;
      case 'ready':
        this.tryStartGame();
        break;
    }
  }

  private tryStartGame(): void {
    if (this.state.phase !== 'lobby') return;
    if (this.connections.size < 1) return; // allow solo for testing

    this.state = this.freshState();
    // Re-add players with fresh stats
    let idx = 0;
    for (const conn of this.connections.values()) {
      const player = this.state.players[conn.playerId];
      if (!player) {
        // Player joined before fresh state, recreate
        const p = createPlayer(conn.playerId, conn.name, idx);
        this.state.players[conn.playerId] = p;
      }
      idx++;
    }
    this.state.phase = 'playing';
    this.startLoop();
    this.broadcast({ type: 'state', state: this.state });
  }

  private startLoop(): void {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.gameTick(), TICK_MS);
  }

  private stopLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private gameTick(): void {
    if (this.state.phase !== 'playing') {
      this.stopLoop();
      return;
    }

    const inputs = new Map<string, PlayerInput>();
    for (const [id, conn] of this.connections) {
      inputs.set(id, conn.lastInput);
      // Reset bomb press after consumption so it's edge-triggered
      conn.lastInput = { ...conn.lastInput, placeBomb: false };
    }

    tick(this.state, inputs, BOMB_FUSE_TICKS);
    this.broadcast({ type: 'state', state: this.state });

    if (this.state.phase === 'gameover') {
      this.stopLoop();
    }
  }

  private broadcast(msg: ServerMessage, excludeId?: string): void {
    const data = JSON.stringify(msg);
    for (const [id, conn] of this.connections) {
      if (id !== excludeId && conn.ws.readyState === conn.ws.OPEN) {
        conn.ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
