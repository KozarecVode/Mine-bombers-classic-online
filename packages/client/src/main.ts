import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, type NetPlayer, type NetMonster, type NetPushable, type TerrainChange } from "@minebombers/shared";
import { InputManager } from "./input.js";
import { Renderer } from "./renderer.js";
import { createLocalPlayer, updatePlayer, type Dir, type LocalPlayer } from "./game.js";
import { NetworkManager, type NetDir } from "./network.js";
import {
  generateTerrain,
  generateDetailMap,
  applyDigDamage,
  applyExplosionToTerrain,
  setTerrainTile,
  isStone,
  isDiggable,
  TILE_MAX_HP,
  type TerrainTileType,
} from "./terrain.js";
import { loadAssets, Assets } from "./assets.js";
import { TntManager, type TntPhase } from "./tnt.js";
import { BigCrossManager } from "./bigcross.js";
import { GrenadeManager } from "./grenade.js";
import { BombManager, SMALL_BOMB_PATTERN, BIG_BOMB_PATTERN } from "./bomb.js";
import { LandmineManager } from "./landmine.js";
import { FlameBombManager } from "./flamebomb.js";
import { FlamethrowerManager } from "./flamethrower.js";
import { FireExtinguisherManager } from "./fireextinguisher.js";
import { DetBombManager, SMALL_DETONATE_PATTERN, BIG_DETONATE_PATTERN } from "./detbomb.js";
import { UrethaneManager } from "./urethane.js";
import { PlasticManager } from "./plastic.js";
import { NuclearManager } from "./nuclear.js";
import { JumpingBombManager } from "./jumpingbomb.js";
import { LavaManager } from "./lava.js";
import { WallManager } from "./wall.js";
import { TeleportManager } from "./teleport.js";
import { BarrelManager } from "./barrel.js";
import { DiggerBombManager } from "./diggerbomb.js";
import { JetpackManager } from "./jetpack.js";
import { BoulderManager } from "./boulder.js";
import { SlimeManager } from "./slime.js";
import { BrownManager } from "./brown.js";
import { GrenadierManager } from "./grenadier.js";
import { GreyManager } from "./grey.js";
import { DoorManager } from "./door.js";
import { DoorSwitchManager } from "./doorswitch.js";
import { TreasureManager, TreasureType } from "./treasure.js";
import { PickableManager, PICKABLE_TYPES, PickableType } from "./pickable.js";
import { parseMneLevel, buildThumbnail, buildThumbnailFromParsed, LEVEL_NAMES, generateRandomLevel } from "./levelloader.js";
import { CloneManager } from "./clone.js";
import { MAX_HEALTH } from "./game.js";

const lobbyEl = document.getElementById("lobby")!;
const gameEl = document.getElementById("game")!;
const statusEl = document.getElementById("status")!;
const levelStatusEl = document.getElementById("levelStatus")!;
const levelGridEl = document.getElementById("levelGrid")!;
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const waitingMsgEl = document.getElementById("waitingMsg")!;
const playerListEl = document.getElementById("playerList")!;
const joinBtn = document.getElementById("joinBtn") as HTMLButtonElement;

const levelData = new Map<string, Uint8Array>();
let selectedLevel: string | null = null;
let cachedRandomLevel: ReturnType<typeof generateRandomLevel> | null = null;

const input = new InputManager();
const renderer = new Renderer();
const terrain = generateTerrain();
const detailMap = generateDetailMap(terrain);
const player = createLocalPlayer("Player", 0);
const tntMgr = new TntManager();
const bigCrossMgr = new BigCrossManager();
const smallCrossMgr = new BigCrossManager(15);
const grenadeMgr = new GrenadeManager();
const smallBombMgr = new BombManager(SMALL_BOMB_PATTERN);
const bigBombMgr = new BombManager(BIG_BOMB_PATTERN);
const landmineMgr = new LandmineManager();
const flameBombMgr = new FlameBombManager();
const flamethrowerMgr = new FlamethrowerManager();
const fireExtMgr = new FireExtinguisherManager();
const smallDetMgr = new DetBombManager(SMALL_DETONATE_PATTERN);
const bigDetMgr = new DetBombManager(BIG_DETONATE_PATTERN);
const urethaneMgr = new UrethaneManager();
const plasticMgr = new PlasticManager();
const nuclearMgr = new NuclearManager();
const jumpingBombMgr = new JumpingBombManager();
const lavaMgr = new LavaManager();
const wallMgr = new WallManager();
const teleportMgr = new TeleportManager();
const barrelMgr = new BarrelManager();
const diggerBombMgr = new DiggerBombManager();
const jetpackMgr = new JetpackManager();
const doorMgr = new DoorManager();
const doorSwitchMgr = new DoorSwitchManager();
const boulderMgr = new BoulderManager();
const slimeMgr = new SlimeManager();
const brownMgr = new BrownManager();
const grenadierMgr = new GrenadierManager();
const greyMgr = new GreyManager();
const treasureMgr = new TreasureManager();
const pickableMgr = new PickableManager();
const cloneMgr = new CloneManager();

// ── Multiplayer ───────────────────────────────────────────────────────────────

const netMgr = new NetworkManager();
const remotePlayers = new Map<number, LocalPlayer>();
let prevTerrain: boolean[][] | null = null;
let prevDetailType: string[][] | null = null;

// ── Lobby player list ─────────────────────────────────────────────────────────

const PLAYER_COLORS = ['#4040ff', '#ff4040', '#40c040', '#c0a000'];
const lobbyPlayers = new Map<number, { name: string; color: number }>();

function renderPlayerList(): void {
  playerListEl.innerHTML = '';
  for (const [id, p] of lobbyPlayers) {
    const div = document.createElement('div');
    div.className = 'lobbyPlayer';
    const dot = document.createElement('span');
    dot.className = 'playerDot';
    dot.style.background = PLAYER_COLORS[p.color] ?? '#fff';
    const nameSp = document.createElement('span');
    nameSp.textContent = p.name || `Player ${id}`;
    div.appendChild(dot);
    div.appendChild(nameSp);
    if (id === netMgr.localPlayerId) {
      const tag = document.createElement('span');
      tag.className = 'youTag';
      tag.textContent = '(you)';
      div.appendChild(tag);
    }
    playerListEl.appendChild(div);
  }
}

function broadcastLobby(): void {
  if (!netMgr.connected || !netMgr.isHost) return;
  netMgr.sendLobby([...lobbyPlayers.entries()].map(([id, p]) => ({ id, ...p })));
}

nameInput.addEventListener('input', () => {
  const name = nameInput.value.trim() || 'Player';
  player.name = name;
  lobbyPlayers.set(netMgr.localPlayerId, { name, color: player.color });
  renderPlayerList();
  if (netMgr.connected) {
    if (netMgr.isHost) broadcastLobby();
    else netMgr.sendName(name);
  }
});

function spawnPos(playerId: number): [number, number] {
  const positions: [number, number][] = [
    [1, 1], [MAP_WIDTH - 2, 1], [1, MAP_HEIGHT - 2], [MAP_WIDTH - 2, MAP_HEIGHT - 2],
  ];
  return positions[(playerId - 1) % 4];
}

function toNetPlayer(p: LocalPlayer, id: number): NetPlayer {
  return {
    id, x: p.x, y: p.y, tileX: p.tileX, tileY: p.tileY,
    targetTileX: p.targetTileX, targetTileY: p.targetTileY,
    dir: p.dir as NetDir, animFrame: p.animFrame, moving: p.moving,
    digging: p.digging, health: p.health, dead: p.dead, color: p.color, name: p.name,
  };
}

// HOST: place a weapon on behalf of a remote player
function applyRemoteWeapon(rp: { x: number; y: number; tileX: number; tileY: number; dir: Dir; moving: boolean }, action: string): void {
  const tx = rp.tileX * TILE_SIZE, ty = rp.tileY * TILE_SIZE;
  if (action === '__detonate__') { smallDetMgr.detonate(terrain); bigDetMgr.detonate(terrain); }
  else if (action === '__fireext__') fireExtMgr.fire(rp.x, rp.y, rp.dir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], rp.moving);
  else if (action === 'tnt') tntMgr.place(tx, ty, 'none', terrain);
  else if (action === 'bigcross') bigCrossMgr.place(tx, ty, 'none', terrain);
  else if (action === 'smallcross') smallCrossMgr.place(tx, ty, 'none', terrain);
  else if (action === 'grenade') grenadeMgr.place(rp.x, rp.y, rp.dir, terrain);
  else if (action === 'smallbomb') smallBombMgr.place(tx, ty, 'none', terrain);
  else if (action === 'bigbomb') bigBombMgr.place(tx, ty, 'none', terrain);
  else if (action === 'flamebomb') flameBombMgr.place(tx, ty, 'none', terrain);
  else if (action === 'flamethrower') flamethrowerMgr.fire(rp.x, rp.y, rp.dir, terrain, rp.moving);
  else if (action === 'smalldetonate') smallDetMgr.place(rp.x, rp.y, terrain);
  else if (action === 'bigdetonate') bigDetMgr.place(rp.x, rp.y, terrain);
  else if (action === 'urethane') { if (!lavaMgr.hasSolidAt(rp.tileX, rp.tileY)) urethaneMgr.place(rp.x, rp.y, terrain, (c, r) => plasticMgr.hasCellAt(c, r)); }
  else if (action === 'plastic') { if (!lavaMgr.hasSolidAt(rp.tileX, rp.tileY)) plasticMgr.place(rp.x, rp.y, terrain, (c, r) => urethaneMgr.hasCellAt(c, r)); }
  else if (action === 'nuclear') nuclearMgr.place(rp.x, rp.y, terrain);
  else if (action === 'jumpingbomb') jumpingBombMgr.place(rp.x, rp.y, terrain);
  else if (action === 'lava') lavaMgr.place(rp.x, rp.y, terrain);
  else if (action === 'wall') wallMgr.place(tx, ty, terrain);
  else if (action === 'teleport') teleportMgr.place(rp.x, rp.y, terrain);
  else if (action === 'barrel') barrelMgr.place(rp.x, rp.y, terrain);
  else if (action === 'diggerbomb') diggerBombMgr.place(rp.x, rp.y, terrain);
  else if (action === 'door') doorMgr.place(rp.x, rp.y, terrain);
  else if (action === 'doorswitch') doorSwitchMgr.place(rp.x, rp.y, terrain);
  else if (action === 'boulder') boulderMgr.place(rp.x, rp.y, terrain);
  else if (action === 'slime') slimeMgr.place(rp.x, rp.y, terrain);
  else if (action === 'brown') brownMgr.place(rp.x, rp.y, terrain);
  else if (action === 'grenadier') grenadierMgr.place(rp.x, rp.y, terrain);
  else if (action === 'grey') greyMgr.place(rp.x, rp.y, terrain);
  else if (action === 'clone') cloneMgr.place(rp.x, rp.y, terrain);
  else if (action === 'treasure') treasureMgr.place(rp.x, rp.y, terrain);
  else if (action === 'landmine') landmineMgr.place(rp.x, rp.y, terrain);
  else if (PICKABLE_TYPES.includes(action as (typeof PICKABLE_TYPES)[number]))
    pickableMgr.place(rp.x, rp.y, terrain, action as (typeof PICKABLE_TYPES)[number]);
}

function applyParsedLevel(parsed: ReturnType<typeof parseMneLevel>): void {
  for (let r = 0; r < MAP_HEIGHT; r++)
    for (let c = 0; c < MAP_WIDTH; c++) {
      terrain[r][c] = parsed.terrain[r][c];
      detailMap[r][c] = parsed.detailMap[r][c];
    }

  player.x = parsed.spawnCol * TILE_SIZE;
  player.y = parsed.spawnRow * TILE_SIZE;
  player.tileX = parsed.spawnCol;
  player.tileY = parsed.spawnRow;
  player.targetTileX = parsed.spawnCol;
  player.targetTileY = parsed.spawnRow;
  player.moving = false;
  player.digging = false;
  prevTileX = parsed.spawnCol;
  prevTileY = parsed.spawnRow;
  activeFireCells = new Set();

  for (const e of parsed.entities) {
    const px = e.col * TILE_SIZE;
    const py = e.row * TILE_SIZE;
    switch (e.kind) {
      case "brown":
        brownMgr.place(px, py, terrain);
        break;
      case "grenadier":
        grenadierMgr.place(px, py, terrain);
        break;
      case "slime":
        slimeMgr.place(px, py, terrain);
        break;
      case "grey":
        greyMgr.place(px, py, terrain);
        break;
      case "boulder":
        boulderMgr.place(px, py, terrain);
        break;
      case "landmine":
        landmineMgr.place(px, py, terrain);
        break;
      case "door":
        doorMgr.place(px, py, terrain);
        break;
      case "doorswitch":
        doorSwitchMgr.place(px, py, terrain);
        break;
      case "lava":
        lavaMgr.place(px, py, terrain);
        break;
      case "barrel":
        barrelMgr.place(px, py, terrain);
        break;
      case "teleport":
        teleportMgr.place(px, py, terrain);
        break;
      case "urethane":
        urethaneMgr.placeTile(Math.round(px / TILE_SIZE), Math.round(py / TILE_SIZE));
        break;
      case "treasure":
        treasureMgr.place(px, py, terrain, e.subtype as TreasureType);
        break;
      case "pickable":
        pickableMgr.place(px, py, terrain, e.subtype as PickableType);
        break;
    }
  }

  renderer.markTerrainDirty();
}

async function loadLevelThumbnails(): Promise<void> {
  levelStatusEl.textContent = "loading levels…";

  // Random level card (first)
  const randomCard = document.createElement("div");
  randomCard.className = "levelCard selected";
  cachedRandomLevel = generateRandomLevel();
  randomCard.appendChild(buildThumbnailFromParsed(cachedRandomLevel));
  const randomLabel = document.createElement("span");
  randomLabel.textContent = "RANDOM";
  randomCard.appendChild(randomLabel);
  randomCard.addEventListener("click", () => {
    levelGridEl.querySelectorAll(".levelCard").forEach((c) => c.classList.remove("selected"));
    randomCard.classList.add("selected");
    selectedLevel = null;
    levelStatusEl.textContent = "RANDOM";
  });
  levelGridEl.appendChild(randomCard);

  const results = await Promise.allSettled(
    LEVEL_NAMES.map(async (name) => {
      const resp = await fetch(`/levels/${name}.MNE`);
      if (!resp.ok) throw new Error(`${name} not found`);
      return { name, data: new Uint8Array(await resp.arrayBuffer()) };
    }),
  );

  let loaded = 0;
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { name, data } = result.value;
    levelData.set(name, data);

    const thumb = buildThumbnail(data);
    const card = document.createElement("div");
    card.className = "levelCard";
    card.appendChild(thumb);
    const label = document.createElement("span");
    label.textContent = name;
    card.appendChild(label);
    card.addEventListener("click", () => {
      levelGridEl.querySelectorAll(".levelCard").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedLevel = name;
      levelStatusEl.textContent = name;
    });
    levelGridEl.appendChild(card);
    loaded++;
  }

  levelStatusEl.textContent = "RANDOM";
}

const WEAPONS = [
  "tnt",
  "bigcross",
  "smallcross",
  "grenade",
  "smallbomb",
  "bigbomb",
  "landmine",
  "flamebomb",
  "flamethrower",
  "fireextinguisher",
  "smalldetonate",
  "bigdetonate",
  "urethane",
  "plastic",
  "nuclear",
  "jumpingbomb",
  "lava",
  "wall",
  "teleport",
  "barrel",
  "diggerbomb",
  "jetpack",
  "door",
  "doorswitch",
  "boulder",
  "slime",
  "brown",
  "grenadier",
  "grey",
  "clone",
  "treasure",
  "dig_power_1",
  "dig_power_2",
  "dig_power_3",
  "random_weapon",
  "medpac",
] as const;
type WeaponName = (typeof WEAPONS)[number];
let selectedWeapon: WeaponName = "tnt";

let assets: Assets;
let assetsReady = false;

function collectPushables(): NetPushable[] {
  const r: NetPushable[] = [];
  const add = (kind: string, entities: Array<{ id: number; tileX: number; tileY: number; phase?: string }>) => {
    for (const e of entities) if (e.phase !== 'done') r.push({ kind, id: e.id, tileX: e.tileX, tileY: e.tileY, phase: e.phase });
  };
  add('tnt', tntMgr.getEntities());
  add('bigcross', bigCrossMgr.getEntities());
  add('smallcross', smallCrossMgr.getEntities());
  add('smallbomb', smallBombMgr.getEntities());
  add('bigbomb', bigBombMgr.getEntities());
  add('flamebomb', flameBombMgr.getEntities());
  add('smalldet', smallDetMgr.getEntities());
  add('bigdet', bigDetMgr.getEntities());
  add('diggerbomb', diggerBombMgr.getEntities());
  add('barrel', barrelMgr.getEntities());
  for (const b of boulderMgr.getEntities()) r.push({ kind: 'boulder', id: b.id, tileX: b.tileX, tileY: b.tileY });
  return r;
}

function collectLava(): Array<{ id: number; cells: [number, number][] }> {
  return lavaMgr.getEntities().map(e => ({ id: e.id, cells: e.cellList.slice() as [number, number][] }));
}

function applyPushables(pushables: NetPushable[]): void {
  const byKind = new Map<string, Map<number, NetPushable>>();
  for (const p of pushables) {
    if (!byKind.has(p.kind)) byKind.set(p.kind, new Map());
    byKind.get(p.kind)!.set(p.id, p);
  }
  const sync = (kind: string, entities: Array<{ id: number; tileX: number; tileY: number }>) => {
    const positions = byKind.get(kind);
    if (!positions) return;
    for (const e of entities) { const p = positions.get(e.id); if (p) { e.tileX = p.tileX; e.tileY = p.tileY; } }
  };
  sync('tnt', tntMgr.getEntities());
  sync('bigcross', bigCrossMgr.getEntities());
  sync('smallcross', smallCrossMgr.getEntities());
  sync('smallbomb', smallBombMgr.getEntities());
  sync('bigbomb', bigBombMgr.getEntities());
  sync('flamebomb', flameBombMgr.getEntities());
  sync('smalldet', smallDetMgr.getEntities());
  sync('bigdet', bigDetMgr.getEntities());
  sync('diggerbomb', diggerBombMgr.getEntities());
  sync('barrel', barrelMgr.getEntities());
  sync('boulder', boulderMgr.getEntities());
  // Sync TNT phase so dud/explode decision follows the host
  const tntData = byKind.get('tnt');
  if (tntData) {
    for (const [id, p] of tntData) {
      if (p.phase) tntMgr.forcePhase(id, p.phase as TntPhase, terrain);
    }
  }
}

function startGame(): void {
  lobbyEl.style.display = "none";
  gameEl.style.display = "flex";
  requestAnimationFrame(loop);
}

function returnToLobby(): void {
  gameEl.style.display = "none";
  lobbyEl.style.display = "flex";
  player.health = MAX_HEALTH;
  player.dead = false;
}

function enablePlayIfReady(): void {
  if (assetsReady && (netMgr.isHost || !netMgr.connected)) joinBtn.disabled = false;
}

// ── Asset loading ──────────────────────────────────────────────────────────────

loadAssets()
  .then((a) => {
    assets = a;
    renderer.initPatterns(assets);
    assetsReady = true;
    enablePlayIfReady();
    statusEl.textContent = netMgr.connected ? '' : 'Connecting…';
  })
  .catch((err: Error) => { statusEl.textContent = err.message; });

loadLevelThumbnails().catch(() => { levelStatusEl.textContent = ""; });

// ── Auto-connect ───────────────────────────────────────────────────────────────

const WS_URL = `ws://${location.hostname}:3001`;

netMgr.connect(WS_URL)
  .then(() => {
    netMgr.onAssign = (playerId, isHost) => {
      const name = nameInput.value.trim() || 'Player';
      player.name = name;
      player.color = (playerId - 1) % 4;
      lobbyPlayers.set(playerId, { name, color: player.color });
      renderPlayerList();
      if (isHost) {
        statusEl.textContent = '';
        waitingMsgEl.style.display = 'none';
        enablePlayIfReady();
        broadcastLobby();
      } else {
        statusEl.textContent = '';
        waitingMsgEl.textContent = 'Waiting for host to start the game…';
        waitingMsgEl.style.display = '';
        joinBtn.disabled = true;
        joinBtn.textContent = 'WAITING…';
        // Tell host our name immediately
        netMgr.sendName(name);
      }
    };

    netMgr.onPlayerJoin = (pid) => {
      const [tx, ty] = spawnPos(pid);
      remotePlayers.set(pid, createLocalPlayer(`Player${pid}`, (pid - 1) % 4, tx, ty));
      // Add with placeholder name until we receive their player_name
      lobbyPlayers.set(pid, { name: `Player${pid}`, color: (pid - 1) % 4 });
      renderPlayerList();
      broadcastLobby();
    };

    netMgr.onPlayerLeave = (pid) => {
      remotePlayers.delete(pid);
      lobbyPlayers.delete(pid);
      renderPlayerList();
      broadcastLobby();
    };

    netMgr.onPromotedHost = () => {
      prevTerrain = terrain.map(row => [...row]);
      prevDetailType = detailMap.map(row => row.map(c => c.type));
      waitingMsgEl.style.display = 'none';
      joinBtn.textContent = 'PLAY';
      enablePlayIfReady();
      broadcastLobby();
    };

    netMgr.onPlayerName = (pid, name) => {
      const entry = lobbyPlayers.get(pid);
      if (entry) entry.name = name;
      else lobbyPlayers.set(pid, { name, color: (pid - 1) % 4 });
      // Update the in-game remote player name too
      const rp = remotePlayers.get(pid);
      if (rp) rp.name = name;
      renderPlayerList();
      broadcastLobby();
    };

    netMgr.onLobbyUpdate = (players) => {
      // Rebuild from authoritative host list
      lobbyPlayers.clear();
      for (const p of players) lobbyPlayers.set(p.id, { name: p.name, color: p.color });
      renderPlayerList();
    };

    // CLIENT: receive full level from host and start game
    netMgr.onInitData = (data) => {
      applyParsedLevel(data as Parameters<typeof applyParsedLevel>[0]);
      // Override spawn to this player's corner
      const [tx, ty] = spawnPos(netMgr.localPlayerId);
      player.x = tx * TILE_SIZE; player.y = ty * TILE_SIZE;
      player.tileX = tx; player.tileY = ty;
      player.targetTileX = tx; player.targetTileY = ty;
      prevTileX = tx; prevTileY = ty;
      startGame();
    };

    netMgr.onStateUpdate = (players, monsters, pushables, doorSwitchOn, doorOpen, lava) => {
      applyPushables(pushables);
      slimeMgr.applyNetState(monsters);
      brownMgr.applyNetState(monsters);
      grenadierMgr.applyNetState(monsters);
      greyMgr.applyNetState(monsters);
      doorSwitchMgr.setOn(doorSwitchOn);
      doorMgr.setOpen(doorOpen);
      lavaMgr.applyNetState(lava);
      for (const np of players) {
        if (np.id === netMgr.localPlayerId) {
          player.health = np.health;
          if (np.dead && !player.dead) { player.dead = true; player.moving = false; }
          if (Math.abs(player.tileX - np.tileX) > 2 || Math.abs(player.tileY - np.tileY) > 2) {
            player.x = np.x; player.y = np.y;
            player.tileX = np.tileX; player.tileY = np.tileY;
            player.targetTileX = np.targetTileX; player.targetTileY = np.targetTileY;
          }
          continue;
        }
        let rp = remotePlayers.get(np.id);
        if (!rp) { rp = createLocalPlayer(np.name, np.color); remotePlayers.set(np.id, rp); }
        rp.x = np.x; rp.y = np.y;
        rp.tileX = np.tileX; rp.tileY = np.tileY;
        rp.targetTileX = np.targetTileX; rp.targetTileY = np.targetTileY;
        rp.dir = np.dir as Dir; rp.animFrame = np.animFrame;
        rp.moving = np.moving; rp.digging = np.digging;
        rp.health = np.health; rp.dead = np.dead;
      }
    };

    netMgr.onTerrainChange = (changes: TerrainChange[]) => {
      for (const { col, row, solid, cellType } of changes) {
        terrain[row][col] = solid;
        detailMap[row][col] = { type: cellType as TerrainTileType, hp: TILE_MAX_HP[cellType as TerrainTileType] ?? 0 };
      }
      renderer.markTerrainDirty();
    };

    netMgr.onItemRemove = (pickable, treasure) => {
      pickableMgr.removeById(pickable);
      treasureMgr.removeById(treasure);
    };

    netMgr.onGameOver = () => { returnToLobby(); };

    netMgr.onWeaponAct = (weapon, x, y, tileX, tileY, dir, moving) => {
      applyRemoteWeapon({ x, y, tileX, tileY, dir: dir as Dir, moving }, weapon);
    };
  })
  .catch(() => {
    // Server unreachable — offline mode
    statusEl.textContent = '';
    const name = nameInput.value.trim() || 'Player';
    lobbyPlayers.set(1, { name, color: 0 });
    renderPlayerList();
    enablePlayIfReady();
  });

// ── Play button (host / offline) ───────────────────────────────────────────────

joinBtn.addEventListener("click", () => {
  if (!assetsReady) return;
  player.name = nameInput.value.trim() || "Player";

  const parsed = selectedLevel && levelData.has(selectedLevel)
    ? parseMneLevel(levelData.get(selectedLevel)!)
    : cachedRandomLevel ?? generateRandomLevel();
  cachedRandomLevel = null;
  applyParsedLevel(parsed);

  if (netMgr.connected && netMgr.isHost) {
    // Clear a 3x3 area around every player's spawn corner so nobody starts in stone
    const allPids = [netMgr.localPlayerId, ...remotePlayers.keys()];
    for (const pid of allPids) {
      const [sx, sy] = spawnPos(pid);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = sy + dr, c = sx + dc;
          if (r > 0 && c > 0 && r < MAP_HEIGHT - 1 && c < MAP_WIDTH - 1)
            setTerrainTile(detailMap, terrain, c, r, 'ground');
        }
    }
    renderer.markTerrainDirty();
    // Spawn host at their corner
    const [tx, ty] = spawnPos(netMgr.localPlayerId);
    player.x = tx * TILE_SIZE; player.y = ty * TILE_SIZE;
    player.tileX = tx; player.tileY = ty;
    player.targetTileX = tx; player.targetTileY = ty;
    prevTileX = tx; prevTileY = ty;
    // Send full level (with cleared spawns) to all clients
    netMgr.sendInit({
      terrain: terrain.map(row => [...row]),
      detailMap: detailMap.map(row => row.map(c => ({ type: c.type, hp: c.hp }))),
      entities: parsed.entities,
      spawnCol: parsed.spawnCol,
      spawnRow: parsed.spawnRow,
    });
    prevTerrain = terrain.map(row => [...row]);
    prevDetailType = detailMap.map(row => row.map(c => c.type));
  }

  startGame();
});

const TARGET_MS = 1000 / 60;
let last = 0;
let prevTileX = player.tileX;
let prevTileY = player.tileY;
let activeFireCells = new Set<string>();
let deathTimer = 0;
const DEATH_DELAY_FRAMES = 2 * 60;

function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (ts - last < TARGET_MS) return;
  last += TARGET_MS;
  // Prevent runaway catch-up (e.g. after tab was hidden)
  if (ts - last > TARGET_MS * 5) last = ts;

  // Reset per-frame item removal tracking
  pickableMgr.lastRemovedIds = [];
  treasureMgr.lastRemovedIds = [];

  const tileX = player.tileX * TILE_SIZE;
  const tileY = player.tileY * TILE_SIZE;
  const facingDir = player.dir; // capture before updatePlayer can change it

  // Dead players can't do anything
  const inputDir = player.dead ? "none" : input.getDirection();
  if (!player.moving && inputDir !== "none") {
    const dc = inputDir === "right" ? 1 : inputDir === "left" ? -1 : 0;
    const dr = inputDir === "down" ? 1 : inputDir === "up" ? -1 : 0;
    const dnc = player.tileX + dc,
      dnr = player.tileY + dr;
    player.digging =
      isStone(terrain, dnc, dnr) || lavaMgr.hasSolidAt(dnc, dnr) || urethaneMgr.hasSolidAt(dnc, dnr) || plasticMgr.hasSolidAt(dnc, dnr);
  } else {
    player.digging = false;
  }

  const weaponMgrs = [
    tntMgr, bigCrossMgr, smallCrossMgr, smallBombMgr, bigBombMgr, flameBombMgr,
    smallDetMgr, bigDetMgr, urethaneMgr, plasticMgr, lavaMgr, barrelMgr,
    diggerBombMgr, doorMgr, doorSwitchMgr, boulderMgr,
  ];
  const pushBlocker = (c: number, r: number) => teleportMgr.hasPlacedAt(c, r) || treasureMgr.hasSolidAt(c, r);
  updatePlayer(player, inputDir, input.consumeStopPress(), terrain, weaponMgrs, jetpackMgr.getSpeed(), pushBlocker);

  // HOST: update remote players with their received inputs
  if (netMgr.connected && netMgr.isHost) {
    for (const [pid, rp] of remotePlayers) {
      const ri = netMgr.getRemoteInput(pid);
      if (!rp.dead) {
        const rdir = ri.dir as Dir;
        // Set digging flag (same logic as local player)
        if (!rp.moving && rdir !== 'none') {
          const rdc = rdir === 'right' ? 1 : rdir === 'left' ? -1 : 0;
          const rdr = rdir === 'down'  ? 1 : rdir === 'up'   ? -1 : 0;
          rp.digging = isStone(terrain, rp.tileX + rdc, rp.tileY + rdr)
            || lavaMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr)
            || urethaneMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr)
            || plasticMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr);
        } else {
          rp.digging = false;
        }
        const prevRpTileX = rp.tileX, prevRpTileY = rp.tileY;
        updatePlayer(rp, rdir, false, terrain, weaponMgrs, jetpackMgr.getSpeed(), pushBlocker);
        if (rp.tileX !== prevRpTileX || rp.tileY !== prevRpTileY) {
          const rpDest = teleportMgr.tryTeleport(rp.tileX, rp.tileY);
          if (rpDest) {
            rp.x = rpDest[0] * TILE_SIZE; rp.y = rpDest[1] * TILE_SIZE;
            rp.tileX = rpDest[0]; rp.tileY = rpDest[1];
            rp.targetTileX = rpDest[0]; rp.targetTileY = rpDest[1];
            rp.moving = false;
          }
        }
        if (rp.moving) rp.digging = false;
        // Apply dig damage
        if (rp.digging) {
          const rdc = rdir === 'right' ? 1 : rdir === 'left' ? -1 : 0;
          const rdr2 = rdir === 'down' ? 1 : rdir === 'up'  ? -1 : 0;
          const rnc = rp.tileX + rdc, rnr = rp.tileY + rdr2;
          if (isStone(terrain, rnc, rnr)) {
            if (applyDigDamage(detailMap, terrain, rnc, rnr, jetpackMgr.getDigPower(rp.digPower))) renderer.markTerrainDirty();
          } else {
            lavaMgr.applyDigDamage(rnc, rnr, jetpackMgr.getDigPower(rp.digPower));
            urethaneMgr.applyDigDamage(rnc, rnr, jetpackMgr.getDigPower(rp.digPower));
            plasticMgr.applyDigDamage(rnc, rnr, jetpackMgr.getDigPower(rp.digPower));
          }
        }
        for (const action of ri.actions) applyRemoteWeapon(rp, action);
        // Remote player pickups (host is authoritative)
        rp.cash += treasureMgr.update(rp.tileX, rp.tileY);
        for (const type of pickableMgr.update(rp.tileX, rp.tileY)) {
          if (type === 'dig_power_1') rp.digPower += 1;
          else if (type === 'dig_power_2') rp.digPower += 3;
          else if (type === 'dig_power_3') rp.digPower += 5;
          else if (type === 'medpac') rp.health = MAX_HEALTH;
        }
      }
      netMgr.clearRemoteActions(pid);
    }
  }

  // Clear digging if player started moving (tile became passable mid-dig)
  if (player.moving) player.digging = false;

  // Apply dig damage to whatever is blocking the player
  if (player.digging) {
    const dc = inputDir === "right" ? 1 : inputDir === "left" ? -1 : 0;
    const dr = inputDir === "down" ? 1 : inputDir === "up" ? -1 : 0;
    const nc = player.tileX + dc,
      nr = player.tileY + dr;
    if (isStone(terrain, nc, nr)) {
      if (applyDigDamage(detailMap, terrain, nc, nr, jetpackMgr.getDigPower(player.digPower))) renderer.markTerrainDirty();
    } else {
      lavaMgr.applyDigDamage(nc, nr, jetpackMgr.getDigPower(player.digPower));
      urethaneMgr.applyDigDamage(nc, nr, jetpackMgr.getDigPower(player.digPower));
      plasticMgr.applyDigDamage(nc, nr, jetpackMgr.getDigPower(player.digPower));
    }
  }

  // Only try teleport when the player steps onto a new tile (entry detection)
  const tileChanged = player.tileX !== prevTileX || player.tileY !== prevTileY;
  prevTileX = player.tileX;
  prevTileY = player.tileY;
  if (tileChanged) {
    const teleportDest = teleportMgr.tryTeleport(player.tileX, player.tileY);
    if (teleportDest) {
      const [dc, dr] = teleportDest;
      player.x = dc * TILE_SIZE;
      player.y = dr * TILE_SIZE;
      player.tileX = dc;
      player.tileY = dr;
      player.targetTileX = dc;
      player.targetTileY = dr;
      player.pendingStop = false;
      prevTileX = dc;
      prevTileY = dr;
    }
  }
  doorSwitchMgr.endFrame();
  if ((!netMgr.connected || netMgr.isHost) && doorSwitchMgr.consumePending()) {
    doorMgr.toggle();
  }
  if (netMgr.connected && !netMgr.isHost) {
    // CLIENT: place weapons locally for visuals, AND forward to host for authoritative sim
    if (!player.dead && input.consumeWeaponSwitch())
      selectedWeapon = WEAPONS[(WEAPONS.indexOf(selectedWeapon) + 1) % WEAPONS.length];
    const netActions: string[] = [];
    if (!player.dead && input.consumeTntPress()) netActions.push(selectedWeapon);
    if (!player.dead && input.consumeDetonatePress()) netActions.push('__detonate__');
    input.consumeFireExtPress();
    input.consumeTreasurePress();
    netMgr.sendInput(inputDir as NetDir, netActions);
    // Mirror weapon placement locally so bombs/explosions are visible on client
    if (!player.dead && netActions.includes(selectedWeapon)) {
      if (selectedWeapon === "tnt") tntMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "bigcross") bigCrossMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "smallcross") smallCrossMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "grenade") grenadeMgr.place(player.x, player.y, player.dir, terrain);
      else if (selectedWeapon === "smallbomb") smallBombMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "bigbomb") bigBombMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "landmine") landmineMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "flamebomb") flameBombMgr.place(tileX, tileY, "none", terrain);
      else if (selectedWeapon === "flamethrower") flamethrowerMgr.fire(player.x, player.y, player.dir, terrain, player.moving);
      else if (selectedWeapon === "fireextinguisher")
        fireExtMgr.fire(player.x, player.y, player.dir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
      else if (selectedWeapon === "smalldetonate") smallDetMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "bigdetonate") bigDetMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "urethane") {
        if (!lavaMgr.hasSolidAt(player.tileX, player.tileY))
          urethaneMgr.place(player.x, player.y, terrain, (c, r) => plasticMgr.hasCellAt(c, r));
      } else if (selectedWeapon === "plastic") {
        if (!lavaMgr.hasSolidAt(player.tileX, player.tileY))
          plasticMgr.place(player.x, player.y, terrain, (c, r) => urethaneMgr.hasCellAt(c, r));
      } else if (selectedWeapon === "nuclear") nuclearMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "jumpingbomb") jumpingBombMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "lava") lavaMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "wall") wallMgr.place(player.tileX * TILE_SIZE, player.tileY * TILE_SIZE, terrain);
      else if (selectedWeapon === "teleport") teleportMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "barrel") barrelMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "diggerbomb") diggerBombMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "jetpack") jetpackMgr.activate();
      else if (selectedWeapon === "door") doorMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "doorswitch") doorSwitchMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "boulder") boulderMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "slime") slimeMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "brown") brownMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "grenadier") grenadierMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "grey") greyMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "clone") cloneMgr.place(player.x, player.y, terrain);
      else if (selectedWeapon === "treasure") treasureMgr.place(player.x, player.y, terrain);
      else if (PICKABLE_TYPES.includes(selectedWeapon as (typeof PICKABLE_TYPES)[number]))
        pickableMgr.place(player.x, player.y, terrain, selectedWeapon as (typeof PICKABLE_TYPES)[number]);
    }
    if (!player.dead && netActions.includes('__detonate__')) {
      smallDetMgr.detonate(terrain);
      bigDetMgr.detonate(terrain);
    }
  } else {
  // HOST or OFFLINE: place weapons in local simulation
  if (!player.dead && input.consumeWeaponSwitch()) {
    selectedWeapon = WEAPONS[(WEAPONS.indexOf(selectedWeapon) + 1) % WEAPONS.length];
  }
  if (!player.dead && input.consumeTntPress()) {
    if (selectedWeapon === "tnt") tntMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "bigcross") bigCrossMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "smallcross") smallCrossMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "grenade") grenadeMgr.place(player.x, player.y, player.dir, terrain);
    else if (selectedWeapon === "smallbomb") smallBombMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "bigbomb") bigBombMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "landmine") landmineMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "flamebomb") flameBombMgr.place(tileX, tileY, "none", terrain);
    else if (selectedWeapon === "flamethrower") flamethrowerMgr.fire(player.x, player.y, player.dir, terrain, player.moving);
    else if (selectedWeapon === "fireextinguisher")
      fireExtMgr.fire(player.x, player.y, player.dir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
    else if (selectedWeapon === "smalldetonate") smallDetMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "bigdetonate") bigDetMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "urethane") {
      if (!lavaMgr.hasSolidAt(player.tileX, player.tileY))
        urethaneMgr.place(player.x, player.y, terrain, (c, r) => plasticMgr.hasCellAt(c, r));
    } else if (selectedWeapon === "plastic") {
      if (!lavaMgr.hasSolidAt(player.tileX, player.tileY))
        plasticMgr.place(player.x, player.y, terrain, (c, r) => urethaneMgr.hasCellAt(c, r));
    } else if (selectedWeapon === "nuclear") nuclearMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "jumpingbomb") jumpingBombMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "lava") lavaMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "wall") wallMgr.place(player.tileX * TILE_SIZE, player.tileY * TILE_SIZE, terrain);
    else if (selectedWeapon === "teleport") teleportMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "barrel") barrelMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "diggerbomb") diggerBombMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "jetpack") jetpackMgr.activate();
    else if (selectedWeapon === "door") doorMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "doorswitch") doorSwitchMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "boulder") boulderMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "slime") slimeMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "brown") brownMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "grenadier") grenadierMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "grey") greyMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "clone") cloneMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === "treasure") treasureMgr.place(player.x, player.y, terrain);
    else if (PICKABLE_TYPES.includes(selectedWeapon as (typeof PICKABLE_TYPES)[number]))
      pickableMgr.place(player.x, player.y, terrain, selectedWeapon as (typeof PICKABLE_TYPES)[number]);
    if (netMgr.connected && netMgr.isHost)
      netMgr.sendWeaponAct(selectedWeapon, player.x, player.y, player.tileX, player.tileY, player.dir as NetDir, player.moving);
  }
  if (!player.dead && input.consumeFireExtPress()) {
    fireExtMgr.fire(player.x, player.y, facingDir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
    if (netMgr.connected && netMgr.isHost)
      netMgr.sendWeaponAct('__fireext__', player.x, player.y, player.tileX, player.tileY, facingDir as NetDir, player.moving);
  }
  if (!player.dead && input.consumeDetonatePress()) {
    smallDetMgr.detonate(terrain);
    bigDetMgr.detonate(terrain);
    if (netMgr.connected && netMgr.isHost)
      netMgr.sendWeaponAct('__detonate__', player.x, player.y, player.tileX, player.tileY, player.dir as NetDir, player.moving);
  }
  if (!player.dead && input.consumeTreasurePress()) {
    treasureMgr.place(player.x, player.y, terrain);
    if (netMgr.connected && netMgr.isHost)
      netMgr.sendWeaponAct('treasure', player.x, player.y, player.tileX, player.tileY, player.dir as NetDir, player.moving);
  }
  } // end host/offline weapon block

  tntMgr.update(player.x, player.y, terrain);
  // Cross bombs stop at: hard walls (border type or wall entity), closed doors, door switches.
  // Diggable terrain (rock, sand, brick) lets the arm pass through and damages them.
  const crossSolidAt = (c: number, r: number) =>
    doorMgr.hasSolidAt(c, r) ||
    doorSwitchMgr.hasSolidAt(c, r) ||
    (isStone(terrain, c, r) && !isDiggable(detailMap[r]?.[c]?.type ?? "ground"));
  bigCrossMgr.update(player.x, player.y, terrain, crossSolidAt);
  smallCrossMgr.update(player.x, player.y, terrain, crossSolidAt);
  const monsterSolid = {
    hasSolidAt: (c: number, r: number) =>
      slimeMgr.getEntities().some((s) => s.phase === "alive" && s.tileX === c && s.tileY === r) ||
      brownMgr.getEntities().some((b) => b.phase === "alive" && b.tileX === c && b.tileY === r) ||
      grenadierMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
      greyMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
      cloneMgr.getEntities().some((e) => e.phase === "alive" && e.tileX === c && e.tileY === r),
  };
  grenadeMgr.update(terrain, [
    tntMgr,
    bigCrossMgr,
    smallCrossMgr,
    smallBombMgr,
    bigBombMgr,
    landmineMgr,
    urethaneMgr,
    plasticMgr,
    nuclearMgr,
    jumpingBombMgr,
    barrelMgr,
    diggerBombMgr,
    doorMgr,
    boulderMgr,
    lavaMgr,
    treasureMgr,
    monsterSolid,
  ]);
  smallBombMgr.update(player.x, player.y, terrain);
  bigBombMgr.update(player.x, player.y, terrain);
  landmineMgr.update(player.x, player.y, terrain);
  flameBombMgr.update(player.x, player.y, terrain, (c, r) => doorMgr.hasSolidAt(c, r) || doorSwitchMgr.hasSolidAt(c, r));
  flamethrowerMgr.update(terrain);
  fireExtMgr.update();
  smallDetMgr.update(player.x, player.y, terrain);
  bigDetMgr.update(player.x, player.y, terrain);
  urethaneMgr.update();
  plasticMgr.update();
  nuclearMgr.update();
  jumpingBombMgr.update(terrain);
  const lavaBlocked = (c: number, r: number) =>
    tntMgr.hasSolidAt(c, r) ||
    bigCrossMgr.hasSolidAt(c, r) ||
    smallCrossMgr.hasSolidAt(c, r) ||
    grenadeMgr.hasSolidAt(c, r) ||
    smallBombMgr.hasSolidAt(c, r) ||
    bigBombMgr.hasSolidAt(c, r) ||
    landmineMgr.hasSolidAt(c, r) ||
    flameBombMgr.hasSolidAt(c, r) ||
    smallDetMgr.hasSolidAt(c, r) ||
    bigDetMgr.hasSolidAt(c, r) ||
    urethaneMgr.hasSolidAt(c, r) ||
    plasticMgr.hasSolidAt(c, r) ||
    nuclearMgr.hasSolidAt(c, r) ||
    jumpingBombMgr.hasSolidAt(c, r) ||
    barrelMgr.hasSolidAt(c, r) ||
    diggerBombMgr.hasSolidAt(c, r) ||
    doorMgr.hasSolidAt(c, r) ||
    doorSwitchMgr.hasSolidAt(c, r) ||
    boulderMgr.hasSolidAt(c, r) ||
    treasureMgr.hasSolidAt(c, r);
  if (!netMgr.connected || netMgr.isHost) lavaMgr.update(terrain, lavaBlocked);
  teleportMgr.update(terrain);
  barrelMgr.update(player.x, player.y, terrain);
  if (diggerBombMgr.update(player.x, player.y, terrain, detailMap)) renderer.markTerrainDirty();
  boulderMgr.update(player.x, player.y);
  const slimeSolidAt = (c: number, r: number) =>
    tntMgr.hasSolidAt(c, r) ||
    bigCrossMgr.hasSolidAt(c, r) ||
    smallCrossMgr.hasSolidAt(c, r) ||
    smallBombMgr.hasSolidAt(c, r) ||
    bigBombMgr.hasSolidAt(c, r) ||
    flameBombMgr.hasSolidAt(c, r) ||
    smallDetMgr.hasSolidAt(c, r) ||
    bigDetMgr.hasSolidAt(c, r) ||
    urethaneMgr.hasSolidAt(c, r) ||
    plasticMgr.hasSolidAt(c, r) ||
    lavaMgr.hasSolidAt(c, r) ||
    barrelMgr.hasSolidAt(c, r) ||
    diggerBombMgr.hasSolidAt(c, r) ||
    doorMgr.hasSolidAt(c, r) ||
    doorSwitchMgr.hasSolidAt(c, r) ||
    boulderMgr.hasSolidAt(c, r) ||
    slimeMgr.getEntities().some((s) => s.phase === "alive" && s.tileX === c && s.tileY === r) ||
    brownMgr.getEntities().some((b) => b.phase === "alive" && b.tileX === c && b.tileY === r) ||
    grenadierMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
    greyMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
    cloneMgr.getEntities().some((e) => e.phase === "alive" && e.tileX === c && e.tileY === r);
  const monsterApplyDig = (col: number, row: number, digPower: number): void => {
    if (applyDigDamage(detailMap, terrain, col, row, digPower)) renderer.markTerrainDirty();
  };
  if (!netMgr.connected || netMgr.isHost) {
    const allPlayerPositions = [
      ...(player.dead ? [] : [{ tileX: player.tileX, tileY: player.tileY }]),
      ...[...remotePlayers.values()].filter(rp => !rp.dead).map(rp => ({ tileX: rp.tileX, tileY: rp.tileY })),
    ];
    slimeMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of slimeMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    brownMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of brownMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    grenadierMgr.update(terrain, slimeSolidAt, allPlayerPositions, grenadeMgr, monsterApplyDig);
    for (const e of grenadierMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    greyMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of greyMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);

    // Teleport monsters that step on a teleport pad (60-frame cooldown prevents re-teleport)
    const allMonsters = [...slimeMgr.getEntities(), ...brownMgr.getEntities(), ...grenadierMgr.getEntities(), ...greyMgr.getEntities()];
    for (const m of allMonsters) {
      if (m.phase !== "alive") continue;
      if (m.teleportCooldown > 0) { m.teleportCooldown--; continue; }
      const dest = teleportMgr.tryTeleport(m.tileX, m.tileY);
      if (dest) {
        m.tileX = dest[0]; m.tileY = dest[1];
        m.x = dest[0] * TILE_SIZE; m.y = dest[1] * TILE_SIZE;
        m.targetTileX = dest[0]; m.targetTileY = dest[1];
        m.moving = false; m.teleportCooldown = 60;
      }
    }
  }

  // Monster tiles set (enemies only — clones are allies, not in this set)
  const monsterTiles = new Set([
    ...slimeMgr
      .getEntities()
      .filter((s) => s.phase === "alive")
      .map((s) => `${s.tileX},${s.tileY}`),
    ...brownMgr
      .getEntities()
      .filter((b) => b.phase === "alive")
      .map((b) => `${b.tileX},${b.tileY}`),
    ...grenadierMgr
      .getEntities()
      .filter((g) => g.phase === "alive")
      .map((g) => `${g.tileX},${g.tileY}`),
    ...greyMgr
      .getEntities()
      .filter((g) => g.phase === "alive")
      .map((g) => `${g.tileX},${g.tileY}`),
  ]);
  cloneMgr.update(terrain, slimeSolidAt, monsterTiles, treasureMgr.getEntities(), grenadeMgr, player.digPower, monsterApplyDig);
  // Clones collect treasure they walk onto
  for (const e of cloneMgr.getEntities()) {
    if (e.phase === "alive") e.cash += treasureMgr.collectAt(e.tileX, e.tileY);
  }
  landmineMgr.chainDetonate(monsterTiles, terrain);
  jetpackMgr.update();
  if (tileChanged) {
    player.cash += treasureMgr.update(player.tileX, player.tileY);
    pickableMgr.consumeByMonsters([
      ...slimeMgr.getEntities().filter((e) => e.phase === "alive"),
      ...brownMgr.getEntities().filter((e) => e.phase === "alive"),
      ...grenadierMgr.getEntities().filter((e) => e.phase === "alive"),
      ...greyMgr.getEntities().filter((e) => e.phase === "alive"),
    ]);
    for (const type of pickableMgr.update(player.tileX, player.tileY)) {
      if (type === "dig_power_1") player.digPower += 1;
      else if (type === "dig_power_2") player.digPower += 3;
      else if (type === "dig_power_3") player.digPower += 5;
      else if (type === "medpac") player.health = MAX_HEALTH;
      else if (type === "random_weapon") selectedWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
    }
  }

  // Cross-chain: all weapon fire cells can trigger each other
  const tntFire = tntMgr.getFireCells();
  const bigCrossFire = bigCrossMgr.getFireCells();
  const smallCrossFire = smallCrossMgr.getFireCells();
  const grenadeFire = grenadeMgr.getFireCells();
  const smallBombFire = smallBombMgr.getFireCells();
  const bigBombFire = bigBombMgr.getFireCells();
  const landmineFire = landmineMgr.getFireCells();
  const flameBombFire = flameBombMgr.getFireCells();
  const flamethrowerFire = flamethrowerMgr.getFireCells();
  const smallDetFire = smallDetMgr.getFireCells();
  const bigDetFire = bigDetMgr.getFireCells();
  const plasticFire = plasticMgr.getFireCells();
  const nuclearFire = nuclearMgr.getFireCells();
  const jumpingBombFire = jumpingBombMgr.getFireCells();
  const flameBarrelFire = barrelMgr.getFireCells();
  const diggerBombFire = diggerBombMgr.getFireCells();
  const allFire = new Set([
    ...tntFire,
    ...bigCrossFire,
    ...smallCrossFire,
    ...grenadeFire,
    ...smallBombFire,
    ...bigBombFire,
    ...landmineFire,
    ...flameBombFire,
    ...flamethrowerFire,
    ...smallDetFire,
    ...bigDetFire,
    ...plasticFire,
    ...nuclearFire,
    ...jumpingBombFire,
    ...teleportMgr.getFireCells(),
    ...flameBarrelFire,
    ...diggerBombFire,
  ]);
  const flameFire = new Set([...flameBombFire, ...flamethrowerFire]);
  const noTreasureFire = new Set([...flameFire, ...flameBarrelFire]);
  const explosionFire = new Set([...allFire].filter((k) => !noTreasureFire.has(k)));
  treasureMgr.applyFire(explosionFire);
  pickableMgr.applyFire(explosionFire);
  // Only flamethrower has no terrain effect; barrel explosions do affect terrain
  const noTerrainFire = new Set([...flamethrowerFire]);
  // Nuclear fire converts everything to ground; other fire degrades one step
  const nonNuclearTerrainFire = new Set([...allFire].filter((k) => !noTerrainFire.has(k) && !nuclearFire.has(k)));
  const nuclearTerrainFire = new Set([...nuclearFire].filter((k) => !noTerrainFire.has(k)));
  const newNormalCells = new Set([...nonNuclearTerrainFire].filter((k) => !activeFireCells.has(k)));
  const newNuclearCells = new Set([...nuclearTerrainFire].filter((k) => !activeFireCells.has(k)));
  if (applyExplosionToTerrain(newNormalCells, allFire, terrain, detailMap)) renderer.markTerrainDirty();
  if (applyExplosionToTerrain(newNuclearCells, allFire, terrain, detailMap, true)) renderer.markTerrainDirty();
  // Boulders hit by explosion fire become rock_destroyed_2 — must run AFTER applyExplosionToTerrain
  // so the freshly-placed rock_destroyed_2 tile isn't immediately re-degraded to ground.
  const destroyedBoulders = boulderMgr.applyFire(explosionFire);
  for (const { col, row } of destroyedBoulders) {
    const type = nuclearFire.has(`${col},${row}`) ? "ground" : "rock_destroyed_2";
    setTerrainTile(detailMap, terrain, col, row, type);
  }
  if (destroyedBoulders.length > 0) renderer.markTerrainDirty();
  // Damage is only calculated on host/offline — clients get health from state snapshots
  if (!netMgr.connected || netMgr.isHost) {
    const pt = `${player.tileX},${player.tileY}`;
    const ptt = `${player.targetTileX},${player.targetTileY}`;
    const inFire = (cells: Set<string>) => cells.has(pt) || cells.has(ptt);
    const isNew = (cells: Set<string>) => inFire(cells) && !activeFireCells.has(pt) && !activeFireCells.has(ptt);
    if (inFire(flamethrowerFire)) player.health -= 34;
    if (isNew(flameBombFire)) player.health -= 84;
    if (isNew(tntFire)) player.health -= 100;
    if (isNew(bigCrossFire)) player.health -= 200;
    if (isNew(smallCrossFire)) player.health -= 100;
    if (isNew(grenadeFire)) player.health -= 255;
    if (isNew(smallBombFire)) player.health -= 60;
    if (isNew(bigBombFire)) player.health -= 84;
    if (isNew(landmineFire)) player.health -= 60;
    if (isNew(smallDetFire)) player.health -= 84;
    if (isNew(bigDetFire)) player.health -= 100;
    if (isNew(plasticFire)) player.health -= 84;
    if (isNew(nuclearFire)) player.health -= 255;
    if (isNew(flameBarrelFire)) player.health -= 220;
    if (isNew(diggerBombFire)) player.health -= 10;
    if (isNew(jumpingBombFire)) player.health -= [60, 84, 100][Math.floor(Math.random() * 3)];
    // Monster contact damage
    if (!player.dead) {
      const ptx = player.tileX, pty = player.tileY;
      for (const s of slimeMgr.getEntities()) {
        if (s.phase === 'alive' && s.tileX === ptx && s.tileY === pty) player.health -= 1;
      }
      for (const b of brownMgr.getEntities()) {
        if (b.phase === 'alive' && b.tileX === ptx && b.tileY === pty) player.health -= 2;
      }
      for (const g of greyMgr.getEntities()) {
        if (g.phase === 'alive' && g.tileX === ptx && g.tileY === pty) player.health -= 12;
      }
      for (const e of grenadierMgr.getEntities()) {
        if (e.phase === 'alive' && e.tileX === ptx && e.tileY === pty) player.health -= 3;
      }
      for (const g of grenadeMgr.getEntities()) {
        if (g.phase === 'flying' && g.tileX === ptx && g.tileY === pty) player.health -= 255;
      }
    }
    player.health = Math.max(0, player.health);
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      player.moving = false;
      player.digging = false;
    }
  }
  if (!player.dead) deathTimer = 0;
  activeFireCells = allFire;
  lavaMgr.applyFire(allFire, terrain, (c, r) => urethaneMgr.hasSolidAt(c, r) || plasticMgr.hasSolidAt(c, r));
  slimeMgr.applyFire(allFire);
  brownMgr.applyFire(allFire);
  grenadierMgr.applyFire(allFire);
  greyMgr.applyFire(allFire);
  cloneMgr.applyFire(allFire);
  wallMgr.applyFire(allFire, terrain);
  urethaneMgr.spreadFireThrough(flameFire, allFire);
  tntMgr.chainDetonate(allFire, terrain);
  bigCrossMgr.chainDetonate(allFire, terrain, crossSolidAt);
  smallCrossMgr.chainDetonate(allFire, terrain, crossSolidAt);
  // Grenades don't chain-detonate from other grenade fire
  const allFireNoGrenade = new Set([...allFire].filter((k) => !grenadeFire.has(k)));
  grenadeMgr.chainDetonate(allFireNoGrenade, terrain);
  smallBombMgr.chainDetonate(allFire, terrain);
  bigBombMgr.chainDetonate(allFire, terrain);
  landmineMgr.chainDetonate(allFire, terrain);
  flameBombMgr.chainDetonate(allFire, terrain);
  flamethrowerMgr.chainDetonate(allFire, terrain);
  smallDetMgr.chainDetonate(allFire, terrain);
  bigDetMgr.chainDetonate(allFire, terrain);
  urethaneMgr.chainDetonate(allFire, terrain);
  plasticMgr.chainDetonate(allFire, terrain);
  nuclearMgr.chainDetonate(allFire, terrain);
  jumpingBombMgr.chainDetonate(allFire, terrain);
  teleportMgr.chainDetonate(allFire, terrain);
  barrelMgr.chainDetonate(allFire, terrain);
  if (diggerBombMgr.chainDetonate(allFire, terrain, detailMap)) renderer.markTerrainDirty();
  wallMgr.restoreTerrain(terrain);

  renderer.render(
    assets,
    terrain,
    detailMap,
    [player, ...remotePlayers.values()],
    player,
    tntMgr,
    bigCrossMgr,
    smallCrossMgr,
    grenadeMgr,
    smallBombMgr,
    bigBombMgr,
    landmineMgr,
    flameBombMgr,
    flamethrowerMgr,
    fireExtMgr,
    smallDetMgr,
    bigDetMgr,
    urethaneMgr,
    plasticMgr,
    nuclearMgr,
    jumpingBombMgr,
    lavaMgr,
    wallMgr,
    teleportMgr,
    barrelMgr,
    diggerBombMgr,
    boulderMgr,
    slimeMgr,
    brownMgr,
    grenadierMgr,
    greyMgr,
    cloneMgr,
    doorMgr,
    doorSwitchMgr,
    treasureMgr,
    pickableMgr,
    selectedWeapon,
  );

  // HOST: send terrain+detail diffs immediately, then periodic state snapshot
  if (netMgr.connected && netMgr.isHost && prevTerrain && prevDetailType) {
    const changes: TerrainChange[] = [];
    for (let r = 0; r < terrain.length; r++)
      for (let c = 0; c < terrain[r].length; c++) {
        const cellType = detailMap[r][c]?.type ?? 'ground';
        if (terrain[r][c] !== prevTerrain[r][c] || cellType !== prevDetailType[r][c]) {
          changes.push({ col: c, row: r, solid: terrain[r][c], cellType });
          prevTerrain[r][c] = terrain[r][c];
          prevDetailType[r][c] = cellType;
        }
      }
    netMgr.sendTerrainChanges(changes);
    netMgr.sendItemRemove(pickableMgr.lastRemovedIds, treasureMgr.lastRemovedIds);
    const netMonsters: NetMonster[] = [
      ...slimeMgr.getEntities().map(e => ({ kind: 'slime' as const, x: e.x, y: e.y, tileX: e.tileX, tileY: e.tileY, targetTileX: e.targetTileX, targetTileY: e.targetTileY, dir: e.dir, moving: e.moving, animFrame: e.animFrame, animTick: e.animTick, digging: e.digging, digTileX: e.digTileX, digTileY: e.digTileY, phase: e.phase, hp: e.hp })),
      ...brownMgr.getEntities().map(e => ({ kind: 'brown' as const, x: e.x, y: e.y, tileX: e.tileX, tileY: e.tileY, targetTileX: e.targetTileX, targetTileY: e.targetTileY, dir: e.dir, moving: e.moving, animFrame: e.animFrame, animTick: e.animTick, digging: e.digging, digTileX: e.digTileX, digTileY: e.digTileY, phase: e.phase, hp: 0 })),
      ...grenadierMgr.getEntities().map(e => ({ kind: 'grenadier' as const, x: e.x, y: e.y, tileX: e.tileX, tileY: e.tileY, targetTileX: e.targetTileX, targetTileY: e.targetTileY, dir: e.dir, moving: e.moving, animFrame: e.animFrame, animTick: e.animTick, digging: e.digging, digTileX: e.digTileX, digTileY: e.digTileY, phase: e.phase, hp: e.hp, shooting: e.shooting })),
      ...greyMgr.getEntities().map(e => ({ kind: 'grey' as const, x: e.x, y: e.y, tileX: e.tileX, tileY: e.tileY, targetTileX: e.targetTileX, targetTileY: e.targetTileY, dir: e.dir, moving: e.moving, animFrame: e.animFrame, animTick: e.animTick, digging: e.digging, digTileX: e.digTileX, digTileY: e.digTileY, phase: e.phase, hp: 0 })),
    ];
    netMgr.sendSnapshot([
      toNetPlayer(player, netMgr.localPlayerId),
      ...[...remotePlayers.entries()].map(([pid, rp]) => toNetPlayer(rp, pid)),
    ], netMonsters, collectPushables(), doorSwitchMgr.isOn(), doorMgr.isOpen(), collectLava());
  }

  // After render: detect game-over conditions
  if (netMgr.connected && netMgr.isHost && remotePlayers.size >= 1) {
    // Multiplayer: host triggers game over when ≤1 player alive
    const allPlayers = [player, ...remotePlayers.values()];
    if (allPlayers.filter(p => !p.dead).length <= 1) {
      deathTimer++;
      if (deathTimer >= DEATH_DELAY_FRAMES) {
        deathTimer = 0;
        netMgr.sendGameOver();
        returnToLobby();
      }
    } else {
      deathTimer = 0;
    }
  } else if (!netMgr.connected) {
    // Offline: return to lobby when local player dies
    if (player.dead) {
      deathTimer++;
      if (deathTimer >= DEATH_DELAY_FRAMES) {
        deathTimer = 0;
        returnToLobby();
      }
    } else {
      deathTimer = 0;
    }
  }
}
