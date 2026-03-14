import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "@minebombers/shared";
import { InputManager } from "./input.js";
import { Renderer } from "./renderer.js";
import { createLocalPlayer, updatePlayer } from "./game.js";
import {
  generateTerrain,
  generateDetailMap,
  applyDigDamage,
  applyExplosionToTerrain,
  setTerrainTile,
  isStone,
  isDiggable,
} from "./terrain.js";
import { loadAssets, Assets } from "./assets.js";
import { TntManager } from "./tnt.js";
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

joinBtn.disabled = true;
statusEl.textContent = "Loading assets…";

loadAssets()
  .then((a) => {
    assets = a;
    renderer.initPatterns(assets);
    joinBtn.disabled = false;
    statusEl.textContent = "";
  })
  .catch((err: Error) => {
    statusEl.textContent = err.message;
  });

loadLevelThumbnails().catch(() => {
  levelStatusEl.textContent = "";
});

joinBtn.addEventListener("click", () => {
  player.name = nameInput.value.trim() || "Player";
  if (selectedLevel && levelData.has(selectedLevel)) {
    applyParsedLevel(parseMneLevel(levelData.get(selectedLevel)!));
  } else {
    applyParsedLevel(cachedRandomLevel ?? generateRandomLevel());
    cachedRandomLevel = null;
  }
  lobbyEl.style.display = "none";
  gameEl.style.display = "flex";
  requestAnimationFrame(loop);
});

const TARGET_MS = 1000 / 60;
let last = 0;
let prevTileX = player.tileX;
let prevTileY = player.tileY;
let needsResetBump = false;
let activeFireCells = new Set<string>();
let deathTimer = 0;
const DEATH_DELAY_FRAMES = 2 * 60;

function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (ts - last < TARGET_MS) return;
  last += TARGET_MS;
  // Prevent runaway catch-up (e.g. after tab was hidden)
  if (ts - last > TARGET_MS * 5) last = ts;

  // Reset switch bump debounce one frame after the player moved away,
  // so tryPush sees a clean state when they arrive at the adjacent tile.
  if (needsResetBump) {
    doorSwitchMgr.resetBump();
    needsResetBump = false;
  }

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

  updatePlayer(
    player,
    inputDir,
    input.consumeStopPress(),
    terrain,
    [
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
    ],
    jetpackMgr.getSpeed(),
    (c, r) => teleportMgr.hasPlacedAt(c, r) || treasureMgr.hasSolidAt(c, r),
  );

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
    needsResetBump = true;
  }
  if (doorSwitchMgr.consumePending()) {
    doorMgr.toggle();
    needsResetBump = false; // keep debounce active — held direction must not re-trigger
  }
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
  }
  if (!player.dead && input.consumeFireExtPress()) {
    fireExtMgr.fire(player.x, player.y, facingDir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
  }
  if (!player.dead && input.consumeDetonatePress()) {
    smallDetMgr.detonate(terrain);
    bigDetMgr.detonate(terrain);
  }
  if (!player.dead && input.consumeTreasurePress()) {
    treasureMgr.place(player.x, player.y, terrain);
  }

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
  lavaMgr.update(terrain, lavaBlocked);
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
  slimeMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY, monsterApplyDig);
  for (const e of slimeMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
  brownMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY, monsterApplyDig);
  for (const e of brownMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
  grenadierMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY, grenadeMgr, monsterApplyDig);
  for (const e of grenadierMgr.getEntities()) if (e.phase === "alive") treasureMgr.collectAt(e.tileX, e.tileY);
  greyMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY, monsterApplyDig);
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
  // Player damage from fire
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
  // Monster contact damage (1 damage per frame per monster on same tile)
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
    // Flying grenade collision damage
    for (const g of grenadeMgr.getEntities()) {
      if (g.phase === 'flying' && (g.tileX === ptx && g.tileY === pty)) player.health -= 255;
    }
  }
  player.health = Math.max(0, player.health);
  if (player.health <= 0 && !player.dead) {
    player.dead = true;
    player.moving = false;
    player.digging = false;
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
    [player],
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

  // After render: blood splatter visible — now count death delay
  const players = [player]; // extend here when multiplayer is added
  if (players.every((p) => p.dead)) {
    deathTimer++;
    if (deathTimer >= DEATH_DELAY_FRAMES) {
      deathTimer = 0;
      gameEl.style.display = "none";
      lobbyEl.style.display = "flex";
      player.health = MAX_HEALTH;
      player.dead = false;
    }
  }
}
