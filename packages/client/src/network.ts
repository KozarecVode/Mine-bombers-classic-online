import type { NetMsg, NetPlayer, NetDir, TerrainChange, LevelInitData, LobbyPlayer, NetMonster, NetPushable, NetClone } from '@minebombers/shared';

export type { NetDir, LevelInitData, LobbyPlayer, NetMonster, NetPushable, NetClone };

export interface RemoteInput {
  dir: NetDir;
  actions: string[];
  digPower: number;
  gold: number;
  seq: number;
}

export class NetworkManager {
  isHost = false;
  localPlayerId = 1;
  connected = false;

  onAssign?: (playerId: number, isHost: boolean) => void;
  onPlayerJoin?: (playerId: number) => void;
  onPlayerLeave?: (playerId: number) => void;
  onPromotedHost?: () => void;
  onInitData?: (data: LevelInitData) => void;
  onStateUpdate?: (players: NetPlayer[], monsters: NetMonster[], pushables: NetPushable[], clones: NetClone[], doorSwitchOn: boolean, doorOpen: boolean, lava: Array<{ id: number; cells: [number, number][] }>, urethane: Array<{ id: number; phase: string; cells: [number, number][] }>, plastic: Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }>, roundTick: number) => void;
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
  private lastRemoteInputSeq = new Map<number, number>();
  private readonly SNAPSHOT_EVERY = 1;

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
        this.onPlayerLeave?.(msg.playerId);
        break;
      case 'promoted_host':
        this.isHost = true;
        this.onPromotedHost?.();
        break;
      case 'init': {
        const { terrain, detailMap, entities, spawnCol, spawnRow, playerSpawns } = msg;
        this.onInitData?.({ terrain, detailMap, entities, spawnCol, spawnRow, playerSpawns });
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
          const seq = (msg as unknown as { seq?: number }).seq ?? 0;
          this.remoteInputs.set(msg.fromPlayerId, { dir: msg.dir, actions: msg.actions, digPower: msg.digPower ?? 1, gold: msg.gold ?? 0, seq });
          this.lastRemoteInputSeq.set(msg.fromPlayerId, seq);
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
  sendInit(data: LevelInitData): void {
    this.send({ type: 'init', ...data });
  }

  // HOST: send state snapshot — internally throttled to SNAPSHOT_EVERY ticks
  sendSnapshot(players: NetPlayer[], monsters: NetMonster[], pushables: NetPushable[], clones: NetClone[], doorSwitchOn: boolean, doorOpen: boolean, lava: Array<{ id: number; cells: [number, number][] }>, urethane: Array<{ id: number; phase: string; cells: [number, number][] }>, plastic: Array<{ id: number; phase: string; armedCells: [number, number][]; explosionCells: [number, number][] }>, roundTick: number): void {
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

  // HOST: push authoritative tournament config to all clients
  sendConfig(cfg: { rounds: number; startingCash: number; treasures: number; timeLimitSec: number; bombDamagePct: number; freeMarker: boolean; selling: boolean; winCondition: 'money' | 'wins' }): void {
    this.send({ type: 'game_config', ...cfg });
  }

  // CLIENT: send direction + weapon actions to host each frame
  sendInput(dir: NetDir, actions: string[], digPower: number, gold: number, seq = 0): void {
    this.send({ type: 'input', dir, actions, digPower, gold, seq } as unknown as NetMsg);
  }

  // HOST: read latest input from a remote player
  getRemoteInput(playerId: number): RemoteInput {
    return this.remoteInputs.get(playerId) ?? { dir: 'none', actions: [], digPower: 1, gold: 0, seq: 0 };
  }

  // HOST: get last acknowledged input seq for a remote player
  getLastRemoteInputSeq(playerId: number): number {
    return this.lastRemoteInputSeq.get(playerId) ?? 0;
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
