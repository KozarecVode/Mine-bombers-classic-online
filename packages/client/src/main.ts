import { TILE_SIZE } from "@minebombers/shared";
import { InputManager } from "./input.js";
import { Renderer } from "./renderer.js";
import { createLocalPlayer, updatePlayer } from "./game.js";
import { generateTerrain } from "./terrain.js";
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

const lobbyEl = document.getElementById("lobby")!;
const gameEl = document.getElementById("game")!;
const statusEl = document.getElementById("status")!;
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const joinBtn = document.getElementById("joinBtn") as HTMLButtonElement;

const input = new InputManager();
const renderer = new Renderer();
const terrain = generateTerrain();
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

joinBtn.addEventListener("click", () => {
  player.name = nameInput.value.trim() || "Player";
  lobbyEl.style.display = "none";
  gameEl.style.display = "flex";
  requestAnimationFrame(loop);
});

const TARGET_MS = 1000 / 60;
let last = 0;
let prevTileX = player.tileX;
let prevTileY = player.tileY;
let needsResetBump = false;

function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (ts - last < TARGET_MS) return;
  last = ts;

  // Reset switch bump debounce one frame after the player moved away,
  // so tryPush sees a clean state when they arrive at the adjacent tile.
  if (needsResetBump) {
    doorSwitchMgr.resetBump();
    needsResetBump = false;
  }

  const tileX = player.tileX * TILE_SIZE;
  const tileY = player.tileY * TILE_SIZE;
  const facingDir = player.dir; // capture before updatePlayer can change it

  updatePlayer(
    player,
    input.getDirection(),
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
  );

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
  if (input.consumeWeaponSwitch()) {
    selectedWeapon = WEAPONS[(WEAPONS.indexOf(selectedWeapon) + 1) % WEAPONS.length];
  }
  if (input.consumeTntPress()) {
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
  }
  if (input.consumeFireExtPress()) {
    fireExtMgr.fire(player.x, player.y, facingDir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
  }
  if (input.consumeDetonatePress()) {
    smallDetMgr.detonate(terrain);
    bigDetMgr.detonate(terrain);
  }

  tntMgr.update(player.x, player.y, terrain);
  bigCrossMgr.update(player.x, player.y, terrain);
  smallCrossMgr.update(player.x, player.y, terrain);
  const monsterSolid = {
    hasSolidAt: (c: number, r: number) =>
      slimeMgr.getEntities().some((s) => s.phase === "alive" && s.tileX === c && s.tileY === r) ||
      brownMgr.getEntities().some((b) => b.phase === "alive" && b.tileX === c && b.tileY === r) ||
      grenadierMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r) ||
      greyMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r),
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
    monsterSolid,
  ]);
  smallBombMgr.update(player.x, player.y, terrain);
  bigBombMgr.update(player.x, player.y, terrain);
  landmineMgr.update(player.x, player.y, terrain);
  flameBombMgr.update(player.x, player.y, terrain);
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
    jumpingBombMgr.hasSolidAt(c, r);
  lavaMgr.update(terrain, lavaBlocked);
  teleportMgr.update(terrain);
  barrelMgr.update(player.x, player.y, terrain);
  diggerBombMgr.update(player.x, player.y, terrain);
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
    greyMgr.getEntities().some((g) => g.phase === "alive" && g.tileX === c && g.tileY === r);
  slimeMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY);
  brownMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY);
  grenadierMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY, [
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
    monsterSolid,
  ]);
  greyMgr.update(terrain, slimeSolidAt, player.tileX, player.tileY);
  // Monsters trigger armed landmines they walk onto
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
  landmineMgr.chainDetonate(monsterTiles, terrain);
  jetpackMgr.update();

  // Cross-chain: all weapon fire cells can trigger each other
  const grenadeFire = grenadeMgr.getFireCells();
  const allFire = new Set([
    ...tntMgr.getFireCells(),
    ...bigCrossMgr.getFireCells(),
    ...smallCrossMgr.getFireCells(),
    ...grenadeFire,
    ...smallBombMgr.getFireCells(),
    ...bigBombMgr.getFireCells(),
    ...landmineMgr.getFireCells(),
    ...flameBombMgr.getFireCells(),
    ...flamethrowerMgr.getFireCells(),
    ...smallDetMgr.getFireCells(),
    ...bigDetMgr.getFireCells(),
    ...plasticMgr.getFireCells(),
    ...nuclearMgr.getFireCells(),
    ...jumpingBombMgr.getFireCells(),
    ...teleportMgr.getFireCells(),
    ...barrelMgr.getFireCells(),
    ...diggerBombMgr.getFireCells(),
    ...grenadierMgr.getFireCells(),
  ]);
  const flameFire = new Set([...flameBombMgr.getFireCells(), ...flamethrowerMgr.getFireCells()]);
  lavaMgr.applyFire(allFire, terrain, (c, r) => urethaneMgr.hasSolidAt(c, r) || plasticMgr.hasSolidAt(c, r));
  slimeMgr.applyFire(allFire);
  brownMgr.applyFire(allFire);
  grenadierMgr.applyFire(allFire);
  greyMgr.applyFire(allFire);
  wallMgr.applyFire(allFire, terrain);
  urethaneMgr.spreadFireThrough(flameFire, allFire);
  tntMgr.chainDetonate(allFire, terrain);
  bigCrossMgr.chainDetonate(allFire, terrain);
  smallCrossMgr.chainDetonate(allFire, terrain);
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
  diggerBombMgr.chainDetonate(allFire, terrain);
  wallMgr.restoreTerrain(terrain);

  renderer.render(
    assets,
    terrain,
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
    doorMgr,
    doorSwitchMgr,
    selectedWeapon,
  );
}
