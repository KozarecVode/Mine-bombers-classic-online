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

const lobbyEl   = document.getElementById("lobby")!;
const gameEl    = document.getElementById("game")!;
const statusEl  = document.getElementById("status")!;
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const joinBtn   = document.getElementById("joinBtn") as HTMLButtonElement;

const input      = new InputManager();
const renderer   = new Renderer();
const terrain    = generateTerrain();
const player     = createLocalPlayer("Player", 0);
const tntMgr        = new TntManager();
const bigCrossMgr   = new BigCrossManager();
const smallCrossMgr = new BigCrossManager(15);
const grenadeMgr    = new GrenadeManager();
const smallBombMgr  = new BombManager(SMALL_BOMB_PATTERN);
const bigBombMgr    = new BombManager(BIG_BOMB_PATTERN);
const landmineMgr   = new LandmineManager();
const flameBombMgr      = new FlameBombManager();
const flamethrowerMgr   = new FlamethrowerManager();
const fireExtMgr        = new FireExtinguisherManager();
const smallDetMgr       = new DetBombManager(SMALL_DETONATE_PATTERN);
const bigDetMgr         = new DetBombManager(BIG_DETONATE_PATTERN);
const urethaneMgr       = new UrethaneManager();
const plasticMgr        = new PlasticManager();
const nuclearMgr        = new NuclearManager();
const jumpingBombMgr    = new JumpingBombManager();
const lavaMgr           = new LavaManager();

const WEAPONS = ['tnt', 'bigcross', 'smallcross', 'grenade', 'smallbomb', 'bigbomb', 'landmine', 'flamebomb', 'flamethrower', 'fireextinguisher', 'smalldetonate', 'bigdetonate', 'urethane', 'plastic', 'nuclear', 'jumpingbomb', 'lava'] as const;
type WeaponName = typeof WEAPONS[number];
let selectedWeapon: WeaponName = 'tnt';

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
  gameEl.style.display  = "flex";
  requestAnimationFrame(loop);
});

const TARGET_MS = 1000 / 60;
let last = 0;

function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (ts - last < TARGET_MS) return;
  last = ts;

  const tileX = player.tileX * TILE_SIZE;
  const tileY = player.tileY * TILE_SIZE;
  const facingDir = player.dir; // capture before updatePlayer can change it

  updatePlayer(player, input.getDirection(), input.consumeStopPress(), terrain, [tntMgr, bigCrossMgr, smallCrossMgr, smallBombMgr, bigBombMgr, flameBombMgr, smallDetMgr, bigDetMgr, urethaneMgr, plasticMgr, lavaMgr]);
  if (input.consumeWeaponSwitch()) {
    selectedWeapon = WEAPONS[(WEAPONS.indexOf(selectedWeapon) + 1) % WEAPONS.length];
  }
  if (input.consumeTntPress()) {
    if      (selectedWeapon === 'tnt')           tntMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'bigcross')      bigCrossMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'smallcross')    smallCrossMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'grenade')       grenadeMgr.place(player.x, player.y, player.dir, terrain);
    else if (selectedWeapon === 'smallbomb')     smallBombMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'bigbomb')       bigBombMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'landmine')      landmineMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === 'flamebomb')     flameBombMgr.place(tileX, tileY, 'none', terrain);
    else if (selectedWeapon === 'flamethrower')  flamethrowerMgr.fire(player.x, player.y, player.dir, terrain, player.moving);
    else if (selectedWeapon === 'fireextinguisher') fireExtMgr.fire(player.x, player.y, player.dir, terrain, [tntMgr, smallBombMgr, bigBombMgr, flameBombMgr], player.moving);
    else if (selectedWeapon === 'smalldetonate') smallDetMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === 'bigdetonate')   bigDetMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === 'urethane')      { if (!lavaMgr.hasSolidAt(player.tileX, player.tileY)) urethaneMgr.place(player.x, player.y, terrain); }
    else if (selectedWeapon === 'plastic')       { if (!lavaMgr.hasSolidAt(player.tileX, player.tileY)) plasticMgr.place(player.x, player.y, terrain); }
    else if (selectedWeapon === 'nuclear')       nuclearMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === 'jumpingbomb')   jumpingBombMgr.place(player.x, player.y, terrain);
    else if (selectedWeapon === 'lava')          lavaMgr.place(player.x, player.y, terrain);
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
  grenadeMgr.update(terrain, [tntMgr, bigCrossMgr, smallCrossMgr, smallBombMgr, bigBombMgr, landmineMgr, urethaneMgr, plasticMgr]);
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
    tntMgr.hasSolidAt(c, r) || bigCrossMgr.hasSolidAt(c, r) || smallCrossMgr.hasSolidAt(c, r) ||
    grenadeMgr.hasSolidAt(c, r) || smallBombMgr.hasSolidAt(c, r) || bigBombMgr.hasSolidAt(c, r) ||
    landmineMgr.hasSolidAt(c, r) || flameBombMgr.hasSolidAt(c, r) || smallDetMgr.hasSolidAt(c, r) ||
    bigDetMgr.hasSolidAt(c, r) || urethaneMgr.hasSolidAt(c, r) || plasticMgr.hasSolidAt(c, r) ||
    nuclearMgr.hasSolidAt(c, r) || jumpingBombMgr.hasSolidAt(c, r);
  lavaMgr.update(terrain, lavaBlocked);

  // Cross-chain: all weapon fire cells can trigger each other
  const allFire = new Set([
    ...tntMgr.getFireCells(), ...bigCrossMgr.getFireCells(), ...smallCrossMgr.getFireCells(),
    ...grenadeMgr.getFireCells(), ...smallBombMgr.getFireCells(), ...bigBombMgr.getFireCells(),
    ...landmineMgr.getFireCells(), ...flameBombMgr.getFireCells(), ...flamethrowerMgr.getFireCells(),
    ...smallDetMgr.getFireCells(), ...bigDetMgr.getFireCells(), ...plasticMgr.getFireCells(),
    ...nuclearMgr.getFireCells(), ...jumpingBombMgr.getFireCells(),
  ]);
  const flameFire = new Set([...flameBombMgr.getFireCells(), ...flamethrowerMgr.getFireCells()]);
  lavaMgr.applyFire(allFire, terrain, (c, r) => urethaneMgr.hasSolidAt(c, r) || plasticMgr.hasSolidAt(c, r));
  urethaneMgr.spreadFireThrough(flameFire, allFire);
  tntMgr.chainDetonate(allFire, terrain);
  bigCrossMgr.chainDetonate(allFire, terrain);
  smallCrossMgr.chainDetonate(allFire, terrain);
  grenadeMgr.chainDetonate(allFire, terrain);
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

  renderer.render(assets, terrain, [player], player, tntMgr, bigCrossMgr, smallCrossMgr, grenadeMgr, smallBombMgr, bigBombMgr, landmineMgr, flameBombMgr, flamethrowerMgr, fireExtMgr, smallDetMgr, bigDetMgr, urethaneMgr, plasticMgr, nuclearMgr, jumpingBombMgr, lavaMgr, selectedWeapon);
}
