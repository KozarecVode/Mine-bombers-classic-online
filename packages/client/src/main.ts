import { TILE_SIZE } from '@minebombers/shared';
import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { createLocalPlayer, updatePlayer } from './game.js';
import { generateTerrain } from './terrain.js';
import { loadAssets, Assets } from './assets.js';
import { TntManager } from './tnt.js';

const lobbyEl   = document.getElementById('lobby')!;
const gameEl    = document.getElementById('game')!;
const statusEl  = document.getElementById('status')!;
const nameInput = document.getElementById('nameInput') as HTMLInputElement;
const joinBtn   = document.getElementById('joinBtn') as HTMLButtonElement;

const input    = new InputManager();
const renderer = new Renderer();
const terrain  = generateTerrain();
const player   = createLocalPlayer('Player', 0);
const tntMgr   = new TntManager();

let assets: Assets;

joinBtn.disabled = true;
statusEl.textContent = 'Loading assets…';

loadAssets()
  .then((a) => {
    assets = a;
    renderer.initPatterns(assets);
    joinBtn.disabled = false;
    statusEl.textContent = '';
  })
  .catch((err: Error) => {
    statusEl.textContent = err.message;
  });

joinBtn.addEventListener('click', () => {
  player.name = nameInput.value.trim() || 'Player';
  lobbyEl.style.display = 'none';
  gameEl.style.display  = 'flex';
  requestAnimationFrame(loop);
});

const TARGET_MS = 1000 / 60;
let last = 0;

function loop(ts: number): void {
  requestAnimationFrame(loop);
  if (ts - last < TARGET_MS) return;
  last = ts;
  updatePlayer(player, input.getDirection(), input.consumeStopPress(), terrain, tntMgr);
  if (input.consumeTntPress()) tntMgr.place(player.tileX * TILE_SIZE, player.tileY * TILE_SIZE, player.moving ? 'none' : player.dir, terrain);
  tntMgr.update(player.x, player.y, terrain);
  renderer.render(assets, terrain, [player], player, tntMgr);
}
