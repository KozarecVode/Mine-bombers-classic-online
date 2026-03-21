import type { NetMsg, NetPlayer, NetDir, TerrainChange, LevelInitData, LobbyPlayer, NetMonster, NetPushable, NetClone } from '@minebombers/shared';

export type { NetDir, LevelInitData, LobbyPlayer, NetMonster, NetPushable, NetClone };

export interface RemoteInput {
  dir: NetDir;
  actions: string[];
  digPower: number;
  gold: number;
  seq: number;
  stopPressed: boolean;
  stopTileX?: number;
  stopTileY?: number;
  teleportTileX?: number;
  teleportTileY?: number;
  armorBonus?: number;
}

export class NetworkManager {
  isHost = false;
  localPlayerId = 1;
  connected = false;

  onAssign?: (playerId: number, isHost: boolean) => void;
  onPlayerJoin?: (playerId: number) => void;
  onPlayerLeave?: (playerId: number) => void;
  onHostLeft?: () => void;
  onGameInProgress?: () => void;
  onInitData?: (data: LevelInitData) => void;
  onStateUpdate?: (players: NetPlayer[], monsters: NetMonster[], pushables: NetPushable[], clones: NetClone[], doorSwitchOn: boolean, doorOpen: boolean, lava: Array<{ id: number; cells: [number, number][] }>, urethane: Array<{ id: number; phase: string; cells: [number, number][] }>, plastic: Array<{ id: number; phase: string; centerX: number; centerY: number; armedCells: [number, number][]; explosionCells: [number, number][] }>, roundTick: number) => void;
  onTerrainChange?: (changes: TerrainChange[]) => void;
  onLobbyUpdate?: (players: LobbyPlayer[]) => void;
  onPlayerName?: (playerId: number, name: string) => void;
  onItemRemove?: (pickable: number[], treasure: number[]) => void;
  onGameOver?: (balances?: Array<{ playerId: number; bankedCash: number }>) => void;
  onWeaponAct?: (weapon: string, x: number, y: number, tileX: number, tileY: number, dir: NetDir, moving: boolean, actorColor: number, ownerId?: number) => void;
  onChat?: (name: string, text: string, fromPlayerId?: number, senderPlayerId?: number) => void;
  onPlayerReady?: (playerId: number, isReady: boolean) => void;
  onMapSelect?: (level: string | null) => void;
  onGameConfig?: (cfg: { rounds: number; startingCash: number; treasures: number; timeLimitSec: number; bombDamagePct: number; freeMarker: boolean; selling: boolean; winCondition: 'money' | 'wins' }) => void;
  onTournamentOver?: (slots: Array<{ name: string; color: number; totalCash: number; roundsWon: number; active: boolean }>) => void;
  private ws: WebSocket | null = null;
  private gameTick = 0;
  private remoteInputs = new Map<number, RemoteInput>();
  private inputQueues = new Map<number, RemoteInput[]>();
  private lastProcessedInputSeq = new Map<number, number>();
  private lastRemoteInputSeq = new Map<number, number>();
  private readonly SNAPSHOT_EVERY = 1;
  private readonly MAX_INPUT_QUEUE = 16;

  connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl);
      this.ws = ws;
      ws.addEventListener('open', () => { this.connected = true; resolve(); });
      ws.addEventListener('error', () => reject(new Error('Connection failed')));
      ws.addEventListener('close', () => { this.connected = false; });
      ws.addEventListener('message', (ev) => {
        let msg: NetMsg & { fromPlayerId?: number };
        try { msg = JSON.parse(ev.data as string); } catch { return; }
        this.handle(msg);
      });
    });
  }

  private handle(msg: NetMsg & { fromPlayerId?: number }): void {
    switch (msg.type) {
      case 'assign':
        this.localPlayerId = msg.playerId;
        this.isHost = msg.isHost;
        this.onAssign?.(msg.playerId, msg.isHost);
        break;
      case 'player_join':
        this.onPlayerJoin?.(msg.playerId);
        break;
      case 'player_leave':
        this.remoteInputs.delete(msg.playerId);
        this.inputQueues.delete(msg.playerId);
        this.lastProcessedInputSeq.delete(msg.playerId);
        this.onPlayerLeave?.(msg.playerId);
        break;
      case 'host_left':
        this.onHostLeft?.();
        break;
      case 'game_in_progress':
        this.onGameInProgress?.();
        break;
      case 'init': {
        const { terrain, detailMap, entities, spawnCol, spawnRow, playerSpawns } = msg;
        const config = (msg as any).config;
        this.onInitData?.({ terrain, detailMap, entities, spawnCol, spawnRow, playerSpawns, ...(config ? { config } : {}) } as any);
        break;
      }
      case 'state':
        this.onStateUpdate?.(msg.players, msg.monsters ?? [], msg.pushables ?? [], msg.clones ?? [], msg.doorSwitchOn ?? false, msg.doorOpen ?? false, msg.lava ?? [], msg.urethane ?? [], msg.plastic ?? [], msg.roundTick ?? 0);
        break;
      case 'terrain':
        this.onTerrainChange?.(msg.changes);
        break;
      case 'lobby':
        this.onLobbyUpdate?.(msg.players);
        break;
      case 'player_name':
        if (msg.fromPlayerId !== undefined) this.onPlayerName?.(msg.fromPlayerId, msg.name);
        break;
      case 'input':
        if (msg.fromPlayerId !== undefined) {
          const raw = msg as unknown as { seq?: number; stopPressed?: boolean; stopTileX?: number; stopTileY?: number };
          const seq = raw.seq ?? 0;
          const stopPressed = raw.stopPressed ?? false;
          const ri: RemoteInput = { dir: msg.dir, actions: msg.actions, digPower: msg.digPower ?? 1, gold: msg.gold ?? 0, seq, stopPressed, stopTileX: raw.stopTileX, stopTileY: raw.stopTileY, teleportTileX: (raw as any).teleportTileX, teleportTileY: (raw as any).teleportTileY, armorBonus: (raw as any).armorBonus };
          // Also keep last-received for gold reads and fallback
          this.remoteInputs.set(msg.fromPlayerId, ri);
          this.lastRemoteInputSeq.set(msg.fromPlayerId, seq);
          // Enqueue for ordered processing — cap to prevent unbounded growth
          const q = this.inputQueues.get(msg.fromPlayerId) ?? [];
          q.push(ri);
          if (q.length > this.MAX_INPUT_QUEUE) q.shift();
          this.inputQueues.set(msg.fromPlayerId, q);
        }
        break;
      case 'item_remove':
        this.onItemRemove?.(msg.pickable, msg.treasure);
        break;
      case 'game_over':
        this.onGameOver?.(msg.balances);
        break;
      case 'weapon_act':
        this.onWeaponAct?.(msg.weapon, msg.x, msg.y, msg.tileX, msg.tileY, msg.dir, msg.moving, msg.actorColor ?? 0, msg.ownerId);
        break;
      case 'chat':
        this.onChat?.(msg.name, msg.text, msg.fromPlayerId, msg.senderPlayerId);
        break;
      case 'player_ready':
        if (msg.fromPlayerId !== undefined) this.onPlayerReady?.(msg.fromPlayerId, msg.isReady);
        break;
      case 'map_select':
        this.onMapSelect?.(msg.level);
        break;
      case 'game_config':
        this.onGameConfig?.({ rounds: msg.rounds, startingCash: msg.startingCash, treasures: msg.treasures, timeLimitSec: msg.timeLimitSec, bombDamagePct: msg.bombDamagePct, freeMarker: msg.freeMarker, selling: msg.selling, winCondition: msg.winCondition });
        break;
      case 'tournament_over':
        this.onTournamentOver?.(msg.slots);
        break;
    }
  }

  // HOST: broadcast full level data to all clients
  sendInit(data: LevelInitData, config?: Record<string, unknown>): void {
    this.send({ type: 'init', ...data, config });
  }

  // HOST: send state snapshot — internally throttled to SNAPSHOT_EVERY ticks
  sendSnapshot(players: NetPlayer[], monsters: NetMonster[], pushables: NetPushable[], clones: NetClone[], doorSwitchOn: boolean, doorOpen: boolean, lava: Array<{ id: number; cells: [number, number][] }>, urethane: Array<{ id: number; phase: string; cells: [number, number][] }>, plastic: Array<{ id: number; phase: string; centerX: number; centerY: number; armedCells: [number, number][]; explosionCells: [number, number][] }>, roundTick: number): void {
    this.gameTick++;
    if (this.gameTick % this.SNAPSHOT_EVERY !== 0) return;
    const msg = { type: 'state', tick: this.gameTick, roundTick, players, monsters, pushables, clones, doorSwitchOn, doorOpen, lava, urethane, plastic };
    if (this.gameTick % 60 === 0) console.log(`[snapshot] ~${JSON.stringify(msg).length} bytes`);
    this.send(msg);
  }

  // HOST: send terrain+detail tile changes immediately
  sendTerrainChanges(changes: TerrainChange[]): void {
    if (changes.length === 0) return;
    this.send({ type: 'terrain', changes });
  }

  // HOST: broadcast weapon placement to all clients
  sendWeaponAct(weapon: string, x: number, y: number, tileX: number, tileY: number, dir: NetDir, moving: boolean, actorColor = 0, ownerId?: number): void {
    this.send({ type: 'weapon_act', weapon, x, y, tileX, tileY, dir, moving, actorColor, ownerId });
  }

  // HOST: broadcast game over to all clients, with per-player new banked cash
  sendGameOver(balances?: Array<{ playerId: number; bankedCash: number }>): void {
    this.send({ type: 'game_over', balances });
  }

  // HOST: broadcast tournament over with final standings
  sendTournamentOver(slots: Array<{ name: string; color: number; totalCash: number; roundsWon: number; active: boolean }>): void {
    this.send({ type: 'tournament_over', slots });
  }

  // HOST: broadcast item removals to all clients
  sendItemRemove(pickable: number[], treasure: number[]): void {
    if (pickable.length === 0 && treasure.length === 0) return;
    this.send({ type: 'item_remove', pickable, treasure });
  }

  // HOST: broadcast lobby player list to all clients
  sendLobby(players: LobbyPlayer[]): void {
    this.send({ type: 'lobby', players });
  }

  // ANY: send name update (client → server → host, or host just updates locally)
  sendName(name: string): void {
    this.send({ type: 'player_name', name });
  }

  // ANY: send chat message
  sendChat(name: string, text: string, senderPlayerId?: number): void {
    this.send({ type: 'chat', name, text, senderPlayerId });
  }

  // ANY: send ready state
  sendReady(isReady: boolean): void {
    this.send({ type: 'player_ready', isReady });
  }

  // HOST: broadcast selected map to all clients
  sendMapSelect(level: string | null): void {
    this.send({ type: 'map_select', level });
  }

  sendGameInProgress(): void {
    this.send({ type: 'game_in_progress' });
  }

  // HOST: push authoritative tournament config to all clients
  sendConfig(cfg: { rounds: number; startingCash: number; treasures: number; timeLimitSec: number; bombDamagePct: number; freeMarker: boolean; selling: boolean; winCondition: 'money' | 'wins' }): void {
    this.send({ type: 'game_config', ...cfg });
  }

  // CLIENT: send direction + weapon actions to host each frame
  sendInput(dir: NetDir, actions: string[], digPower: number, gold: number, seq = 0, stopPressed = false, stopTileX?: number, stopTileY?: number, armorBonus?: number, teleportTileX?: number, teleportTileY?: number): void {
    this.send({ type: 'input', dir, actions, digPower, gold, seq, stopPressed, stopTileX, stopTileY, armorBonus, teleportTileX, teleportTileY } as unknown as NetMsg);
  }

  // HOST: read latest input from a remote player (non-consuming, for gold/stats reads)
  getRemoteInput(playerId: number): RemoteInput {
    return this.remoteInputs.get(playerId) ?? { dir: 'none', actions: [], digPower: 1, gold: 0, seq: 0, stopPressed: false };
  }

  // HOST: dequeue the next input for movement processing — processes inputs in arrival order,
  // preventing direction skips when multiple inputs arrive in the same frame window.
  // Falls back to last received input (repeat direction) when queue is empty.
  dequeueRemoteInput(playerId: number): RemoteInput {
    const q = this.inputQueues.get(playerId);
    if (q && q.length > 0) {
      const input = q.shift()!;
      this.lastProcessedInputSeq.set(playerId, input.seq);
      // Store directionless fallback (no re-firing actions on repeat)
      this.remoteInputs.set(playerId, { ...input, actions: [] });
      return input;
    }
    // Queue empty: re-use last direction (player holds direction), no actions
    const fallback = this.remoteInputs.get(playerId) ?? { dir: 'none', actions: [], digPower: 1, gold: 0, seq: 0, stopPressed: false };
    this.lastProcessedInputSeq.set(playerId, fallback.seq);
    return { ...fallback, actions: [] };
  }

  // HOST: get last *processed* input seq for a remote player (used to ack in snapshots)
  getLastRemoteInputSeq(playerId: number): number {
    return this.lastProcessedInputSeq.get(playerId) ?? 0;
  }

  // HOST: clear actions after processing (actions are edge-triggered — one per press)
  clearRemoteActions(playerId: number): void {
    const ri = this.remoteInputs.get(playerId);
    if (ri) ri.actions = [];
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
