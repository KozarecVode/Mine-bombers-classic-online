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

const WEAPONS = ['tnt', 'bigcross', 'smallcross', 'grenade', 'smallbomb', 'bigbomb', 'landmine'] as const;
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
  const placeDir = player.moving ? "none" : player.dir;

  updatePlayer(player, input.getDirection(), input.consumeStopPress(), terrain, [tntMgr, bigCrossMgr, smallCrossMgr]);
  if (input.consumeWeaponSwitch()) {
    selectedWeapon = WEAPONS[(WEAPONS.indexOf(selectedWeapon) + 1) % WEAPONS.length];
  }
  if (input.consumeTntPress()) {
    if      (selectedWeapon === 'tnt')        tntMgr.place(tileX, tileY, placeDir, terrain);
    else if (selectedWeapon === 'bigcross')   bigCrossMgr.place(tileX, tileY, placeDir, terrain);
    else if (selectedWeapon === 'smallcross') smallCrossMgr.place(tileX, tileY, placeDir, terrain);
    else if (selectedWeapon === 'grenade')    grenadeMgr.place(player.x, player.y, player.dir, terrain);
    else if (selectedWeapon === 'smallbomb')  smallBombMgr.place(tileX, tileY, placeDir, terrain);
    else if (selectedWeapon === 'bigbomb')    bigBombMgr.place(tileX, tileY, placeDir, terrain);
    else if (selectedWeapon === 'landmine')   landmineMgr.place(player.x, player.y, terrain);
  }

  tntMgr.update(player.x, player.y, terrain);
  bigCrossMgr.update(player.x, player.y, terrain);
  smallCrossMgr.update(player.x, player.y, terrain);
  grenadeMgr.update(terrain, [tntMgr, bigCrossMgr, smallCrossMgr, smallBombMgr, bigBombMgr]);
  smallBombMgr.update(player.x, player.y, terrain);
  bigBombMgr.update(player.x, player.y, terrain);
  landmineMgr.update(player.x, player.y, terrain);

  // Cross-chain: all weapon fire cells can trigger each other
  const allFire = new Set([
    ...tntMgr.getFireCells(), ...bigCrossMgr.getFireCells(), ...smallCrossMgr.getFireCells(),
    ...grenadeMgr.getFireCells(), ...smallBombMgr.getFireCells(), ...bigBombMgr.getFireCells(),
    ...landmineMgr.getFireCells(),
  ]);
  tntMgr.chainDetonate(allFire, terrain);
  bigCrossMgr.chainDetonate(allFire, terrain);
  smallCrossMgr.chainDetonate(allFire, terrain);
  grenadeMgr.chainDetonate(allFire, terrain);
  smallBombMgr.chainDetonate(allFire, terrain);
  bigBombMgr.chainDetonate(allFire, terrain);
  landmineMgr.chainDetonate(allFire, terrain);

  renderer.render(assets, terrain, [player], player, tntMgr, bigCrossMgr, smallCrossMgr, grenadeMgr, smallBombMgr, bigBombMgr, landmineMgr);
}
