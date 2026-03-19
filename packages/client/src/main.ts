import {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  PLAYER_SPEED,
  type NetPlayer,
  type NetMonster,
  type NetPushable,
  type TerrainChange,
} from "@minebombers/shared";
import { InputManager, DEFAULT_BINDINGS, type KeyBindings, type KeyActionName } from "./input.js";
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
  isHardDigTile,
  TILE_MAX_HP,
  type TerrainTileType,
} from "./terrain.js";
import { loadAssets, Assets } from "./assets.js";
import { playSound, playMenuMusic, playShopMusic, playGameMusic } from "./sound.js";
import { TntManager, type TntPhase } from "./tnt.js";
import { BigCrossManager } from "./bigcross.js";
import { GrenadeManager } from "./grenade.js";
import { BombManager, SMALL_BOMB_PATTERN, BIG_BOMB_PATTERN, type BombPhase } from "./bomb.js";
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
import { JetpackManager, BOOST_TICKS as JETPACK_BOOST_TICKS, SPEED_MULTIPLIER as JETPACK_SPEED_MULTIPLIER } from "./jetpack.js";
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

const splashEl = document.getElementById("splash-screen")!;
const mainMenuEl = document.getElementById("main-menu")!;
const infoScreenEl = document.getElementById("info-screen")!;
const menuShovelEl = document.getElementById("menu-shovel") as HTMLImageElement;
const infoImgEl = document.getElementById("info-img") as HTMLImageElement;
const shopEl = document.getElementById("shop")!;
const shopNameInput = document.getElementById("shop-name") as HTMLInputElement;
const shopGoldEl = document.getElementById("shop-gold")!;
const shopItemsCountEl = document.getElementById("shop-items-count")!;
const shopDigPowerEl = document.getElementById("shop-digpower")!;
const shopMapThumb = document.getElementById("shop-map-thumb") as HTMLCanvasElement;
const shopRoundsInput = document.getElementById("shop-rounds") as HTMLInputElement;
const shopGridEl = document.getElementById("shop-grid")!;
const shopPlayerListEl = document.getElementById("shop-player-list")!;
const shopChatLogEl = document.getElementById("shop-chat-log")!;
const shopChatInput = document.getElementById("shop-chat-input") as HTMLInputElement;
const shopLevelSelect = document.getElementById("shop-level-select") as HTMLSelectElement;
const shopMapRowEl = document.getElementById("shop-map-row") as HTMLElement;
const gameEl = document.getElementById("game")!;
const createGameEl = document.getElementById("create-game")!;
const cgShovelEl = document.getElementById("cg-shovel") as HTMLImageElement;
const cgStatusEl = document.getElementById("cg-status")!;
const joinGameEl = document.getElementById("join-game")!;
const jgHostIpInput = document.getElementById("jg-host-ip") as HTMLInputElement;
const jgStatusEl = document.getElementById("jg-status")!;
const optionsScreenEl = document.getElementById("options-screen")!;
const optFrameEl = optionsScreenEl.querySelector(".ui-frame") as HTMLElement;
const optShovelEl = document.getElementById("opt-shovel") as HTMLImageElement;
const optBarFills = [0, 1, 2, 3, 4].map((i) => document.getElementById(`opt-fill-${i}`) as HTMLDivElement);
const optBarVals = [0, 1, 2, 3, 4].map((i) => document.getElementById(`opt-val-${i}`) as HTMLSpanElement);
const optTogImgs: [HTMLImageElement, HTMLImageElement][] = [
  [document.getElementById("opt-t0-i1") as HTMLImageElement, document.getElementById("opt-t0-i2") as HTMLImageElement],
  [document.getElementById("opt-t1-i1") as HTMLImageElement, document.getElementById("opt-t1-i2") as HTMLImageElement],
  [document.getElementById("opt-t2-i1") as HTMLImageElement, document.getElementById("opt-t2-i2") as HTMLImageElement],
];

// ── Keys redefine screen ──────────────────────────────────────────────────

const keysScreenEl = document.getElementById("keys-screen")!;
const keysRowsEl = document.getElementById("keys-rows")!;

const KEYS_ACTIONS: { label: string; binding: KeyActionName }[] = [
  { label: "Left", binding: "left" },
  { label: "Right", binding: "right" },
  { label: "Up", binding: "up" },
  { label: "Down", binding: "down" },
  { label: "Stop", binding: "stop" },
  { label: "Bomb / Buy", binding: "bomb" },
  { label: "Choose / Sell", binding: "choose" },
  { label: "Remote", binding: "remote" },
];

let keysCurrentRow = -1;
let keysBoundFlags: boolean[] = new Array(8).fill(false);

function keyDisplayName(code: string): string {
  if (code === "ArrowLeft") return "LEFT";
  if (code === "ArrowRight") return "RIGHT";
  if (code === "ArrowUp") return "UP";
  if (code === "ArrowDown") return "DOWN";
  if (code.startsWith("Control")) return "CTRL";
  if (code.startsWith("Shift")) return "SHIFT";
  if (code.startsWith("Alt")) return "ALT";
  if (code === "Delete") return "DEL";
  if (code === "End") return "END";
  if (code === "PageDown") return "PGDN";
  if (code === "PageUp") return "PGUP";
  if (code === "Home") return "HOME";
  if (code === "Insert") return "INS";
  if (code === "Space") return "SPACE";
  if (code === "Enter") return "ENTER";
  if (code === "Backspace") return "BKSP";
  if (code === "Tab") return "TAB";
  if (code === "Escape") return "ESC";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "NP" + code.slice(6);
  const f = code.match(/^(F\d{1,2})$/);
  if (f) return f[1];
  return code.slice(0, 6).toUpperCase();
}

function renderKeysScreen(): void {
  const b = input.getBindings();
  keysRowsEl.innerHTML = "";
  KEYS_ACTIONS.forEach(({ label, binding }, i) => {
    const row = document.createElement("div");
    row.className = "keys-row";
    if (i === keysCurrentRow) row.classList.add("waiting");
    else if (keysBoundFlags[i]) row.classList.add("bound");

    const lbl = document.createElement("span");
    lbl.textContent = label;
    const key = document.createElement("span");
    key.textContent = keyDisplayName(b[binding]);
    row.appendChild(lbl);
    row.appendChild(key);
    keysRowsEl.appendChild(row);
  });
}

function openKeysScreen(): void {
  optionsScreenEl.style.display = "none";
  keysScreenEl.style.display = "flex";
  keysCurrentRow = 0;
  keysBoundFlags = new Array(8).fill(false);
  renderKeysScreen();
}

function closeKeysScreen(): void {
  localStorage.setItem("mb_keybindings", JSON.stringify(input.getBindings()));
  keysScreenEl.style.display = "none";
  openOptionsScreen();
}

// ── Tournament over screen ─────────────────────────────────────────────────
const tournamentOverEl = document.getElementById("tournament-over-screen")!;
const toCards = [0, 1, 2, 3].map((i) => document.getElementById(`to-p${i}`) as HTMLImageElement);
const toNames = [0, 1, 2, 3].map((i) => document.getElementById(`to-n${i}`) as HTMLSpanElement);
const toCash = [0, 1, 2, 3].map((i) => document.getElementById(`to-c${i}`) as HTMLSpanElement);
const toWins = [0, 1, 2, 3].map((i) => document.getElementById(`to-w${i}`) as HTMLSpanElement);
document.getElementById("to-click-hit")!.addEventListener("click", () => openMainMenu());

interface TournamentStat {
  name: string;
  color: number;
  totalCash: number; // player's current gold balance (startingCash + earnings - purchases)
  roundsWon: number;
  active: boolean;
}
// Indexed by slot (= player.color = 0–3)
const tournamentSlots: TournamentStat[] = [0, 1, 2, 3].map((c) => ({
  name: "",
  color: c,
  totalCash: 0,
  roundsWon: 0,
  active: false,
}));

function resetTournamentSlots(): void {
  for (const s of tournamentSlots) {
    s.name = "";
    s.totalCash = 0;
    s.roundsWon = 0;
    s.active = false;
  }
}

function setSlotActive(color: number, name: string): void {
  const s = tournamentSlots[color];
  if (!s) return;
  if (!s.active) {
    s.name = name;
    s.active = true;
  } else if (name) s.name = name;
}

function openTournamentOverScreen(): void {
  // Host: broadcast final standings, then disconnect after a short delay so the message flushes
  if (netMgr.connected && netMgr.isHost) {
    netMgr.sendTournamentOver(
      tournamentSlots.map((s) => ({
        name: s.name,
        color: s.color,
        totalCash: s.totalCash,
        roundsWon: s.roundsWon,
        active: s.active,
      })),
    );
    setTimeout(() => netMgr.disconnect(), 600);
  } else if (netMgr.connected) {
    // Client: disconnect immediately (host already sent standings)
    netMgr.disconnect();
  }

  // Determine per-player result: win = 1st place, draw = 2nd place, lose = rest
  const active = tournamentSlots.filter((s) => s.active);
  const score = (s: TournamentStat) => (tournamentConfig.winCondition === "wins" ? s.roundsWon : s.totalCash);
  const sortedScores = [...new Set(active.map(score))].sort((a, b) => b - a);
  const firstScore = sortedScores[0] ?? 0;
  const secondScore = sortedScores[1] ?? null;
  const soloWinner = active.filter((s) => score(s) === firstScore).length === 1;
  // draw tier: tied-for-first (when not solo) OR second place
  const drawScore = soloWinner ? secondScore : firstScore;
  const winScore = soloWinner ? firstScore : null; // no winner if tied at top

  for (let i = 0; i < 4; i++) {
    const s = tournamentSlots[i];
    const slot = i + 1; // player_1 … player_4
    if (!s.active) {
      toCards[i].src = "";
      toCards[i].style.display = "none";
      toNames[i].textContent = "";
      toCash[i].textContent = "";
      toWins[i].textContent = "";
    } else {
      toCards[i].style.display = "";
      const sc = score(s);
      const result = sc === winScore ? "win" : sc === drawScore ? "draw" : "lose";
      toCards[i].src = `/art/ui/tournament_over/player_${slot}_${result}.png`;
      toNames[i].textContent = s.name || `Player ${slot}`;
      toCash[i].textContent = `$${s.totalCash}`;
      toWins[i].textContent = `${s.roundsWon}/${tournamentConfig.rounds}`;
    }
  }

  tournamentOverEl.style.display = "flex";
  playSound("APPLAUSE", 0);
}

const levelData = new Map<string, Uint8Array>();
let selectedLevel: string | null = null;
let cachedRandomLevel: ReturnType<typeof generateRandomLevel> | null = null;

function refreshRandomMap(): void {
  const allKeys = [null, ...levelData.keys()];
  const picked = allKeys[Math.floor(Math.random() * allKeys.length)];
  if (picked && levelData.has(picked)) {
    cachedRandomLevel = null;
    updateShopMapThumb(buildThumbnail(levelData.get(picked)!));
  } else {
    cachedRandomLevel = generateRandomLevel(tournamentConfig.treasures);
    updateShopMapThumb(buildThumbnailFromParsed(cachedRandomLevel));
  }
}

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
// Per-player jetpack remaining ticks for remote players (keyed by player ID)
const remoteJetpackTicks = new Map<number, number>();
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
let prevBurnedGround: boolean[][] | null = null;

// ── Lobby player list ─────────────────────────────────────────────────────────

const PLAYER_COLORS = ["#4040ff", "#ff4040", "#40c040", "#c0a000"];
const lobbyPlayers = new Map<number, { name: string; color: number; isReady?: boolean }>();

// ── Tournament config ─────────────────────────────────────────────────────────

const tournamentConfig = {
  rounds: 15,
  startingCash: 750,
  treasures: 45,
  timeLimitSec: 7 * 60,
  bombDamagePct: 100,
  freeMarker: false,
  selling: false,
  winCondition: "money" as "money" | "wins",
};

// ── Persistence ───────────────────────────────────────────────────────────────

function saveSettings(): void {
  localStorage.setItem("mb_config", JSON.stringify(tournamentConfig));
  localStorage.setItem("mb_player_name", shopNameInput.value);
}

function loadSettings(): void {
  try {
    const raw = localStorage.getItem("mb_config");
    if (raw) Object.assign(tournamentConfig, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  const savedName = localStorage.getItem("mb_player_name");
  if (savedName) shopNameInput.value = savedName;
  try {
    const rawKeys = localStorage.getItem("mb_keybindings");
    if (rawKeys) input.setBindings(JSON.parse(rawKeys) as Partial<KeyBindings>);
  } catch {
    /* ignore */
  }
}

const OPT_DEFAULTS = {
  startingCash: 750,
  treasures: 45,
  rounds: 15,
  timeLimitSec: 7 * 60,
  bombDamagePct: 100,
  freeMarker: false,
  selling: false,
  winCondition: "money" as "money" | "wins",
};

// ── Options screen ────────────────────────────────────────────────────────────

const OPT_BAR_MAX_W = 166;

interface BarOptItem {
  type: "bar";
  field: "startingCash" | "treasures" | "rounds" | "timeLimitSec" | "bombDamagePct";
  barIdx: number;
  min: number;
  max: number;
  step: number;
  rowY: number;
}
interface TogOptItem {
  type: "toggle";
  field: "freeMarker" | "selling";
  togIdx: number;
  rowY: number;
}
interface WinOptItem {
  type: "winner";
  togIdx: number;
  rowY: number;
}
interface ActOptItem {
  type: "action";
  rowY: number;
}
interface KeysOptItem {
  type: "keys";
  togIdx: number;
  rowY: number;
}
type OptItem = BarOptItem | TogOptItem | WinOptItem | ActOptItem | KeysOptItem;

const OPT_ITEMS: OptItem[] = [
  { type: "bar", field: "startingCash", barIdx: 0, min: 50, max: 2650, step: 50, rowY: 108 },
  { type: "bar", field: "treasures", barIdx: 1, min: 0, max: 75, step: 5, rowY: 132 },
  { type: "bar", field: "rounds", barIdx: 2, min: 1, max: 30, step: 1, rowY: 156 },
  { type: "bar", field: "timeLimitSec", barIdx: 3, min: 60, max: 22 * 60, step: 60, rowY: 180 },
  { type: "bar", field: "bombDamagePct", barIdx: 4, min: 10, max: 100, step: 10, rowY: 203 },
  { type: "toggle", field: "freeMarker", togIdx: 0, rowY: 223 },
  { type: "toggle", field: "selling", togIdx: 1, rowY: 247 },
  { type: "winner", togIdx: 2, rowY: 274 },
  { type: "keys", togIdx: 2, rowY: 302 },
  { type: "action", rowY: 328 },
];

let optSelectedIdx = 0;

function renderOptions(): void {
  optShovelEl.style.top = `${OPT_ITEMS[optSelectedIdx].rowY}px`;

  for (const item of OPT_ITEMS) {
    if (item.type === "bar") {
      const val = tournamentConfig[item.field];
      const fillW = Math.round(((val - item.min) / (item.max - item.min)) * OPT_BAR_MAX_W);
      optBarFills[item.barIdx].style.width = `${fillW}px`;
      optBarFills[item.barIdx].style.top = `${item.rowY - 7}px`;
      const label = item.field === "timeLimitSec" ? `${val / 60}MIN` : item.field === "bombDamagePct" ? `${val}%` : String(val);
      optBarVals[item.barIdx].textContent = label;
      optBarVals[item.barIdx].style.top = `${item.rowY}px`;
      if (item.field === "rounds") shopRoundsInput.value = String(val);
    } else if (item.type === "toggle") {
      const val = tournamentConfig[item.field];
      optTogImgs[item.togIdx][0].src = val ? "/art/ui/options/option_on.png" : "/art/ui/options/option_off.png";
      optTogImgs[item.togIdx][1].src = val ? "/art/ui/options/option_off.png" : "/art/ui/options/option_on.png";
    } else if (item.type === "winner") {
      const isMoney = tournamentConfig.winCondition === "money";
      optTogImgs[item.togIdx][0].src = isMoney ? "/art/ui/options/option_on.png" : "/art/ui/options/option_off.png";
      optTogImgs[item.togIdx][1].src = isMoney ? "/art/ui/options/option_off.png" : "/art/ui/options/option_on.png";
    }
  }
}

function openOptionsScreen(): void {
  mainMenuEl.style.display = "none";
  infoScreenEl.style.display = "none";
  createGameEl.style.display = "none";
  joinGameEl.style.display = "none";
  shopEl.style.display = "none";
  gameEl.style.display = "none";
  keysScreenEl.style.display = "none";
  optionsScreenEl.style.display = "flex";
  optSelectedIdx = 0;
  renderOptions();
}

function optFrameCoords(e: MouseEvent): { x: number; y: number } {
  const rect = optFrameEl.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / (rect.width / 640), y: (e.clientY - rect.top) / (rect.height / 480) };
}

function optNearestIdx(frameY: number): number {
  let best = 0,
    bestDist = Infinity;
  for (let i = 0; i < OPT_ITEMS.length; i++) {
    const d = Math.abs(OPT_ITEMS[i].rowY - frameY);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

optFrameEl.addEventListener("mousemove", (e) => {
  const { y } = optFrameCoords(e);
  optSelectedIdx = optNearestIdx(y);
  renderOptions();
});

optFrameEl.addEventListener("click", (e) => {
  const { x, y } = optFrameCoords(e);
  optSelectedIdx = optNearestIdx(y);
  const item = OPT_ITEMS[optSelectedIdx];
  if (item.type === "bar") {
    const ratio = Math.max(0, Math.min(1, (x - 334) / OPT_BAR_MAX_W));
    const raw = item.min + ratio * (item.max - item.min);
    tournamentConfig[item.field] = (Math.round(raw / item.step) * item.step) as never;
  } else if (item.type === "toggle") {
    tournamentConfig[item.field] = !tournamentConfig[item.field] as never;
  } else if (item.type === "winner") {
    tournamentConfig.winCondition = tournamentConfig.winCondition === "money" ? "wins" : "money";
  } else if (item.type === "keys") {
    openKeysScreen();
    return;
  } else if (item.type === "action") {
    openMainMenu();
    return;
  }
  renderOptions();
  saveSettings();
});

loadSettings();
shopRoundsInput.value = String(tournamentConfig.rounds);

// ── Shop state ────────────────────────────────────────────────────────────────

const SHOP_ITEMS = [
  { id: "smallbomb", icon: "small_bomb", price: 1, label: "SM BOMB" },
  { id: "bigbomb", icon: "big_bomb", price: 3, label: "BIG BOMB" },
  { id: "tnt", icon: "tnt", price: 10, label: "TNT" },
  { id: "nuclear", icon: "nuclear", price: 650, label: "NUCLEAR" },
  { id: "smalldetonate", icon: "small_detonate", price: 15, label: "SM DET" },
  { id: "bigdetonate", icon: "big_detonate", price: 65, label: "BIG DET" },
  { id: "grenade", icon: "grenade", price: 300, label: "GRENADE" },
  { id: "landmine", icon: "landmine", price: 25, label: "LANDMINE" },
  { id: "flamethrower", icon: "flamethrower", price: 500, label: "FLMTHRWR" },
  { id: "flamebomb", icon: "flame_bomb", price: 80, label: "FL BOMB" },
  { id: "barrel", icon: "barrel", price: 90, label: "BARREL" },
  { id: "smallcross", icon: "small_cross", price: 35, label: "SM CROSS" },
  { id: "bigcross", icon: "big_cross", price: 145, label: "BIG CROSS" },
  { id: "urethane", icon: "urethane", price: 15, label: "URETHANE" },
  { id: "plastic", icon: "plastic", price: 80, label: "PLASTIC" },
  { id: "diggerbomb", icon: "digger_bomb", price: 120, label: "DIGGER" },
  { id: "wall", icon: "wall", price: 50, label: "WALL" },
  { id: "dig_power_1", icon: "dig_power_1", price: 400, label: "+1 DIG" },
  { id: "dig_power_2", icon: "dig_power_2", price: 1100, label: "+3 DIG" },
  { id: "dig_power_3", icon: "dig_power_3", price: 1600, label: "+5 DIG" },
  { id: "teleport", icon: "teleport", price: 70, label: "TELEPORT" },
  { id: "clone", icon: "clone", price: 400, label: "CLONE" },
  { id: "lava", icon: "lava", price: 50, label: "LAVA" },
  { id: "fireextinguisher", icon: "fire_extinguisher", price: 80, label: "FIRE EXT" },
  { id: "armor", icon: "armor", price: 800, label: "ARMOR" },
  { id: "jumpingbomb", icon: "jumping_bomb", price: 95, label: "JUMP BMB" },
  { id: "jetpack", icon: "jetpack", price: 575, label: "JETPACK" },
  { id: "__ready__", icon: "ready", price: -1, label: "READY" },
] as const;

let shopSelectedIdx = 0;
let playerGold = tournamentConfig.startingCash;
let playerIsReady = false;
const playerInventory = new Map<string, number>();
let carryOverDigPower = 1; // dig power carried from previous round (1 = no carry-over / died)
let currentRound = 0;
let roundsWon = 0;
let roundTick = 0;
let priceMultiplier = 1.0;

// Client-side prediction
let inputSeq = 0;
interface InputSnapshot {
  seq: number;
  dir: Dir;
  stopPressed: boolean;
}
const inputBuffer: InputSnapshot[] = [];
let pendingHostPlayerState: import("@minebombers/shared").NetPlayer | null = null;

const DEBUG_RECONCILIATION = true;
const inputSendTimes = new Map<number, number>(); // seq → Date.now() when sent
let pingMs = 0;

function getEffectivePrice(basePrice: number): number {
  return basePrice < 0 ? basePrice : Math.round(basePrice * priceMultiplier);
}

function bombDmg(base: number): number {
  return Math.round((base * tournamentConfig.bombDamagePct) / 100);
}

function updateShopPrices(): void {
  const cells = shopGridEl.querySelectorAll<HTMLElement>(".shop-item");
  cells.forEach((cell, idx) => {
    const item = SHOP_ITEMS[idx];
    const priceEl = cell.querySelector<HTMLElement>(".shop-item-price");
    if (priceEl && item.price >= 0) priceEl.textContent = `$${getEffectivePrice(item.price)}`;
  });
}

function buildShopGrid(): void {
  shopGridEl.innerHTML = "";
  SHOP_ITEMS.forEach((item, idx) => {
    const cell = document.createElement("div");
    cell.className = item.id === "__ready__" ? "shop-item shop-item--ready" : "shop-item";
    cell.dataset.idx = String(idx);

    const bg = document.createElement("img");
    bg.className = "shop-item-bg";
    bg.src = "/art/ui/shop/item_frame.png";
    cell.appendChild(bg);

    const icon = document.createElement("img");
    icon.className = "shop-item-icon";
    icon.src = `/art/ui/shop/${item.icon}.png`;
    cell.appendChild(icon);

    if (item.price >= 0) {
      const price = document.createElement("span");
      price.className = "shop-item-price";
      price.textContent = `$${item.price}`;
      cell.appendChild(price);
    }

    const bar = document.createElement("div");
    bar.className = "shop-item-bar";
    const barFill = document.createElement("div");
    barFill.className = "shop-item-bar-fill";
    bar.appendChild(barFill);
    cell.appendChild(bar);

    cell.addEventListener("mouseenter", () => {
      shopSelectedIdx = idx;
      updateShopGrid();
    });
    cell.addEventListener("click", () => {
      shopSelectedIdx = idx;
      updateShopGrid();
      buySelectedItem();
    });
    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      shopSelectedIdx = idx;
      updateShopGrid();
      sellSelectedItem();
    });

    shopGridEl.appendChild(cell);
  });
}

function updateShopGrid(): void {
  const cells = shopGridEl.querySelectorAll<HTMLElement>(".shop-item");
  cells.forEach((cell, idx) => {
    const bg = cell.querySelector<HTMLImageElement>(".shop-item-bg")!;
    const isSelected = idx === shopSelectedIdx;
    const item = SHOP_ITEMS[idx];
    const isReady = item.id === "__ready__" && playerIsReady;
    bg.src = isSelected || isReady ? "/art/ui/shop/item_frame_selected.png" : "/art/ui/shop/item_frame.png";
    if (item.id === "__ready__") {
      cell.classList.toggle("is-ready", playerIsReady);
      cell.classList.toggle("has-items", playerInventory.size > 0);
    }

    const owned = playerInventory.get(item.id) ?? 0;
    const barFill = cell.querySelector<HTMLElement>(".shop-item-bar-fill")!;
    const fillPct = owned > 0 ? Math.max(Math.min(owned / 20, 1) * 100, 8) : 0;
    barFill.style.height = `${fillPct}%`;

    if (idx === shopSelectedIdx) {
      shopItemsCountEl.textContent = String(owned);
    }
  });
}

function buySelectedItem(): void {
  const item = SHOP_ITEMS[shopSelectedIdx];
  if (item.id === "__ready__") {
    toggleReady();
    return;
  }
  const price = getEffectivePrice(item.price);
  if (playerGold >= price) {
    playerGold -= price;
    playerInventory.set(item.id, (playerInventory.get(item.id) ?? 0) + 1);
    shopGoldEl.textContent = String(playerGold);
    const total = [...playerInventory.values()].reduce((a, b) => a + b, 0);
    shopItemsCountEl.textContent = String(total);
    const previewDigPower =
      carryOverDigPower +
      (playerInventory.get("dig_power_1") ?? 0) * 1 +
      (playerInventory.get("dig_power_2") ?? 0) * 3 +
      (playerInventory.get("dig_power_3") ?? 0) * 5;
    shopDigPowerEl.textContent = String(previewDigPower);
    updateShopGrid();
  }
}

function sellSelectedItem(): void {
  if (!tournamentConfig.selling) return;
  const item = SHOP_ITEMS[shopSelectedIdx];
  if (item.price < 0 || item.id === "__ready__") return;
  const owned = playerInventory.get(item.id) ?? 0;
  if (owned <= 0) return;
  playerInventory.set(item.id, owned - 1);
  playerGold += Math.round(getEffectivePrice(item.price) / 2);
  shopGoldEl.textContent = String(playerGold);
  const previewDigPower =
    carryOverDigPower +
    (playerInventory.get("dig_power_1") ?? 0) * 1 +
    (playerInventory.get("dig_power_2") ?? 0) * 3 +
    (playerInventory.get("dig_power_3") ?? 0) * 5;
  shopDigPowerEl.textContent = String(previewDigPower);
  updateShopGrid();
}

function toggleReady(): void {
  playerIsReady = !playerIsReady;
  updateShopGrid();
  if (netMgr.connected && !netMgr.isHost) {
    netMgr.sendReady(playerIsReady);
  } else if (netMgr.connected && netMgr.isHost) {
    const entry = lobbyPlayers.get(netMgr.localPlayerId);
    if (entry) entry.isReady = playerIsReady;
    renderShopPlayerList();
    broadcastLobby();
    checkAllReady();
  } else {
    // Offline: READY starts immediately
    startGameFromLobby();
  }
}

function checkAllReady(): void {
  if (!netMgr.connected || !netMgr.isHost) return;
  if (!assetsReady) return;
  const allReady = [...lobbyPlayers.values()].every((p) => p.isReady === true);
  if (allReady && lobbyPlayers.size >= 1) {
    startGameFromLobby();
  }
}

function startGameFromLobby(): void {
  if (!assetsReady) return;
  player.name = shopNameInput.value.trim() || "Player";
  setSlotActive(player.color, player.name);

  const resolvedLevel =
    selectedLevel === "__random__" ? [null, ...levelData.keys()][Math.floor(Math.random() * (levelData.size + 1))] : selectedLevel;
  const isLoadedMap = !!(resolvedLevel && levelData.has(resolvedLevel));
  const parsed = isLoadedMap
    ? parseMneLevel(levelData.get(resolvedLevel!)!)
    : (cachedRandomLevel ?? generateRandomLevel(tournamentConfig.treasures));
  cachedRandomLevel = null;
  applyParsedLevel(parsed);

  if (netMgr.connected && netMgr.isHost) {
    // Randomly assign corners to players, then clear L-shaped entrance arms
    const allPids = [netMgr.localPlayerId, ...remotePlayers.keys()];
    const playerSpawns = assignRandomSpawns(allPids);

    if (!isLoadedMap) {
      const clearSpawnTile = (r: number, c: number) => {
        if (r > 0 && c > 0 && r < MAP_HEIGHT - 1 && c < MAP_WIDTH - 1) setTerrainTile(detailMap, terrain, c, r, "ground");
      };
      const armLen = () => 4 + Math.floor(Math.random() * 6); // 4–9 tiles, same as level generator
      for (const pid of allPids) {
        const [sx, sy] = spawnPos(pid);
        const hSign = sx === 1 ? 1 : -1;
        const vSign = sy === 1 ? 1 : -1;
        const hLen = armLen();
        const vLen = armLen();
        for (let i = 0; i <= hLen; i++) clearSpawnTile(sy, sx + i * hSign);
        for (let i = 1; i <= vLen; i++) clearSpawnTile(sy + i * vSign, sx);
      }
    }
    renderer.markTerrainDirty();
    // Update remote players to their assigned spawn positions on the host
    for (const [pid, rp] of remotePlayers) {
      const [sx, sy] = spawnPos(pid);
      rp.x = sx * TILE_SIZE;
      rp.y = sy * TILE_SIZE;
      rp.tileX = sx;
      rp.tileY = sy;
      rp.targetTileX = sx;
      rp.targetTileY = sy;
    }
    const [tx, ty] = spawnPos(netMgr.localPlayerId);
    player.x = tx * TILE_SIZE;
    player.y = ty * TILE_SIZE;
    player.tileX = tx;
    player.tileY = ty;
    player.targetTileX = tx;
    player.targetTileY = ty;
    prevTileX = tx;
    prevTileY = ty;
    netMgr.sendInit({
      terrain: terrain.map((row) => [...row]),
      detailMap: detailMap.map((row) => row.map((c) => ({ type: c.type, hp: c.hp }))),
      entities: parsed.entities,
      spawnCol: parsed.spawnCol,
      spawnRow: parsed.spawnRow,
      playerSpawns,
    });
    prevTerrain = terrain.map((row) => [...row]);
    prevDetailType = detailMap.map((row) => row.map((c) => c.type));
    prevBurnedGround = detailMap.map((row) => row.map((c) => !!c.burnedGround));
  } else {
    // Offline: assign a random corner for the solo player and clear their spawn
    assignRandomSpawns([1]);
    const [tx, ty] = spawnPos(1);
    if (!isLoadedMap) {
      const hSign = tx === 1 ? 1 : -1;
      const vSign = ty === 1 ? 1 : -1;
      const armLen = () => 4 + Math.floor(Math.random() * 6);
      const hLen = armLen(),
        vLen = armLen();
      const clearSpawnTile = (r: number, c: number) => {
        if (r > 0 && c > 0 && r < MAP_HEIGHT - 1 && c < MAP_WIDTH - 1) setTerrainTile(detailMap, terrain, c, r, "ground");
      };
      for (let i = 0; i <= hLen; i++) clearSpawnTile(ty, tx + i * hSign);
      for (let i = 1; i <= vLen; i++) clearSpawnTile(ty + i * vSign, tx);
      renderer.markTerrainDirty();
    }
    player.x = tx * TILE_SIZE;
    player.y = ty * TILE_SIZE;
    player.tileX = tx;
    player.tileY = ty;
    player.targetTileX = tx;
    player.targetTileY = ty;
    prevTileX = tx;
    prevTileY = ty;
  }

  startGame();
}

function renderShopPlayerList(): void {
  shopPlayerListEl.innerHTML = "";
  for (const [id, p] of lobbyPlayers) {
    const div = document.createElement("div");
    div.className = "shop-lobby-player";

    const dot = document.createElement("span");
    dot.className = "shop-player-dot";
    dot.style.background = PLAYER_COLORS[p.color] ?? "#fff";
    div.appendChild(dot);

    const nameSp = document.createElement("span");
    nameSp.textContent = p.name || `Player ${id}`;
    div.appendChild(nameSp);

    if (id === netMgr.localPlayerId) {
      const youTag = document.createElement("span");
      youTag.className = "shop-you-tag";
      youTag.textContent = "(you)";
      div.appendChild(youTag);
    }

    if (id === 1 || (netMgr.isHost && id === netMgr.localPlayerId)) {
      const hostTag = document.createElement("span");
      hostTag.className = "shop-you-tag";
      hostTag.textContent = "(host)";
      div.appendChild(hostTag);
    }

    if (p.isReady) {
      const readyTag = document.createElement("span");
      readyTag.className = "shop-ready-tag";
      readyTag.textContent = "✓ READY";
      div.appendChild(readyTag);
    }

    shopPlayerListEl.appendChild(div);
  }
}

function addChatMessage(name: string, text: string, color?: number): void {
  const line = document.createElement("div");
  line.className = "shop-chat-line";
  const nameSpan = document.createElement("span");
  nameSpan.className = "shop-chat-name";
  nameSpan.textContent = name + ":";
  if (color !== undefined) nameSpan.style.color = PLAYER_COLORS[color] ?? "#ffcc44";
  const textSpan = document.createElement("span");
  textSpan.textContent = " " + text;
  line.appendChild(nameSpan);
  line.appendChild(textSpan);
  shopChatLogEl.appendChild(line);
  shopChatLogEl.scrollTop = shopChatLogEl.scrollHeight;
}

function updateShopMapThumb(thumbCanvas: HTMLCanvasElement): void {
  const ctx = shopMapThumb.getContext("2d")!;
  shopMapThumb.width = thumbCanvas.width;
  shopMapThumb.height = thumbCanvas.height;
  ctx.drawImage(thumbCanvas, 0, 0);
}

function broadcastLobby(): void {
  if (!netMgr.connected || !netMgr.isHost) return;
  netMgr.sendLobby([...lobbyPlayers.entries()].map(([id, p]) => ({ id, ...p })));
}

shopNameInput.addEventListener("input", () => {
  saveSettings();
  const name = shopNameInput.value.trim() || "Player";
  player.name = name;
  lobbyPlayers.set(netMgr.localPlayerId, {
    name,
    color: player.color,
    isReady: lobbyPlayers.get(netMgr.localPlayerId)?.isReady,
  });
  renderShopPlayerList();
  if (netMgr.connected) {
    if (netMgr.isHost) broadcastLobby();
    else netMgr.sendName(name);
  }
});

function sendChatMsg(): void {
  const text = shopChatInput.value.trim();
  if (!text) return;
  shopChatInput.value = "";
  const name = shopNameInput.value.trim() || "Player";
  if (netMgr.connected) {
    netMgr.sendChat(name, text, netMgr.localPlayerId);
    if (netMgr.isHost) addChatMessage(name, text, player.color);
  } else {
    addChatMessage(name, text, player.color);
  }
}

document.getElementById("shop-chat-send")!.addEventListener("click", sendChatMsg);
shopChatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMsg();
});

// Randomised per-game corner assignments. Populated by host in startGameFromLobby()
// and by clients in onInitData(). Falls back to fixed corners if not yet populated.
const CORNER_POSITIONS: [number, number][] = [
  [1, 1],
  [MAP_WIDTH - 2, 1],
  [1, MAP_HEIGHT - 2],
  [MAP_WIDTH - 2, MAP_HEIGHT - 2],
];
const playerSpawnMap = new Map<number, [number, number]>();

function spawnPos(playerId: number): [number, number] {
  return playerSpawnMap.get(playerId) ?? CORNER_POSITIONS[(playerId - 1) % 4];
}

function assignRandomSpawns(playerIds: number[]): Array<{ playerId: number; col: number; row: number }> {
  const available = [...CORNER_POSITIONS] as [number, number][];
  playerSpawnMap.clear();
  const result: Array<{ playerId: number; col: number; row: number }> = [];
  for (const playerId of playerIds) {
    const idx = Math.floor(Math.random() * available.length);
    const [col, row] = available[idx];
    available.splice(idx, 1); // remove so no other player can get the same corner
    playerSpawnMap.set(playerId, [col, row]);
    result.push({ playerId, col, row });
  }
  return result;
}

function toNetPlayer(p: LocalPlayer, id: number, lastInputSeq = 0): NetPlayer {
  return {
    id,
    x: p.x,
    y: p.y,
    tileX: p.tileX,
    tileY: p.tileY,
    targetTileX: p.targetTileX,
    targetTileY: p.targetTileY,
    dir: p.dir as NetDir,
    animFrame: p.animFrame,
    moving: p.moving,
    digging: p.digging,
    health: p.health,
    dead: p.dead,
    color: p.color,
    name: p.name,
    cash: p.cash,
    digPower: p.digPower,
    lastInputSeq,
  };
}

// HOST: place a weapon on behalf of a remote player
function applyRemoteWeapon(
  rp: { x: number; y: number; tileX: number; tileY: number; dir: Dir; moving: boolean },
  action: string,
  ownerId = 0,
  actorColor = 0,
): void {
  // Parse optional tile-position suffix: "tnt@12:8" → weapon="tnt", placeTileX=12, placeTileY=8
  const atIdx = action.indexOf("@");
  let weapon = action,
    placeTileX = rp.tileX,
    placeTileY = rp.tileY;
  if (atIdx !== -1) {
    weapon = action.slice(0, atIdx);
    const parts = action.slice(atIdx + 1).split(":");
    placeTileX = parseInt(parts[0], 10);
    placeTileY = parseInt(parts[1], 10);
    action = weapon; // normalise for comparisons below
  }
  const tx = placeTileX * TILE_SIZE,
    ty = placeTileY * TILE_SIZE;
  if (action === "__detonate__") {
    smallDetMgr.detonate(terrain);
    bigDetMgr.detonate(terrain);
  } else if (action === "__fireext__") {
    fireExtMgr.fire(rp.x, rp.y, rp.dir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], rp.moving);
  } else if (action === "tnt") tntMgr.place(tx, ty, "none", terrain);
  else if (action === "bigcross") bigCrossMgr.place(tx, ty, "none", terrain);
  else if (action === "smallcross") smallCrossMgr.place(tx, ty, "none", terrain);
  else if (action === "grenade") grenadeMgr.place(rp.x, rp.y, rp.dir, terrain);
  else if (action === "smallbomb") smallBombMgr.place(tx, ty, "none", terrain);
  else if (action === "bigbomb") bigBombMgr.place(tx, ty, "none", terrain);
  else if (action === "flamebomb") flameBombMgr.place(tx, ty, "none", terrain);
  else if (action === "flamethrower") flamethrowerMgr.fire(rp.x, rp.y, rp.dir, terrain, rp.moving);
  else if (action === "smalldetonate") smallDetMgr.place(rp.x, rp.y, terrain, actorColor);
  else if (action === "bigdetonate") bigDetMgr.place(rp.x, rp.y, terrain, actorColor);
  else if (action === "urethane") {
    if (!lavaMgr.hasSolidAt(rp.tileX, rp.tileY)) urethaneMgr.place(rp.x, rp.y, terrain, (c, r) => plasticMgr.hasCellAt(c, r));
  } else if (action === "plastic") {
    if (!lavaMgr.hasSolidAt(rp.tileX, rp.tileY)) plasticMgr.place(rp.x, rp.y, terrain, (c, r) => urethaneMgr.hasCellAt(c, r));
  } else if (action === "nuclear") nuclearMgr.place(rp.x, rp.y, terrain);
  else if (action === "jumpingbomb") jumpingBombMgr.place(rp.x, rp.y, terrain);
  else if (action === "lava") lavaMgr.place(rp.x, rp.y, terrain);
  else if (action === "wall") wallMgr.place(tx, ty, terrain);
  else if (action === "teleport") teleportMgr.place(rp.x, rp.y, terrain);
  else if (action === "barrel") barrelMgr.place(rp.x, rp.y, terrain);
  else if (action === "diggerbomb") diggerBombMgr.place(rp.x, rp.y, terrain);
  else if (action === "door") doorMgr.place(rp.x, rp.y, terrain);
  else if (action === "doorswitch") doorSwitchMgr.place(rp.x, rp.y, terrain);
  else if (action === "boulder") boulderMgr.place(rp.x, rp.y, terrain);
  else if (action === "slime") slimeMgr.place(rp.x, rp.y, terrain);
  else if (action === "brown") brownMgr.place(rp.x, rp.y, terrain);
  else if (action === "grenadier") grenadierMgr.place(rp.x, rp.y, terrain);
  else if (action === "grey") greyMgr.place(rp.x, rp.y, terrain);
  else if (action === "clone") {
    if (!netMgr.connected || netMgr.isHost) cloneMgr.place(rp.x, rp.y, terrain, ownerId, actorColor);
  } else if (action === "clone_grenade" || action === "grenadier_grenade")
    grenadeMgr.placeAt(rp.tileX, rp.tileY, rp.dir as Exclude<Dir, "none">, terrain);
  else if (action === "treasure") treasureMgr.place(rp.x, rp.y, terrain);
  else if (action === "landmine") landmineMgr.place(rp.x, rp.y, terrain);
  else if (action === "landmine_trigger") landmineMgr.triggerAt(rp.tileX, rp.tileY, terrain);
  else if (PICKABLE_TYPES.includes(action as (typeof PICKABLE_TYPES)[number]))
    pickableMgr.place(rp.x, rp.y, terrain, action as (typeof PICKABLE_TYPES)[number]);
  else if (action === "jetpack") remoteJetpackTicks.set(ownerId, JETPACK_BOOST_TICKS);

  // HOST: broadcast all remote weapon placements so every client can place the entity locally.
  // Use the parsed placeTileX/placeTileY so the echoed position matches the client-side placement.
  if (netMgr.connected && netMgr.isHost && action !== "__detonate__")
    netMgr.sendWeaponAct(action, rp.x, rp.y, placeTileX, placeTileY, rp.dir as NetDir, rp.moving, actorColor, ownerId);
}

function applyParsedLevel(parsed: ReturnType<typeof parseMneLevel>): void {
  // Clear all managers so previous-round entities don't persist
  tntMgr.clear();
  bigCrossMgr.clear();
  smallCrossMgr.clear();
  grenadeMgr.clear();
  smallBombMgr.clear();
  bigBombMgr.clear();
  landmineMgr.clear();
  flameBombMgr.clear();
  flamethrowerMgr.clear();
  fireExtMgr.clear();
  smallDetMgr.clear();
  bigDetMgr.clear();
  urethaneMgr.clear();
  plasticMgr.clear();
  nuclearMgr.clear();
  jumpingBombMgr.clear();
  lavaMgr.clear();
  wallMgr.clear();
  teleportMgr.clear();
  barrelMgr.clear();
  diggerBombMgr.clear();
  jetpackMgr.clear();
  remoteJetpackTicks.clear();
  doorMgr.clear();
  doorSwitchMgr.clear();
  boulderMgr.clear();
  slimeMgr.clear();
  brownMgr.clear();
  grenadierMgr.clear();
  greyMgr.clear();
  treasureMgr.clear();
  pickableMgr.clear();
  cloneMgr.clear();

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
      case "wall":
        wallMgr.place(px, py, terrain);
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
  // Populate dropdown: first option is RANDOM
  const randomOpt = document.createElement("option");
  randomOpt.value = "";
  randomOpt.textContent = "DEFAULT";
  shopLevelSelect.appendChild(randomOpt);

  const trueRandomOpt = document.createElement("option");
  trueRandomOpt.value = "__random__";
  trueRandomOpt.textContent = "RANDOM";
  shopLevelSelect.appendChild(trueRandomOpt);

  // Generate random level and show thumbnail immediately
  cachedRandomLevel = generateRandomLevel(tournamentConfig.treasures);
  updateShopMapThumb(buildThumbnailFromParsed(cachedRandomLevel));

  const results = await Promise.allSettled(
    LEVEL_NAMES.map(async (name) => {
      const resp = await fetch(`/levels/${name}.MNE`);
      if (!resp.ok) throw new Error(`${name} not found`);
      return { name, data: new Uint8Array(await resp.arrayBuffer()) };
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { name, data } = result.value;
    levelData.set(name, data);
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    shopLevelSelect.appendChild(opt);
  }

  shopLevelSelect.addEventListener("change", () => {
    selectedLevel = shopLevelSelect.value || null;
    if (selectedLevel === "__random__") {
      refreshRandomMap();
    } else if (selectedLevel && levelData.has(selectedLevel)) {
      updateShopMapThumb(buildThumbnail(levelData.get(selectedLevel)!));
    } else {
      cachedRandomLevel = generateRandomLevel(tournamentConfig.treasures);
      updateShopMapThumb(buildThumbnailFromParsed(cachedRandomLevel));
    }
    if (netMgr.connected && netMgr.isHost) netMgr.sendMapSelect(selectedLevel);
  });
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

const RANDOM_WEAPON_POOL: WeaponName[] = [
  "bigbomb",
  "smallbomb",
  "nuclear",
  "tnt",
  "bigcross",
  "smallcross",
  "flamethrower",
  "grenade",
  "landmine",
  "barrel",
  "bigdetonate",
  "smalldetonate",
  "plastic",
  "urethane",
  "teleport",
  "lava",
];

// Items that cost gold in the shop and have inventory limits
const SHOP_WEAPON_IDS = new Set<string>(SHOP_ITEMS.filter((i) => i.price >= 0 && i.id !== "__ready__").map((i) => i.id));

// Per-game inventory (copied from playerInventory at game start, consumed during play)
let gameInventory = new Map<string, number>();

function canUseWeapon(id: string): boolean {
  return (gameInventory.get(id) ?? 0) > 0;
}

function consumeWeapon(id: string): void {
  if (!SHOP_WEAPON_IDS.has(id)) return;
  const cur = gameInventory.get(id) ?? 0;
  if (cur > 0) {
    gameInventory.set(id, cur - 1);
    const pc = playerInventory.get(id) ?? 0;
    if (pc > 0) playerInventory.set(id, pc - 1);
    updateShopGrid();
  }
}

function nextAvailableWeapon(current: WeaponName): WeaponName {
  const idx = WEAPONS.indexOf(current);
  for (let i = 1; i < WEAPONS.length; i++) {
    const w = WEAPONS[(idx + i) % WEAPONS.length] as WeaponName;
    if (canUseWeapon(w)) return w;
  }
  return current;
}

let assets: Assets;
let assetsReady = false;

function collectPushables(): NetPushable[] {
  const r: NetPushable[] = [];
  const add = (kind: string, entities: Array<{ id: number; tileX: number; tileY: number; phase?: string }>) => {
    for (const e of entities) if (e.phase !== "done") r.push({ kind, id: e.id, tileX: e.tileX, tileY: e.tileY, phase: e.phase });
  };
  add("tnt", tntMgr.getEntities());
  add("bigcross", bigCrossMgr.getEntities());
  add("smallcross", smallCrossMgr.getEntities());
  add("smallbomb", smallBombMgr.getEntities());
  add("bigbomb", bigBombMgr.getEntities());
  add("flamebomb", flameBombMgr.getEntities());
  add("smalldet", smallDetMgr.getEntities());
  add("bigdet", bigDetMgr.getEntities());
  add("diggerbomb", diggerBombMgr.getEntities());
  add("barrel", barrelMgr.getEntities());
  for (const b of boulderMgr.getEntities()) r.push({ kind: "boulder", id: b.id, tileX: b.tileX, tileY: b.tileY });
  for (const e of nuclearMgr.getEntities()) r.push({ kind: "nuclear", id: e.id, tileX: e.centerX, tileY: e.centerY, phase: e.phase });
  for (const e of jumpingBombMgr.getEntities()) {
    if (!e.done)
      r.push({
        kind: "jumpingbomb",
        id: e.id,
        tileX: e.tileX,
        tileY: e.tileY,
        tick: e.tick,
        fuseTicks: e.fuseTicks,
        explosionsLeft: e.explosionsLeft,
      });
  }
  return r;
}

function collectLava(): Array<{ id: number; cells: [number, number][] }> {
  return lavaMgr.getEntities().map((e) => ({ id: e.id, cells: e.cellList.slice() as [number, number][] }));
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
    for (const e of entities) {
      const p = positions.get(e.id);
      if (p) {
        e.tileX = p.tileX;
        e.tileY = p.tileY;
      }
    }
  };
  sync("tnt", tntMgr.getEntities());
  sync("bigcross", bigCrossMgr.getEntities());
  sync("smallcross", smallCrossMgr.getEntities());
  sync("smallbomb", smallBombMgr.getEntities());
  sync("bigbomb", bigBombMgr.getEntities());
  sync("flamebomb", flameBombMgr.getEntities());
  sync("smalldet", smallDetMgr.getEntities());
  sync("bigdet", bigDetMgr.getEntities());
  sync("diggerbomb", diggerBombMgr.getEntities());
  sync("barrel", barrelMgr.getEntities());
  sync("boulder", boulderMgr.getEntities());
  // Remove boulder entities that no longer exist on the host (e.g. destroyed by explosion)
  const boulderData = byKind.get("boulder");
  const boulders = boulderMgr.getEntities();
  for (let i = boulders.length - 1; i >= 0; i--) {
    if (!boulderData?.has(boulders[i].id)) boulders.splice(i, 1);
  }
  // Sync nuclear position (centerX/centerY stored as tileX/tileY in snapshot)
  const nuclearData = byKind.get("nuclear");
  if (nuclearData) {
    for (const e of nuclearMgr.getEntities()) {
      const p = nuclearData.get(e.id);
      if (p) {
        e.centerX = p.tileX;
        e.centerY = p.tileY;
      }
    }
  }
  // Sync TNT/bomb phase by position so dud/explode decision follows the host
  // (IDs diverge between host and clients, so we must match by tile position)
  const tntData = byKind.get("tnt");
  if (tntData) {
    for (const [, p] of tntData) {
      if (p.phase) tntMgr.forcePhaseAt(p.tileX, p.tileY, p.phase as TntPhase, terrain);
    }
  }
  for (const kind of ["smallbomb", "bigbomb"] as const) {
    const mgr = kind === "smallbomb" ? smallBombMgr : bigBombMgr;
    const data = byKind.get(kind);
    if (data) {
      for (const [, p] of data) {
        if (p.phase) mgr.forcePhaseAt(p.tileX, p.tileY, p.phase as BombPhase, terrain);
      }
    }
  }
  const jumpData = byKind.get("jumpingbomb");
  jumpingBombMgr.applyNetState(jumpData ? [...jumpData.values()].map(p => ({ id: p.id, tileX: p.tileX, tileY: p.tileY, tick: p.tick ?? 0, fuseTicks: p.fuseTicks ?? 0, explosionsLeft: p.explosionsLeft ?? 0 })) : []);
}

function startGame(): void {
  currentRound++;
  roundTick = 0;

  // Apply free market price randomization (70–120% of base price per round)
  if (tournamentConfig.freeMarker) {
    priceMultiplier = 0.7 + Math.random() * 0.5;
  } else {
    priceMultiplier = 1.0;
  }
  updateShopPrices();

  // Copy shop inventory into per-game inventory
  gameInventory = new Map(playerInventory);

  // Dig power: start from carried-over value, then apply shop upgrades and remove from gameInventory
  player.digPower = carryOverDigPower;
  player.digPower += (gameInventory.get("dig_power_1") ?? 0) * 1;
  player.digPower += (gameInventory.get("dig_power_2") ?? 0) * 3;
  player.digPower += (gameInventory.get("dig_power_3") ?? 0) * 5;
  gameInventory.delete("dig_power_1");
  gameInventory.delete("dig_power_2");
  gameInventory.delete("dig_power_3");

  // Reset all players to alive with full HP for the new round
  player.dead = false;
  player.health = MAX_HEALTH;
  player.cash = 0;
  player.moving = false;
  player.digging = false;
  player.pendingStop = false;
  for (const rp of remotePlayers.values()) {
    rp.dead = false;
    rp.health = MAX_HEALTH;
    rp.cash = 0;
    rp.moving = false;
    rp.digging = false;
    rp.pendingStop = false;
  }

  // Ensure selected weapon is one the player owns
  if (!canUseWeapon(selectedWeapon)) selectedWeapon = nextAvailableWeapon(selectedWeapon);

  input.flush();
  shopEl.style.display = "none";
  gameEl.style.display = "flex";
  hadTreasure = treasureMgr.getEntities().length > 0;
  loopActive = true;
  playGameMusic();
  requestAnimationFrame(loop);
}

function returnToLobby(clientBankedCash?: number): void {
  // Carry over dig power only if player survived; dying resets it to 1
  carryOverDigPower = player.dead ? 1 : player.digPower;

  if (!netMgr.connected || netMgr.isHost) {
    // ── HOST / OFFLINE: compute authoritative round results (8 steps) ──────────

    // Gather all players
    const localPid = netMgr.connected ? netMgr.localPlayerId : 1;
    type PlayerData = { playerId: number; color: number; name: string; bankedCash: number; roundGold: number; survived: boolean };
    const allPlayerData: PlayerData[] = [];

    allPlayerData.push({
      playerId: localPid,
      color: player.color,
      name: player.name || shopNameInput.value.trim() || "Player",
      bankedCash: playerGold,
      roundGold: player.cash,
      survived: !player.dead,
    });

    if (netMgr.connected && netMgr.isHost) {
      for (const [pid, rp] of remotePlayers) {
        const ri = netMgr.getRemoteInput(pid);
        allPlayerData.push({
          playerId: pid,
          color: rp.color,
          name: rp.name || `Player ${rp.color + 1}`,
          bankedCash: ri.gold,
          roundGold: rp.cash,
          survived: !rp.dead,
        });
      }
    }

    // Step 1: Apply 7% interest to banked cash only
    for (const p of allPlayerData) {
      p.bankedCash = Math.floor(p.bankedCash * 1.07);
    }

    // Step 2: Dead players' round gold → lost money pool
    let lostPool = 0;
    for (const p of allPlayerData) {
      if (!p.survived) lostPool += p.roundGold;
    }

    // Step 3: If exactly one survivor, add 40% of uncollected map gold to pool
    const survivors = allPlayerData.filter((p) => p.survived);
    const numAlive = survivors.length;
    if (numAlive === 1) {
      const mapGold = treasureMgr.getEntities().reduce((s, e) => s + e.value, 0);
      lostPool += Math.floor(mapGold * 0.4);
    }

    // Step 4+5: Each survivor gets their own round gold + equal share of pool
    const share = numAlive > 0 ? Math.floor(lostPool / numAlive) : 0;
    for (const p of allPlayerData) {
      if (p.survived) {
        p.bankedCash += p.roundGold + share;
      }
    }

    // Step 6: If any player died, every survivor earns a round win
    const anyDied = allPlayerData.some((p) => !p.survived);

    // Step 7: Safety bonus — if banked cash < 100, give 150
    for (const p of allPlayerData) {
      if (p.bankedCash < 100) p.bankedCash = 150;
    }

    // Apply local player results
    const localResult = allPlayerData.find((p) => p.playerId === localPid)!;
    playerGold = localResult.bankedCash;
    if (anyDied && localResult.survived) roundsWon++;

    // Update all tournament slots
    for (const p of allPlayerData) {
      const slot = tournamentSlots[p.color];
      if (!slot) continue;
      slot.active = true;
      slot.name = p.name;
      slot.totalCash = p.bankedCash;
      if (anyDied && p.survived) slot.roundsWon++;
    }

    // Send game_over to remote players with their computed balances
    if (netMgr.connected && remotePlayers.size > 0) {
      const balances = allPlayerData
        .filter((p) => p.playerId !== localPid)
        .map((p) => ({ playerId: p.playerId, bankedCash: p.bankedCash }));
      netMgr.sendGameOver(balances);
    }

    // Step 8: Reset round gold for next round
    player.cash = 0;
    for (const [, rp] of remotePlayers) rp.cash = 0;
  } else {
    // ── CLIENT: host already computed — accept the provided balance ───────────
    playerGold = clientBankedCash ?? playerGold;
    player.cash = 0;

    const localSlot = tournamentSlots[player.color];
    if (localSlot) {
      localSlot.active = true;
      localSlot.name = player.name || shopNameInput.value.trim() || "Player";
      localSlot.totalCash = playerGold;
      // roundsWon for clients comes from the tournament_over standings message
    }
  }

  shopGoldEl.textContent = String(playerGold);
  shopDigPowerEl.textContent = String(
    carryOverDigPower +
      (playerInventory.get("dig_power_1") ?? 0) * 1 +
      (playerInventory.get("dig_power_2") ?? 0) * 3 +
      (playerInventory.get("dig_power_3") ?? 0) * 5,
  );

  // Update rounds counter (remaining rounds = total - completed)
  shopRoundsInput.value = String(tournamentConfig.rounds - currentRound);

  // Reset ready state so players must ready up again each round
  if (playerIsReady) {
    playerIsReady = false;
    updateShopGrid();
    if (netMgr.connected) {
      if (netMgr.isHost) {
        const entry = lobbyPlayers.get(netMgr.localPlayerId);
        if (entry) entry.isReady = false;
        renderShopPlayerList();
        broadcastLobby();
      } else {
        netMgr.sendReady(false);
      }
    }
  }

  loopActive = false;
  playShopMusic();
  gameEl.style.display = "none";
  player.health = MAX_HEALTH;
  player.dead = false;

  // Check if tournament is over
  if (currentRound >= tournamentConfig.rounds) {
    // Clients wait for the tournament_over message from the host (which carries full standings)
    if (!netMgr.connected || netMgr.isHost) {
      openTournamentOverScreen();
    } else {
      shopEl.style.display = "flex"; // show shop while waiting for host's tournament_over message
    }
  } else {
    shopEl.style.display = "flex";
  }

  if (selectedLevel === "__random__") refreshRandomMap();
}

// ── Asset loading ──────────────────────────────────────────────────────────────

loadAssets()
  .then((a) => {
    assets = a;
    renderer.initPatterns(assets);
    assetsReady = true;
    playShopMusic();
  })
  .catch(() => {
    // assets failed silently — game will stay on shop screen
  });

loadLevelThumbnails().catch(() => {
  // level loading failed silently
});

// ── Main menu ──────────────────────────────────────────────────────────────────

const MENU_ITEMS = ["newgame", "options", "info", "quit"] as const;
// Vertical center of each hole as % of the 480px frame height (measured from image)
const SHOVEL_Y_PCT = [31.2, 40.5, 51, 60.0]; // last one (Quit) is estimated
let menuSelectedIdx = 0;
let infoPage = 1;
const INFO_PAGE_COUNT = 4;

function updateShovel(): void {
  menuShovelEl.style.top = `${SHOVEL_Y_PCT[menuSelectedIdx]}%`;
}

function openMainMenu(): void {
  playMenuMusic();
  mainMenuEl.style.display = "flex";
  optionsScreenEl.style.display = "none";
  infoScreenEl.style.display = "none";
  createGameEl.style.display = "none";
  joinGameEl.style.display = "none";
  shopEl.style.display = "none";
  gameEl.style.display = "none";
  tournamentOverEl.style.display = "none";
  keysScreenEl.style.display = "none";
  if (netMgr.connected) netMgr.disconnect();
  // Reset tournament state for a fresh start
  currentRound = 0;
  roundsWon = 0;
  playerGold = tournamentConfig.startingCash;
  priceMultiplier = 1.0;
  playerInventory.clear();
  carryOverDigPower = 1;
  resetTournamentSlots();
  shopGoldEl.textContent = String(playerGold);
  shopDigPowerEl.textContent = "1";
  updateShopGrid();
  updateShovel();
}

function openInfoScreen(): void {
  infoPage = 1;
  infoImgEl.src = `/art/ui/INFO${infoPage}.png`;
  updateInfoNav();
  mainMenuEl.style.display = "none";
  infoScreenEl.style.display = "flex";
}

function updateInfoNav(): void {
  const prevLbl = document.getElementById("info-prev-lbl")!;
  const nextLbl = document.getElementById("info-next-lbl")!;
  prevLbl.style.visibility = infoPage > 1 ? "visible" : "hidden";
  nextLbl.style.visibility = infoPage < INFO_PAGE_COUNT ? "visible" : "hidden";
}

function infoNavigate(delta: number): void {
  const next = infoPage + delta;
  if (next < 1) return;
  if (next > INFO_PAGE_COUNT) {
    openMainMenu();
    return;
  }
  infoPage = next;
  infoImgEl.src = `/art/ui/INFO${infoPage}.png`;
  updateInfoNav();
}

function selectMenuItem(): void {
  switch (MENU_ITEMS[menuSelectedIdx]) {
    case "newgame":
      openCreateGame();
      break;
    case "options":
      openOptionsScreen();
      break;
    case "info":
      openInfoScreen();
      break;
    case "quit":
      (window as any).electronAPI?.quit();
      break;
  }
}

// Keyboard handling for main menu, shop, and info screen
document.addEventListener("keydown", (e) => {
  // Ignore ESC entirely while the game is running
  if (e.key === "Escape" && loopActive) return;
  // Tournament over screen
  if (tournamentOverEl.style.display !== "none") {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") openMainMenu();
    return;
  }
  // Keys redefine screen
  if (keysScreenEl.style.display !== "none") {
    e.preventDefault();
    if (e.code === "F10") {
      closeKeysScreen();
      return;
    }
    if (e.code === "Escape") {
      // Skip current row (keep existing binding) or close if done
      keysCurrentRow++;
      if (keysCurrentRow >= KEYS_ACTIONS.length) closeKeysScreen();
      else renderKeysScreen();
      return;
    }
    // Bind the current row to this key
    if (keysCurrentRow >= 0 && keysCurrentRow < KEYS_ACTIONS.length) {
      const patch: Partial<KeyBindings> = {};
      patch[KEYS_ACTIONS[keysCurrentRow].binding] = e.code;
      input.setBindings(patch);
      keysBoundFlags[keysCurrentRow] = true;
      keysCurrentRow++;
      if (keysCurrentRow >= KEYS_ACTIONS.length) closeKeysScreen();
      else renderKeysScreen();
    }
    return;
  }
  // Shop screen — handle first
  if (shopEl.style.display !== "none") {
    if (document.activeElement === shopChatInput || document.activeElement === shopNameInput) return;
    const COLS = 4;

    if (e.key === "ArrowRight") shopSelectedIdx = shopSelectedIdx % COLS === COLS - 1 ? shopSelectedIdx : shopSelectedIdx + 1;
    else if (e.key === "ArrowLeft") shopSelectedIdx = shopSelectedIdx % COLS === 0 ? shopSelectedIdx : shopSelectedIdx - 1;
    else if (e.key === "ArrowDown") shopSelectedIdx = Math.min(shopSelectedIdx + COLS, SHOP_ITEMS.length - 1);
    else if (e.key === "ArrowUp") shopSelectedIdx = Math.max(shopSelectedIdx - COLS, 0);
    else if (e.key === "Enter" || e.key === " " || e.code === input.getBindings().bomb) {
      e.preventDefault();
      buySelectedItem();
    } else if (e.code === input.getBindings().choose && tournamentConfig.selling) {
      e.preventDefault();
      sellSelectedItem();
      updateShopGrid();
      return;
    } else if (e.key === "Escape") openMainMenu();
    else return;
    updateShopGrid();
    return;
  }
  // Join game screen
  if (joinGameEl.style.display !== "none") {
    if (e.key === "Escape") openCreateGame();
    return;
  }
  // Create game screen
  if (createGameEl.style.display !== "none") {
    if (e.key === "ArrowDown") {
      cgSelectedIdx = (cgSelectedIdx + 1) % CG_ITEMS.length;
      updateCgShovel();
    } else if (e.key === "ArrowUp") {
      cgSelectedIdx = (cgSelectedIdx - 1 + CG_ITEMS.length) % CG_ITEMS.length;
      updateCgShovel();
    } else if (e.key === "Enter" || e.key === " ") selectCgItem();
    else if (e.key === "Escape") openMainMenu();
    return;
  }
  // Options screen
  if (optionsScreenEl.style.display !== "none") {
    const item = OPT_ITEMS[optSelectedIdx];
    if (e.key === "ArrowDown") {
      optSelectedIdx = (optSelectedIdx + 1) % OPT_ITEMS.length;
    } else if (e.key === "ArrowUp") {
      optSelectedIdx = (optSelectedIdx - 1 + OPT_ITEMS.length) % OPT_ITEMS.length;
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const d = e.key === "ArrowRight" ? 1 : -1;
      if (item.type === "bar") {
        tournamentConfig[item.field] = Math.max(item.min, Math.min(item.max, tournamentConfig[item.field] + d * item.step)) as never;
      } else if (item.type === "toggle") {
        tournamentConfig[item.field] = !tournamentConfig[item.field] as never;
      } else if (item.type === "winner") {
        tournamentConfig.winCondition = tournamentConfig.winCondition === "money" ? "wins" : "money";
      }
    } else if (e.key === "Delete") {
      Object.assign(tournamentConfig, OPT_DEFAULTS);
      input.setBindings({ ...DEFAULT_BINDINGS });
      localStorage.removeItem("mb_keybindings");
    } else if ((e.key === "Enter" || e.key === " ") && (item.type === "action" || item.type === "keys")) {
      if (item.type === "keys") openKeysScreen();
      else openMainMenu();
      return;
    } else if (e.key === "Escape") {
      openMainMenu();
      return;
    } else return;
    renderOptions();
    saveSettings();
    return;
  }
  // Info screen
  if (infoScreenEl.style.display !== "none") {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") infoNavigate(-1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") infoNavigate(1);
    else if (e.key === "Escape" || e.key === "Backspace") openMainMenu();
    return;
  }
  // Main menu
  if (mainMenuEl.style.display !== "none") {
    if (e.key === "ArrowDown") {
      menuSelectedIdx = (menuSelectedIdx + 1) % MENU_ITEMS.length;
      updateShovel();
    } else if (e.key === "ArrowUp") {
      menuSelectedIdx = (menuSelectedIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      updateShovel();
    } else if (e.key === "Enter" || e.key === " ") {
      selectMenuItem();
    }
  }
});

// Mouse hover and click on menu hit areas
document.querySelectorAll<HTMLElement>(".menu-hit").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    menuSelectedIdx = parseInt(el.dataset.idx ?? "0", 10);
    updateShovel();
  });
  el.addEventListener("click", () => {
    menuSelectedIdx = parseInt(el.dataset.idx ?? "0", 10);
    selectMenuItem();
  });
});

// Info screen: click anywhere to advance; last page returns to main menu
document.getElementById("info-click-hit")!.addEventListener("click", () => infoNavigate(1));

// Show splash screen; dismiss on key/click or after 3 s
{
  let splashTimer: ReturnType<typeof setTimeout> | null = setTimeout(dismissSplash, 3000);
  function dismissSplash() {
    if (splashTimer !== null) {
      clearTimeout(splashTimer);
      splashTimer = null;
    }
    splashEl.style.display = "none";
    openMainMenu();
    window.removeEventListener("keydown", dismissSplash, true);
    window.removeEventListener("pointerdown", dismissSplash, true);
  }
  window.addEventListener("keydown", dismissSplash, true);
  window.addEventListener("pointerdown", dismissSplash, true);
}

// ── Net callbacks ──────────────────────────────────────────────────────────────

netMgr.onAssign = (playerId, isHost) => {
  createGameEl.style.display = "none";
  joinGameEl.style.display = "none";
  shopEl.style.display = "flex";
  playShopMusic();

  const name = shopNameInput.value.trim() || "Player";
  player.name = name;
  player.color = (playerId - 1) % 4;
  setSlotActive(player.color, name);
  lobbyPlayers.set(playerId, { name, color: player.color });
  renderShopPlayerList();
  const authority = isHost;
  tntMgr.isAuthority = authority;
  smallBombMgr.isAuthority = authority;
  bigBombMgr.isAuthority = authority;
  landmineMgr.isAuthority = authority;
  diggerBombMgr.isAuthority = authority;

  if (isHost) {
    shopMapRowEl.style.display = "";
    addChatMessage("System", "Waiting for all players to ready up...");
    broadcastLobby();
  } else {
    shopMapRowEl.style.display = "none";
    addChatMessage("System", "Waiting for all players to ready up...");
    netMgr.sendName(name);
  }
};

netMgr.onPlayerJoin = (pid) => {
  if (gameEl.style.display !== "none") {
    netMgr.sendGameInProgress();
    return;
  }
  const [tx, ty] = spawnPos(pid);
  const color = (pid - 1) % 4;
  remotePlayers.set(pid, createLocalPlayer(`Player${pid}`, color, tx, ty));
  lobbyPlayers.set(pid, { name: `Player${pid}`, color });
  setSlotActive(color, `Player${pid}`);
  renderShopPlayerList();
  broadcastLobby();
  netMgr.sendConfig({ ...tournamentConfig });
  netMgr.sendMapSelect(selectedLevel);
};

netMgr.onPlayerLeave = (pid) => {
  const leavingName = lobbyPlayers.get(pid)?.name ?? `Player${pid}`;
  remotePlayers.delete(pid);
  lobbyPlayers.delete(pid);
  renderShopPlayerList();
  broadcastLobby();
  addChatMessage("System", `${leavingName} has left the game`);
};

netMgr.onHostLeft = () => {
  netMgr.disconnect();
  openMainMenu();
  addChatMessage("System", "Host left — tournament ended.");
};

netMgr.onGameInProgress = () => {
  // Only act if we just joined and are sitting in the shop — ignore if already in-game
  if (gameEl.style.display !== "none") return;
  netMgr.disconnect();
  shopEl.style.display = "none";
  openJoinGame();
  setJgStatus("Round in progress — try again later", true);
};

netMgr.onPlayerName = (pid, name) => {
  const entry = lobbyPlayers.get(pid);
  const isFirstName = !entry || entry.name === `Player${pid}`;
  if (entry) entry.name = name;
  else lobbyPlayers.set(pid, { name, color: (pid - 1) % 4 });
  if (isFirstName) addChatMessage("System", `${name} has joined the game`);
  const rp = remotePlayers.get(pid);
  if (rp) rp.name = name;
  setSlotActive((pid - 1) % 4, name);
  renderShopPlayerList();
  broadcastLobby();
};

netMgr.onLobbyUpdate = (players) => {
  lobbyPlayers.clear();
  for (const p of players) {
    lobbyPlayers.set(p.id, { name: p.name, color: p.color, isReady: p.isReady });
    if (p.id !== netMgr.localPlayerId) {
      const [tx, ty] = spawnPos(p.id);
      if (!remotePlayers.has(p.id)) {
        remotePlayers.set(p.id, createLocalPlayer(p.name || `Player${p.id}`, p.color ?? (p.id - 1) % 4, tx, ty));
      } else {
        const rp = remotePlayers.get(p.id)!;
        rp.name = p.name || rp.name;
        rp.color = p.color ?? rp.color;
      }
    }
  }
  for (const pid of remotePlayers.keys()) {
    if (!players.find((p) => p.id === pid)) remotePlayers.delete(pid);
  }
  renderShopPlayerList();

  if (!netMgr.isHost) {
    const myName = shopNameInput.value.trim() || "Player";
    const otherNames = new Set(players.filter((p) => p.id !== netMgr.localPlayerId).map((p) => p.name));
    if (otherNames.has(myName)) {
      let n = 2;
      while (otherNames.has(`Player ${n}`)) n++;
      const newName = `Player ${n}`;
      shopNameInput.value = newName;
      netMgr.sendName(newName);
    }
  }
};

netMgr.onMapSelect = (level) => {
  selectedLevel = level;
  shopLevelSelect.value = level ?? "";
  if (level && levelData.has(level)) {
    updateShopMapThumb(buildThumbnail(levelData.get(level)!));
  } else {
    cachedRandomLevel = generateRandomLevel(tournamentConfig.treasures);
    updateShopMapThumb(buildThumbnailFromParsed(cachedRandomLevel));
  }
};

netMgr.onGameConfig = (cfg) => {
  // Clients always defer to the host's config
  if (!netMgr.isHost) {
    Object.assign(tournamentConfig, cfg);
    renderOptions();
  }
};

netMgr.onChat = (name, text, fromPlayerId, senderPlayerId) => {
  const resolvedId = senderPlayerId ?? fromPlayerId;
  const color = resolvedId !== undefined ? lobbyPlayers.get(resolvedId)?.color : undefined;
  addChatMessage(name, text, color);
  if (netMgr.isHost && fromPlayerId !== undefined) {
    netMgr.sendChat(name, text, fromPlayerId); // preserve original sender ID for other clients
  }
};

netMgr.onPlayerReady = (playerId, isReady) => {
  const entry = lobbyPlayers.get(playerId);
  if (entry) entry.isReady = isReady;
  renderShopPlayerList();
  if (netMgr.isHost) {
    broadcastLobby();
    checkAllReady();
  }
};

netMgr.onInitData = (data) => {
  applyParsedLevel(data as Parameters<typeof applyParsedLevel>[0]);
  // Apply host's random corner assignments so spawnPos() returns correct positions
  playerSpawnMap.clear();
  if (data.playerSpawns) {
    for (const { playerId, col, row } of data.playerSpawns) {
      playerSpawnMap.set(playerId, [col, row]);
    }
  }
  // Pre-populate remotePlayers from the lobby list so all players are visible from frame 1
  for (const [id, p] of lobbyPlayers) {
    if (id !== netMgr.localPlayerId) {
      const [rtx, rty] = spawnPos(id);
      remotePlayers.set(id, createLocalPlayer(p.name, p.color, rtx, rty));
    }
  }
  const [tx, ty] = spawnPos(netMgr.localPlayerId);
  player.x = tx * TILE_SIZE;
  player.y = ty * TILE_SIZE;
  player.tileX = tx;
  player.tileY = ty;
  player.targetTileX = tx;
  player.targetTileY = ty;
  prevTileX = tx;
  prevTileY = ty;
  startGame();
};

netMgr.onStateUpdate = (players, monsters, pushables, clones, doorSwitchOn, doorOpen, lava, urethane, plastic, netRoundTick) => {
  roundTick = netRoundTick;
  applyPushables(pushables);
  slimeMgr.applyNetState(monsters);
  brownMgr.applyNetState(monsters);
  grenadierMgr.applyNetState(monsters);
  greyMgr.applyNetState(monsters);
  cloneMgr.applyNetState(clones);
  doorSwitchMgr.setOn(doorSwitchOn);
  doorMgr.setOpen(doorOpen);
  lavaMgr.applyNetState(lava);
  urethaneMgr.applyNetState(urethane);
  plasticMgr.applyNetState(plastic);
  for (const np of players) {
    if (np.id === netMgr.localPlayerId) {
      player.health = np.health;
      player.cash = np.cash;
      if (np.dead && !player.dead) {
        player.dead = true;
        player.moving = false;
      }
      // Queue reconciliation — applied in game loop where weaponMgrs are accessible
      if (!player.dead) pendingHostPlayerState = np;
    } else {
      if (!remotePlayers.has(np.id)) {
        const [tx, ty] = spawnPos(np.id);
        remotePlayers.set(np.id, createLocalPlayer(np.name || `Player${np.id}`, np.color, tx, ty));
      }
      const rp = remotePlayers.get(np.id);
      if (rp) {
        // Hard-snap position only if too far off (otherwise let smooth lerp continue)
        if (Math.abs(rp.tileX - np.tileX) > 2 || Math.abs(rp.tileY - np.tileY) > 2) {
          rp.x = np.x;
          rp.y = np.y;
        }
        rp.tileX = np.tileX;
        rp.tileY = np.tileY;
        rp.targetTileX = np.targetTileX;
        rp.targetTileY = np.targetTileY;
        rp.dir = np.dir as Dir;
        rp.animFrame = np.animFrame;
        rp.moving = np.moving;
        rp.digging = np.digging;
        rp.health = np.health;
        rp.dead = np.dead;
        rp.color = np.color;
        rp.name = np.name;
        rp.digPower = np.digPower;
      }
    }
  }
};

netMgr.onTerrainChange = (changes) => {
  for (const { col, row, solid, cellType, burnedGround } of changes) {
    terrain[row][col] = solid;
    detailMap[row][col] = {
      type: cellType as TerrainTileType,
      hp: TILE_MAX_HP[cellType as TerrainTileType] ?? 0,
      burnedGround: burnedGround || undefined,
    };
  }
  renderer.markTerrainDirty();
};

netMgr.onItemRemove = (pickable, treasure) => {
  pickableMgr.removeById(pickable);
  treasureMgr.removeById(treasure);
  if (treasure.length > 0) playSound("KILI");
};

netMgr.onGameOver = (balances) => {
  if (gameEl.style.display === "none") return; // already processed
  const myBalance = balances?.find((b) => b.playerId === netMgr.localPlayerId);
  returnToLobby(myBalance?.bankedCash);
};

netMgr.onTournamentOver = (slots) => {
  // Apply host's authoritative standings then show the tournament over screen
  for (const s of slots) {
    const local = tournamentSlots[s.color];
    if (local) Object.assign(local, s);
  }
  if (tournamentOverEl.style.display !== "flex") {
    openTournamentOverScreen();
  }
};

netMgr.onWeaponAct = (weapon, x, y, tileX, tileY, dir, moving, actorColor, ownerId) => {
  // Pickup notifications are targeted at a specific player by ownerId
  if (weapon.startsWith("pickup_weapon:")) {
    if (ownerId === netMgr.localPlayerId) {
      const w = weapon.slice("pickup_weapon:".length) as WeaponName;
      gameInventory.set(w, (gameInventory.get(w) ?? 0) + 1);
      selectedWeapon = w;
    }
    return;
  }
  // Host confirmation of own placement — start local fuse timer for bomb types
  if (ownerId !== undefined && ownerId === netMgr.localPlayerId) {
    if (weapon === "tnt") tntMgr.enableSelfAuthorityAt(tileX, tileY);
    else if (weapon === "smallbomb") smallBombMgr.enableSelfAuthorityAt(tileX, tileY);
    else if (weapon === "bigbomb") bigBombMgr.enableSelfAuthorityAt(tileX, tileY);
    return;
  }
  applyRemoteWeapon({ x, y, tileX, tileY, dir: dir as Dir, moving }, weapon, actorColor, actorColor);
};

// ── Create game screen logic ───────────────────────────────────────────────────

const CG_ITEMS = ["hostgame", "joingame", "back"] as const;
const CG_SHOVEL_Y_PCT = [31, 41, 51]; // hole positions in create_game.png
let cgSelectedIdx = 0;

function updateCgShovel(): void {
  cgShovelEl.style.top = `${CG_SHOVEL_Y_PCT[cgSelectedIdx]}%`;
}

function openCreateGame(): void {
  mainMenuEl.style.display = "none";
  joinGameEl.style.display = "none";
  createGameEl.style.display = "flex";
  cgStatusEl.textContent = "";
  updateCgShovel();
}

function openJoinGame(): void {
  createGameEl.style.display = "none";
  joinGameEl.style.display = "flex";
  jgStatusEl.textContent = "";
  jgHostIpInput.value = "";
}

function selectCgItem(): void {
  switch (CG_ITEMS[cgSelectedIdx]) {
    case "hostgame":
      cgStatusEl.textContent = "Starting…";
      netMgr.disconnect();
      netMgr
        .connect("ws://localhost:3001")
        .then(() => {
          cgStatusEl.textContent = "";
        })
        .catch(() => {
          cgStatusEl.textContent = "Could not start server (is it running?)";
        });
      break;
    case "joingame":
      openJoinGame();
      break;
    case "back":
      openMainMenu();
      break;
  }
}

document.querySelectorAll<HTMLElement>(".cg-hit").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    cgSelectedIdx = parseInt(el.dataset.idx ?? "0", 10);
    updateCgShovel();
  });
  el.addEventListener("click", () => {
    cgSelectedIdx = parseInt(el.dataset.idx ?? "0", 10);
    selectCgItem();
  });
});

let jgStatusTimer: ReturnType<typeof setTimeout> | null = null;
function setJgStatus(msg: string, autoClear = false): void {
  if (jgStatusTimer) clearTimeout(jgStatusTimer);
  jgStatusEl.textContent = msg;
  if (autoClear && msg)
    jgStatusTimer = setTimeout(() => {
      jgStatusEl.textContent = "";
    }, 3000);
}

document.getElementById("jg-join-btn")!.addEventListener("click", () => {
  const ip = jgHostIpInput.value.trim();
  if (!ip) {
    setJgStatus("Enter the host's IP address", true);
    return;
  }
  setJgStatus("Connecting…");
  const url = ip.startsWith("ws://") || ip.startsWith("wss://") ? ip : `ws://${ip}:3001`;
  netMgr.disconnect();
  netMgr
    .connect(url)
    .then(() => {
      setJgStatus("");
    })
    .catch(() => {
      setJgStatus("Could not connect", true);
    });
});

jgHostIpInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("jg-join-btn")!.click();
});

document.getElementById("jg-back-hit")!.addEventListener("click", () => openCreateGame());

// ── Shop grid initialisation ───────────────────────────────────────────────────

buildShopGrid();
updateShopGrid();
shopGoldEl.textContent = String(playerGold);
shopDigPowerEl.textContent = "1";

const TARGET_MS = 1000 / 60;
let last = 0;
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let fpsDigging = false;
let prevTileX = player.tileX;
let prevTileY = player.tileY;
let activeFireCells = new Set<string>();
let deathTimer = 0;
let hadTreasure = false;
const DEATH_DELAY_FRAMES = 2 * 60;
let loopActive = false;

function loop(ts: number): void {
  if (!loopActive) return;
  requestAnimationFrame(loop);
  fpsFrameCount++;

  if (ts - last < TARGET_MS) return;
  last += TARGET_MS;
  // Prevent runaway catch-up (e.g. after tab was hidden)
  if (ts - last > TARGET_MS * 5) last = ts;

  // Round timer — host triggers game over when time limit is reached
  if (!netMgr.connected || netMgr.isHost) {
    roundTick++;

    const triggerGameOver = () => {
      returnToLobby(); // computes results, sends game_over to clients, redirects host
    };

    if (roundTick >= tournamentConfig.timeLimitSec * 60) {
      triggerGameOver();
      return;
    }
  }

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
    tntMgr,
    bigCrossMgr,
    smallCrossMgr,
    smallBombMgr,
    bigBombMgr,
    flameBombMgr,
    smallDetMgr,
    bigDetMgr,
    urethaneMgr,
    plasticMgr,
    lavaMgr,
    barrelMgr,
    diggerBombMgr,
    doorMgr,
    doorSwitchMgr,
    boulderMgr,
    nuclearMgr,
  ];
  const pushBlocker = (c: number, r: number) => teleportMgr.hasPlacedAt(c, r) || treasureMgr.hasSolidAt(c, r);
  const playerMoveSpeed = player.digging
    ? Math.min(PLAYER_SPEED + Math.floor(player.digPower * 0.75), TILE_SIZE - 1)
    : jetpackMgr.getSpeed();
  const stopPressed = input.consumeStopPress();

  if (!netMgr.connected || netMgr.isHost) {
    // HOST / OFFLINE: apply input directly
    updatePlayer(player, inputDir as Dir, stopPressed, terrain, weaponMgrs, playerMoveSpeed, pushBlocker);
  } else {
    // CLIENT: reconcile against server snapshot, then re-predict
    if (pendingHostPlayerState) {
      const np = pendingHostPlayerState;
      pendingHostPlayerState = null;
      const acked = np.lastInputSeq ?? 0;
      // Always prune acknowledged inputs
      while (inputBuffer.length > 0 && inputBuffer[0].seq <= acked) inputBuffer.shift();
      // Only do a full reset+replay when the tile position disagrees.
      // Sub-pixel (x/y) corrections every frame cause visible micro-jitter, especially during digging.
      const tilesMismatch = np.tileX !== player.tileX || np.tileY !== player.tileY
        || np.targetTileX !== player.targetTileX || np.targetTileY !== player.targetTileY;
      if (tilesMismatch) {
        player.x = np.x;
        player.y = np.y;
        player.tileX = np.tileX;
        player.tileY = np.tileY;
        player.targetTileX = np.targetTileX;
        player.targetTileY = np.targetTileY;
        player.moving = np.moving;
        player.dir = np.dir as Dir;
        player.digging = np.digging;
        // Replay unacknowledged inputs to re-derive predicted position.
        // Freeze animFrame/animTick — they advance only on the real prediction step below.
        const savedAnimFrame = player.animFrame, savedAnimTick = player.animTick;
        for (const snap of inputBuffer) {
          if (!player.moving && snap.dir !== "none") {
            const dc = snap.dir === "right" ? 1 : snap.dir === "left" ? -1 : 0;
            const dr = snap.dir === "down" ? 1 : snap.dir === "up" ? -1 : 0;
            player.digging =
              isStone(terrain, player.tileX + dc, player.tileY + dr) ||
              lavaMgr.hasSolidAt(player.tileX + dc, player.tileY + dr) ||
              urethaneMgr.hasSolidAt(player.tileX + dc, player.tileY + dr) ||
              plasticMgr.hasSolidAt(player.tileX + dc, player.tileY + dr);
          } else { player.digging = false; }
          const rs = player.digging ? Math.min(PLAYER_SPEED + Math.floor(player.digPower * 0.75), TILE_SIZE - 1) : jetpackMgr.getSpeed();
          updatePlayer(player, snap.dir, snap.stopPressed, terrain, weaponMgrs, rs, pushBlocker);
        }
        player.animFrame = savedAnimFrame;
        player.animTick = savedAnimTick;
      }
      if (DEBUG_RECONCILIATION) {
        const sent = inputSendTimes.get(acked);
        if (sent !== undefined) {
          pingMs = Date.now() - sent;
          for (const k of inputSendTimes.keys()) if (k <= acked) inputSendTimes.delete(k);
        }
      }
    }
    // Apply this frame's input as a new prediction step
    updatePlayer(player, inputDir as Dir, stopPressed, terrain, weaponMgrs, playerMoveSpeed, pushBlocker);
  }

  // HOST: update remote players with their received inputs
  if (netMgr.connected && netMgr.isHost) {
    for (const [pid, rp] of remotePlayers) {
      const ri = netMgr.dequeueRemoteInput(pid);
      rp.digPower = ri.digPower;
      if (!rp.dead) {
        const rdir = ri.dir as Dir;
        // Set digging flag (same logic as local player)
        if (!rp.moving && rdir !== "none") {
          const rdc = rdir === "right" ? 1 : rdir === "left" ? -1 : 0;
          const rdr = rdir === "down" ? 1 : rdir === "up" ? -1 : 0;
          rp.digging =
            isStone(terrain, rp.tileX + rdc, rp.tileY + rdr) ||
            lavaMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr) ||
            urethaneMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr) ||
            plasticMgr.hasSolidAt(rp.tileX + rdc, rp.tileY + rdr);
        } else {
          rp.digging = false;
        }
        const prevRpTileX = rp.tileX,
          prevRpTileY = rp.tileY;
        const rpJetpack = (remoteJetpackTicks.get(pid) ?? 0) > 0;
        const rpMoveSpeed = rp.digging
          ? Math.min(PLAYER_SPEED + Math.floor(rp.digPower * 0.75), TILE_SIZE - 1)
          : rpJetpack
            ? PLAYER_SPEED * JETPACK_SPEED_MULTIPLIER
            : PLAYER_SPEED;
        updatePlayer(rp, rdir, ri.stopPressed, terrain, weaponMgrs, rpMoveSpeed, pushBlocker);
        if (rp.tileX !== prevRpTileX || rp.tileY !== prevRpTileY) {
          const rpDest = teleportMgr.tryTeleport(rp.tileX, rp.tileY);
          if (rpDest) {
            rp.x = rpDest[0] * TILE_SIZE;
            rp.y = rpDest[1] * TILE_SIZE;
            rp.tileX = rpDest[0];
            rp.tileY = rpDest[1];
            rp.targetTileX = rpDest[0];
            rp.targetTileY = rpDest[1];
            rp.moving = false;
          }
        }
        if (rp.moving) rp.digging = false;
        // Apply dig damage
        if (rp.digging) {
          const rdc = rdir === "right" ? 1 : rdir === "left" ? -1 : 0;
          const rdr2 = rdir === "down" ? 1 : rdir === "up" ? -1 : 0;
          const rnc = rp.tileX + rdc,
            rnr = rp.tileY + rdr2;
          const rpEffectiveDigPower = rpJetpack ? 300 : rp.digPower;
          if (isStone(terrain, rnc, rnr)) {
            if (applyDigDamage(detailMap, terrain, rnc, rnr, rpEffectiveDigPower)) renderer.markTerrainDirty();
          } else {
            lavaMgr.applyDigDamage(rnc, rnr, rpEffectiveDigPower);
            urethaneMgr.applyDigDamage(rnc, rnr, rpEffectiveDigPower);
            plasticMgr.applyDigDamage(rnc, rnr, rpEffectiveDigPower);
          }
        }
        for (const action of ri.actions) applyRemoteWeapon(rp, action, pid, rp.color);
        // Remote player pickups (host is authoritative)
        const rpTreasure = treasureMgr.update(rp.tileX, rp.tileY);
        if (rpTreasure > 0) playSound("KILI");
        rp.cash += rpTreasure;
        for (const type of pickableMgr.update(rp.tileX, rp.tileY)) {
          if (type === "dig_power_1") rp.digPower += 1;
          else if (type === "dig_power_2") rp.digPower += 3;
          else if (type === "dig_power_3") rp.digPower += 5;
          else if (type === "medpac") rp.health = MAX_HEALTH;
          else if (type === "random_weapon") {
            const w = RANDOM_WEAPON_POOL[Math.floor(Math.random() * RANDOM_WEAPON_POOL.length)];
            netMgr.sendWeaponAct(`pickup_weapon:${w}`, 0, 0, 0, 0, "none", false, 0, pid);
          }
        }
      }
      netMgr.clearRemoteActions(pid);
    }
  }

  // CLIENT: lerp remote players toward their authoritative target tile — NO terrain check
  // (using updatePlayer would block on locally-undig stone, freezing remote players)
  if (netMgr.connected && !netMgr.isHost) {
    for (const rp of remotePlayers.values()) {
      if (rp.dead || !rp.moving) continue;
      const targetX = rp.targetTileX * TILE_SIZE;
      const targetY = rp.targetTileY * TILE_SIZE;
      const remX = targetX - rp.x;
      const remY = targetY - rp.y;
      if (Math.abs(remX) <= PLAYER_SPEED && Math.abs(remY) <= PLAYER_SPEED) {
        rp.x = targetX;
        rp.y = targetY;
        rp.tileX = rp.targetTileX;
        rp.tileY = rp.targetTileY;
        rp.moving = false;
      } else {
        if (remX !== 0) rp.x += Math.sign(remX) * PLAYER_SPEED;
        if (remY !== 0) rp.y += Math.sign(remY) * PLAYER_SPEED;
      }
      rp.animTick = rp.animTick + 1;
      if (rp.animTick >= 5) {
        rp.animTick = 0;
        rp.animFrame = (rp.animFrame + 1) % 4;
      }
    }
  }

  // Clear digging if player started moving (tile became passable mid-dig)
  if (player.moving) player.digging = false;

  // Pickaxe sound — local player and all remote players digging hard tiles
  const checkDigSound = (digging: boolean, dir: string, tileX: number, tileY: number) => {
    if (!digging) return;
    const dc = dir === "right" ? 1 : dir === "left" ? -1 : 0;
    const dr = dir === "down" ? 1 : dir === "up" ? -1 : 0;
    const cell = detailMap[tileY + dr]?.[tileX + dc];
    if (cell && isHardDigTile(cell.type)) playSound("PICAXE", 350, 0.1);
  };
  checkDigSound(player.digging, player.dir, player.tileX, player.tileY);
  for (const rp of remotePlayers.values()) {
    checkDigSound(rp.digging, rp.dir, rp.tileX, rp.tileY);
  }
  // Apply dig damage — only on host (clients receive terrain changes via onTerrainChange)
  if (player.digging && (!netMgr.connected || netMgr.isHost)) {
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
    if (!player.dead && input.consumeWeaponSwitch()) selectedWeapon = nextAvailableWeapon(selectedWeapon);
    const netActions: string[] = [];
    if (!player.dead && input.consumeTntPress() && canUseWeapon(selectedWeapon)) {
      // Encode bomb/tnt placement tile so the host places at exactly this tile and echoes it back
      const tileAction =
        selectedWeapon === "tnt" || selectedWeapon === "smallbomb" || selectedWeapon === "bigbomb" || selectedWeapon === "flamebomb"
          ? `${selectedWeapon}@${player.tileX}:${player.tileY}`
          : selectedWeapon;
      netActions.push(tileAction);
    }
    if (!player.dead && input.consumeDetonatePress()) netActions.push("__detonate__");
    if (!player.dead && input.consumeFireExtPress() && canUseWeapon("fireextinguisher")) netActions.push("__fireext__");
    input.consumeTreasurePress();
    inputSeq++;
    inputBuffer.push({ seq: inputSeq, dir: inputDir as Dir, stopPressed });
    if (inputBuffer.length > 128) inputBuffer.shift();
    netMgr.sendInput(inputDir as NetDir, netActions, player.digPower, playerGold, inputSeq, stopPressed);
    inputSendTimes.set(inputSeq, Date.now());
    // Mirror weapon placement locally so bombs/explosions are visible on client
    if (!player.dead && netActions.some((a) => a === selectedWeapon || a.startsWith(selectedWeapon + "@"))) {
      consumeWeapon(selectedWeapon);
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
      else if (selectedWeapon === "smalldetonate") smallDetMgr.place(player.x, player.y, terrain, player.color);
      else if (selectedWeapon === "bigdetonate") bigDetMgr.place(player.x, player.y, terrain, player.color);
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
      // clone: placed by host only, synced via state update
      else if (selectedWeapon === "treasure") treasureMgr.place(player.x, player.y, terrain);
      else if (PICKABLE_TYPES.includes(selectedWeapon as (typeof PICKABLE_TYPES)[number]))
        pickableMgr.place(player.x, player.y, terrain, selectedWeapon as (typeof PICKABLE_TYPES)[number]);
    }
    if (!player.dead && netActions.includes("__fireext__")) {
      consumeWeapon("fireextinguisher");
    }
    if (!player.dead && netActions.includes("__detonate__")) {
      smallDetMgr.detonate(terrain);
      bigDetMgr.detonate(terrain);
    }
  } else {
    // HOST or OFFLINE: place weapons in local simulation
    if (!player.dead && input.consumeWeaponSwitch()) {
      selectedWeapon = nextAvailableWeapon(selectedWeapon);
    }
    if (!player.dead && input.consumeTntPress() && canUseWeapon(selectedWeapon)) {
      consumeWeapon(selectedWeapon);
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
      else if (selectedWeapon === "smalldetonate") smallDetMgr.place(player.x, player.y, terrain, player.color);
      else if (selectedWeapon === "bigdetonate") bigDetMgr.place(player.x, player.y, terrain, player.color);
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
      else if (selectedWeapon === "clone") cloneMgr.place(player.x, player.y, terrain, netMgr.localPlayerId, player.color);
      else if (selectedWeapon === "treasure") treasureMgr.place(player.x, player.y, terrain);
      else if (PICKABLE_TYPES.includes(selectedWeapon as (typeof PICKABLE_TYPES)[number]))
        pickableMgr.place(player.x, player.y, terrain, selectedWeapon as (typeof PICKABLE_TYPES)[number]);
      if (netMgr.connected && netMgr.isHost)
        netMgr.sendWeaponAct(
          selectedWeapon,
          player.x,
          player.y,
          player.tileX,
          player.tileY,
          player.dir as NetDir,
          player.moving,
          player.color,
        );
    }
    if (!player.dead && input.consumeFireExtPress() && canUseWeapon("fireextinguisher")) {
      consumeWeapon("fireextinguisher");
      fireExtMgr.fire(player.x, player.y, facingDir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
      if (netMgr.connected && netMgr.isHost)
        netMgr.sendWeaponAct("__fireext__", player.x, player.y, player.tileX, player.tileY, facingDir as NetDir, player.moving);
    }
    if (!player.dead && input.consumeDetonatePress()) {
      smallDetMgr.detonate(terrain);
      bigDetMgr.detonate(terrain);
      if (netMgr.connected && netMgr.isHost)
        netMgr.sendWeaponAct("__detonate__", player.x, player.y, player.tileX, player.tileY, player.dir as NetDir, player.moving);
    }
    if (!player.dead && input.consumeTreasurePress()) {
      treasureMgr.place(player.x, player.y, terrain);
      if (netMgr.connected && netMgr.isHost)
        netMgr.sendWeaponAct("treasure", player.x, player.y, player.tileX, player.tileY, player.dir as NetDir, player.moving);
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
  // Player tile map for hostile clone targeting and grenade collision (tile key → player id)
  const allPlayerTiles = new Map<string, number>();
  if (!player.dead) {
    allPlayerTiles.set(`${player.tileX},${player.tileY}`, netMgr.localPlayerId);
    allPlayerTiles.set(`${player.targetTileX},${player.targetTileY}`, netMgr.localPlayerId);
  }
  for (const [pid, rp] of remotePlayers) {
    if (!rp.dead) {
      allPlayerTiles.set(`${rp.tileX},${rp.tileY}`, pid);
      allPlayerTiles.set(`${rp.targetTileX},${rp.targetTileY}`, pid);
    }
  }

  const monsterSolid = {
    hasSolidAt: (c: number, r: number) =>
      slimeMgr.getEntities().some((s) => s.phase === "alive" && s.tileX === c && s.tileY === r) ||
      brownMgr.getEntities().some((b) => b.phase === "alive" && b.tileX === c && b.tileY === r) ||
      grenadierMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
      greyMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
      cloneMgr.getEntities().some((e) => e.phase === "alive" && e.tileX === c && e.tileY === r),
  };
  grenadeMgr.update(
    terrain,
    [
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
    ],
    (c, r) => allPlayerTiles.has(`${c},${r}`),
  );
  smallBombMgr.update(player.x, player.y, terrain);
  bigBombMgr.update(player.x, player.y, terrain);
  {
    const allPlayerPositions = [
      ...(player.dead ? [] : [{ x: player.x, y: player.y }]),
      ...[...remotePlayers.values()].filter((rp) => !rp.dead).map((rp) => ({ x: rp.x, y: rp.y })),
    ];
    const landmineTriggers = landmineMgr.update(allPlayerPositions, terrain);
    if (netMgr.connected && netMgr.isHost) {
      for (const t of landmineTriggers) {
        netMgr.sendWeaponAct("landmine_trigger", 0, 0, t.tileX, t.tileY, "none", false, 0);
      }
    }
  }
  flameBombMgr.update(player.x, player.y, terrain, (c, r) => doorMgr.hasSolidAt(c, r) || doorSwitchMgr.hasSolidAt(c, r));
  flamethrowerMgr.update(terrain);
  fireExtMgr.update();
  smallDetMgr.update(player.x, player.y, terrain);
  bigDetMgr.update(player.x, player.y, terrain);
  urethaneMgr.update();
  plasticMgr.update(terrain);
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
    wallMgr.hasSolidAt(c, r) ||
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
      ...[...remotePlayers.values()].filter((rp) => !rp.dead).map((rp) => ({ tileX: rp.tileX, tileY: rp.tileY })),
    ];
    slimeMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of slimeMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    brownMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of brownMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    const grenadierThrows = grenadierMgr.update(terrain, slimeSolidAt, allPlayerPositions, grenadeMgr, monsterApplyDig);
    if (netMgr.connected && netMgr.isHost) {
      for (const t of grenadierThrows) {
        netMgr.sendWeaponAct("grenadier_grenade", 0, 0, t.tileX, t.tileY, t.dir, false, 0);
      }
    }
    for (const e of grenadierMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
    greyMgr.update(terrain, slimeSolidAt, allPlayerPositions, monsterApplyDig);
    for (const e of greyMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);

    // Teleport monsters that step on a teleport pad (60-frame cooldown prevents re-teleport)
    const allMonsters = [...slimeMgr.getEntities(), ...brownMgr.getEntities(), ...grenadierMgr.getEntities(), ...greyMgr.getEntities()];
    for (const m of allMonsters) {
      if (m.phase !== "alive") continue;
      if (m.teleportCooldown > 0) {
        m.teleportCooldown--;
        continue;
      }
      const dest = teleportMgr.tryTeleport(m.tileX, m.tileY);
      if (dest) {
        m.tileX = dest[0];
        m.tileY = dest[1];
        m.x = dest[0] * TILE_SIZE;
        m.y = dest[1] * TILE_SIZE;
        m.targetTileX = dest[0];
        m.targetTileY = dest[1];
        m.moving = false;
        m.teleportCooldown = 60;
      }
    }
  }

  // Monster tiles set and clone AI — host only (clients get clone state via state update)
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
  if (!netMgr.connected || netMgr.isHost) {
    const cloneSolidAt = (c: number, r: number) => slimeSolidAt(c, r) || detailMap[r]?.[c]?.type === "border";
    const grenadeThrows = cloneMgr.update(
      terrain,
      cloneSolidAt,
      monsterTiles,
      grenadeMgr,
      player.digPower,
      monsterApplyDig,
      allPlayerTiles,
    );
    // Clones collect treasure they walk onto; play pickaxe sound when digging hard tiles
    for (const e of cloneMgr.getEntities()) {
      if (e.phase === "alive") {
        e.cash += treasureMgr.collectAt(e.tileX, e.tileY);
        if (e.digging) {
          const cell = detailMap[e.digTileY]?.[e.digTileX];
          if (cell && isHardDigTile(cell.type)) playSound("PICAXE", 350, 0.1);
        }
      }
    }
    // HOST: broadcast clone grenade throws to clients
    if (netMgr.connected) {
      for (const t of grenadeThrows) {
        netMgr.sendWeaponAct("clone_grenade", 0, 0, t.tileX, t.tileY, t.dir, false, t.color);
      }
    }
  }
  for (const t of landmineMgr.chainDetonate(monsterTiles, terrain)) {
    if (netMgr.connected && netMgr.isHost) netMgr.sendWeaponAct("landmine_trigger", 0, 0, t.tileX, t.tileY, "none", false, 0);
  }
  jetpackMgr.update();
  for (const [id, t] of remoteJetpackTicks) {
    if (t <= 1) remoteJetpackTicks.delete(id);
    else remoteJetpackTicks.set(id, t - 1);
  }
  if (tileChanged) {
    const _treasureEarned = treasureMgr.update(player.tileX, player.tileY);
    if (_treasureEarned > 0) playSound("KILI");
    player.cash += _treasureEarned;
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
      else if (type === "random_weapon") {
        const w = RANDOM_WEAPON_POOL[Math.floor(Math.random() * RANDOM_WEAPON_POOL.length)];
        gameInventory.set(w, (gameInventory.get(w) ?? 0) + 1);
        selectedWeapon = w;
      }
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
  // ── Sound: explosion triggers ─────────────────────────────────────────────
  {
    const hasNew = (fire: Set<string>) => fire.size > 0 && [...fire].some((k) => newNormalCells.has(k));
    if (hasNew(smallBombFire) || hasNew(bigBombFire) || hasNew(landmineFire)) playSound("PIKKUPOM", 80, 0.2);
    if (hasNew(smallCrossFire) || hasNew(smallDetFire) || hasNew(plasticFire) || hasNew(flameBarrelFire)) playSound("EXPLOS1", 80, 0.03);
    if (hasNew(tntFire) || hasNew(bigDetFire) || hasNew(bigCrossFire) || hasNew(teleportMgr.getFireCells()) || hasNew(jumpingBombFire))
      playSound("EXPLOS2", 80, 0.03);
    if (nuclearFire.size > 0 && [...nuclearFire].some((k) => newNuclearCells.has(k))) playSound("EXPLOS3", 80, 0.03);
    if (flamethrowerFire.size > 0) playSound("EXPLOS4", 300, 0.1);
    if (hasNew(diggerBombFire) || hasNew(flameBombFire)) playSound("EXPLOS5", 80, 0.1);
    if (urethaneMgr.justSpread()) playSound("URETHAN", 80, 0.2);
  }
  // Explosion terrain damage — only on host/offline (clients receive changes via onTerrainChange)
  if (!netMgr.connected || netMgr.isHost) {
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
  }
  // Damage is only calculated on host/offline — clients get health from state snapshots
  if (!netMgr.connected || netMgr.isHost) {
    const pt = `${player.tileX},${player.tileY}`;
    const ptt = `${player.targetTileX},${player.targetTileY}`;
    const inFire = (cells: Set<string>) => cells.has(pt) || cells.has(ptt);
    const isNew = (cells: Set<string>) => inFire(cells) && !activeFireCells.has(pt) && !activeFireCells.has(ptt);
    if (inFire(flamethrowerFire)) player.health -= bombDmg(34);
    if (isNew(flameBombFire)) player.health -= bombDmg(84);
    if (isNew(tntFire)) player.health -= bombDmg(100);
    if (isNew(bigCrossFire)) player.health -= bombDmg(200);
    if (isNew(smallCrossFire)) player.health -= bombDmg(100);
    if (isNew(grenadeFire)) player.health -= bombDmg(255);
    if (isNew(smallBombFire)) player.health -= bombDmg(60);
    if (isNew(bigBombFire)) player.health -= bombDmg(84);
    if (isNew(landmineFire)) player.health -= bombDmg(60);
    if (isNew(smallDetFire)) player.health -= bombDmg(84);
    if (isNew(bigDetFire)) player.health -= bombDmg(100);
    if (isNew(plasticFire)) player.health -= bombDmg(84);
    if (isNew(nuclearFire)) player.health -= bombDmg(255);
    if (isNew(flameBarrelFire)) player.health -= bombDmg(220);
    if (isNew(diggerBombFire)) player.health -= bombDmg(10);
    if (isNew(jumpingBombFire)) player.health -= bombDmg([60, 84, 100][Math.floor(Math.random() * 3)]);
    // Monster contact damage (not scaled by bombDamagePct)
    if (!player.dead) {
      const ptx = player.tileX,
        pty = player.tileY;
      for (const s of slimeMgr.getEntities()) {
        if (s.phase === "alive" && s.tileX === ptx && s.tileY === pty) player.health -= 1;
      }
      for (const b of brownMgr.getEntities()) {
        if (b.phase === "alive" && b.tileX === ptx && b.tileY === pty) player.health -= 2;
      }
      for (const g of greyMgr.getEntities()) {
        if (g.phase === "alive" && g.tileX === ptx && g.tileY === pty) player.health -= 12;
      }
      for (const e of grenadierMgr.getEntities()) {
        if (e.phase === "alive" && e.tileX === ptx && e.tileY === pty) player.health -= 3;
      }
      for (const g of grenadeMgr.getEntities()) {
        if (g.phase === "flying" && g.tileX === ptx && g.tileY === pty) player.health -= 255;
      }
    }
    player.health = Math.max(0, player.health);
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      player.moving = false;
      player.digging = false;
      playSound("AARGH");
    }
  }
  // HOST: apply damage to all remote players
  if (netMgr.connected && netMgr.isHost) {
    for (const rp of remotePlayers.values()) {
      if (rp.dead) continue;
      const rpt = `${rp.tileX},${rp.tileY}`;
      const rptt = `${rp.targetTileX},${rp.targetTileY}`;
      const rpInFire = (cells: Set<string>) => cells.has(rpt) || cells.has(rptt);
      const rpIsNew = (cells: Set<string>) => rpInFire(cells) && !activeFireCells.has(rpt) && !activeFireCells.has(rptt);
      if (rpInFire(flamethrowerFire)) rp.health -= bombDmg(34);
      if (rpIsNew(flameBombFire)) rp.health -= bombDmg(84);
      if (rpIsNew(tntFire)) rp.health -= bombDmg(100);
      if (rpIsNew(bigCrossFire)) rp.health -= bombDmg(200);
      if (rpIsNew(smallCrossFire)) rp.health -= bombDmg(100);
      if (rpIsNew(grenadeFire)) rp.health -= bombDmg(255);
      if (rpIsNew(smallBombFire)) rp.health -= bombDmg(60);
      if (rpIsNew(bigBombFire)) rp.health -= bombDmg(84);
      if (rpIsNew(landmineFire)) rp.health -= bombDmg(60);
      if (rpIsNew(smallDetFire)) rp.health -= bombDmg(84);
      if (rpIsNew(bigDetFire)) rp.health -= bombDmg(100);
      if (rpIsNew(plasticFire)) rp.health -= bombDmg(84);
      if (rpIsNew(nuclearFire)) rp.health -= bombDmg(255);
      if (rpIsNew(flameBarrelFire)) rp.health -= bombDmg(220);
      if (rpIsNew(diggerBombFire)) rp.health -= bombDmg(10);
      if (rpIsNew(jumpingBombFire)) rp.health -= bombDmg([60, 84, 100][Math.floor(Math.random() * 3)]);
      const rpTx = rp.tileX,
        rpTy = rp.tileY;
      for (const s of slimeMgr.getEntities()) {
        if (s.phase === "alive" && s.tileX === rpTx && s.tileY === rpTy) rp.health -= 1;
      }
      for (const b of brownMgr.getEntities()) {
        if (b.phase === "alive" && b.tileX === rpTx && b.tileY === rpTy) rp.health -= 2;
      }
      for (const g of greyMgr.getEntities()) {
        if (g.phase === "alive" && g.tileX === rpTx && g.tileY === rpTy) rp.health -= 12;
      }
      for (const e of grenadierMgr.getEntities()) {
        if (e.phase === "alive" && e.tileX === rpTx && e.tileY === rpTy) rp.health -= 3;
      }
      for (const g of grenadeMgr.getEntities()) {
        if (g.phase === "flying" && g.tileX === rpTx && g.tileY === rpTy) rp.health -= 255;
      }
      rp.health = Math.max(0, rp.health);
      if (rp.health <= 0 && !rp.dead) {
        rp.dead = true;
        rp.moving = false;
        rp.digging = false;
        playSound("AARGH");
        // Kill reward: local (host) player earns 400–600 cash
        if (!player.dead) player.cash += 400 + Math.floor(Math.random() * 201);
      }
    }
  }
  activeFireCells = allFire;
  lavaMgr.applyFire(allFire, terrain, (c, r) => urethaneMgr.hasSolidAt(c, r) || plasticMgr.hasSolidAt(c, r));
  // Apply per-weapon damage to monsters, matching player damage values
  const monsterWeaponDamage: [Set<string>, number][] = [
    [flamethrowerFire, bombDmg(34)],
    [flameBombFire, bombDmg(84)],
    [tntFire, bombDmg(100)],
    [bigCrossFire, bombDmg(200)],
    [smallCrossFire, bombDmg(100)],
    [grenadeFire, bombDmg(255)],
    [smallBombFire, bombDmg(60)],
    [bigBombFire, bombDmg(84)],
    [landmineFire, bombDmg(60)],
    [smallDetFire, bombDmg(84)],
    [bigDetFire, bombDmg(100)],
    [plasticFire, bombDmg(84)],
    [nuclearFire, bombDmg(255)],
    [flameBarrelFire, bombDmg(220)],
    [diggerBombFire, bombDmg(10)],
    [jumpingBombFire, bombDmg(84)],
  ];
  for (const [fire, dmg] of monsterWeaponDamage) {
    slimeMgr.applyFire(fire, dmg);
    brownMgr.applyFire(fire, dmg);
    grenadierMgr.applyFire(fire, dmg);
    greyMgr.applyFire(fire, dmg);
  }
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
  for (const t of landmineMgr.chainDetonate(allFire, terrain)) {
    if (netMgr.connected && netMgr.isHost) netMgr.sendWeaponAct("landmine_trigger", 0, 0, t.tileX, t.tileY, "none", false, 0);
  }
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
    gameInventory.get(selectedWeapon) ?? 0,
    roundTick,
    tournamentConfig.timeLimitSec * 60,
    playerGold + player.cash, // HUD: banked cash + round gold
  );

  if (DEBUG_RECONCILIATION) {
    renderer.drawNetDebug(pingMs);
  }

  // HOST: send terrain+detail diffs immediately, then periodic state snapshot
  if (netMgr.connected && netMgr.isHost && prevTerrain && prevDetailType && prevBurnedGround) {
    const changes: TerrainChange[] = [];
    for (let r = 0; r < terrain.length; r++)
      for (let c = 0; c < terrain[r].length; c++) {
        const cellType = detailMap[r][c]?.type ?? "ground";
        const burned = !!detailMap[r][c]?.burnedGround;
        if (terrain[r][c] !== prevTerrain[r][c] || cellType !== prevDetailType[r][c] || burned !== prevBurnedGround[r][c]) {
          changes.push({ col: c, row: r, solid: terrain[r][c], cellType, burnedGround: burned || undefined });
          prevTerrain[r][c] = terrain[r][c];
          prevDetailType[r][c] = cellType;
          prevBurnedGround[r][c] = burned;
        }
      }
    netMgr.sendTerrainChanges(changes);
    netMgr.sendItemRemove(pickableMgr.lastRemovedIds, treasureMgr.lastRemovedIds);
    const netMonsters: NetMonster[] = [
      ...slimeMgr.getEntities().map((e) => ({
        kind: "slime" as const,
        x: e.x,
        y: e.y,
        tileX: e.tileX,
        tileY: e.tileY,
        targetTileX: e.targetTileX,
        targetTileY: e.targetTileY,
        dir: e.dir,
        moving: e.moving,
        animFrame: e.animFrame,
        animTick: e.animTick,
        digging: e.digging,
        digTileX: e.digTileX,
        digTileY: e.digTileY,
        phase: e.phase,
        hp: e.hp,
      })),
      ...brownMgr.getEntities().map((e) => ({
        kind: "brown" as const,
        x: e.x,
        y: e.y,
        tileX: e.tileX,
        tileY: e.tileY,
        targetTileX: e.targetTileX,
        targetTileY: e.targetTileY,
        dir: e.dir,
        moving: e.moving,
        animFrame: e.animFrame,
        animTick: e.animTick,
        digging: e.digging,
        digTileX: e.digTileX,
        digTileY: e.digTileY,
        phase: e.phase,
        hp: 0,
      })),
      ...grenadierMgr.getEntities().map((e) => ({
        kind: "grenadier" as const,
        x: e.x,
        y: e.y,
        tileX: e.tileX,
        tileY: e.tileY,
        targetTileX: e.targetTileX,
        targetTileY: e.targetTileY,
        dir: e.dir,
        moving: e.moving,
        animFrame: e.animFrame,
        animTick: e.animTick,
        digging: e.digging,
        digTileX: e.digTileX,
        digTileY: e.digTileY,
        phase: e.phase,
        hp: e.hp,
        shooting: e.shooting,
      })),
      ...greyMgr.getEntities().map((e) => ({
        kind: "grey" as const,
        x: e.x,
        y: e.y,
        tileX: e.tileX,
        tileY: e.tileY,
        targetTileX: e.targetTileX,
        targetTileY: e.targetTileY,
        dir: e.dir,
        moving: e.moving,
        animFrame: e.animFrame,
        animTick: e.animTick,
        digging: e.digging,
        digTileX: e.digTileX,
        digTileY: e.digTileY,
        phase: e.phase,
        hp: 0,
      })),
    ];
    netMgr.sendSnapshot(
      [
        toNetPlayer(player, netMgr.localPlayerId),
        ...[...remotePlayers.entries()].map(([pid, rp]) => toNetPlayer(rp, pid, netMgr.getLastRemoteInputSeq(pid))),
      ],
      netMonsters,
      collectPushables(),
      cloneMgr.getNetState(),
      doorSwitchMgr.isOn(),
      doorMgr.isOpen(),
      collectLava(),
      urethaneMgr.getNetState(),
      plasticMgr.getNetState(),
      roundTick,
    );
  }

  // After render: detect game-over conditions (host and offline only; clients wait for game_over msg)
  if (netMgr.isHost || !netMgr.connected) {
    const allPlayers = [player, ...remotePlayers.values()];
    const survivors = allPlayers.filter((p) => !p.dead);
    const isMultiplayer = remotePlayers.size > 0;
    const noTreasureLeft = hadTreasure && treasureMgr.getEntities().length === 0;
    const roundOver = survivors.length === 0 || (isMultiplayer && survivors.length === 1) || noTreasureLeft;

    if (roundOver) {
      deathTimer++;
      if (deathTimer >= DEATH_DELAY_FRAMES) {
        deathTimer = 0;
        returnToLobby(); // computes results, sends game_over to clients, redirects host
      }
    } else {
      deathTimer = 0;
    }
  }
}
