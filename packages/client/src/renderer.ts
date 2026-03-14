import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, HUD_HEIGHT } from "@minebombers/shared";
import { Terrain, TerrainDetailMap, isHardDigTile } from "./terrain.js";
import { LocalPlayer } from "./game.js";
import { Assets } from "./assets.js";
import { TntManager, TntEntity } from "./tnt.js";
import { BigCrossManager } from "./bigcross.js";
import { GrenadeManager } from "./grenade.js";
import { BombManager } from "./bomb.js";
import { LandmineManager } from "./landmine.js";
import { FlameBombManager } from "./flamebomb.js";
import { FlamethrowerManager } from "./flamethrower.js";
import { FireExtinguisherManager } from "./fireextinguisher.js";
import { DetBombManager } from "./detbomb.js";
import { UrethaneManager } from "./urethane.js";
import { PlasticManager } from "./plastic.js";
import { NuclearManager } from "./nuclear.js";
import { JumpingBombManager } from "./jumpingbomb.js";
import { LavaManager } from "./lava.js";
import { WallManager } from "./wall.js";
import { TeleportManager } from "./teleport.js";
import { BarrelManager } from "./barrel.js";
import { DiggerBombManager } from "./diggerbomb.js";
import { BoulderManager } from "./boulder.js";
import { SlimeManager } from "./slime.js";
import { BrownManager } from "./brown.js";
import { GrenadierManager } from "./grenadier.js";
import { GreyManager } from "./grey.js";
import { DoorManager } from "./door.js";
import { DoorSwitchManager } from "./doorswitch.js";
import { TreasureManager, TREASURE_NAMES } from "./treasure.js";
import { PickableManager, PICKABLE_TYPES } from "./pickable.js";
import { CloneManager } from "./clone.js";
import { MAX_HEALTH } from "./game.js";

const DISPLAY_SCALE = 3; // render everything at 3× — game logic stays at native tile size

// ── HUD palette ───────────────────────────────────────────────────────────────
const HUD_BG = "#000000";
const HUD_RULE = "#c8c800";
const HUD_PANEL = "#1a1a1a";
const HUD_BORDER = "#444444";
const NAME_COLORS = ["#ff4040", "#4040ff", "#40c040", "#c0a000"];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _groundPattern: CanvasPattern | null = null;
  private _terrainCanvas: HTMLCanvasElement | null = null;
  private _terrainDirty = true;

  readonly totalW: number;
  readonly totalH: number;

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.totalW = MAP_WIDTH * TILE_SIZE;
    this.totalH = MAP_HEIGHT * TILE_SIZE + HUD_HEIGHT;
    this.canvas.width = this.totalW * DISPLAY_SCALE;
    this.canvas.height = this.totalH * DISPLAY_SCALE;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.scale(DISPLAY_SCALE, DISPLAY_SCALE);
  }

  initPatterns(assets: Assets): void {
    this._groundPattern = this.ctx.createPattern(assets.ground, 'repeat');
    this._terrainDirty = true;
    this._assets = assets;
  }

  markTerrainDirty(): void { this._terrainDirty = true; }

  private _assets: Assets | null = null;


  render(assets: Assets, terrain: Terrain, detailMap: TerrainDetailMap, players: LocalPlayer[], myPlayer: LocalPlayer, tnt: TntManager, bigCross: BigCrossManager, smallCross: BigCrossManager, grenade: GrenadeManager, smallBomb: BombManager, bigBomb: BombManager, landmine: LandmineManager, flameBomb: FlameBombManager, flamethrower: FlamethrowerManager, fireExt: FireExtinguisherManager, smallDet: DetBombManager, bigDet: DetBombManager, urethane: UrethaneManager, plastic: PlasticManager, nuclear: NuclearManager, jumpingBomb: JumpingBombManager, lava: LavaManager, wall: WallManager, teleport: TeleportManager, barrel: BarrelManager, diggerBomb: DiggerBombManager, boulder: BoulderManager, slime: SlimeManager, brown: BrownManager, grenadier: GrenadierManager, grey: GreyManager, clone: CloneManager, door: DoorManager, doorSwitch: DoorSwitchManager, treasure: TreasureManager, pickable: PickableManager, selectedWeapon: string): void {
    const shake = nuclear.getShakeIntensity();
    if (shake > 0) {
      const MAX_SHAKE = 3;
      this.ctx.save();
      this.ctx.translate(
        (Math.random() * 2 - 1) * MAX_SHAKE * shake,
        (Math.random() * 2 - 1) * MAX_SHAKE * shake,
      );
    }
    this.drawHud(players, myPlayer, selectedWeapon);
    this.drawTerrain(detailMap, assets);
    this.drawWalls(assets, wall);
    this.drawBoulders(assets, boulder);
    this.drawDoors(assets, door);
    this.drawSwitches(assets, doorSwitch);
    // Treasure and pickables drawn under everything so weapons/players appear on top
    this.drawTreasure(assets, treasure);
    this.drawPickable(assets, pickable);
    // Lava and placed phase first — other weapons draw on top
    this.drawLava(assets, lava);
    this.drawTeleports(assets, teleport);
    this.drawUrethane(assets, urethane, 'placed');
    this.drawPlastic(assets, plastic, 'placed');
    this.drawTnt(assets, tnt);
    this.drawCross(assets.bigcross, bigCross);
    this.drawCross(assets.smallcross, smallCross);
    this.drawGrenades(assets, grenade);
    this.drawBomb(assets.smallbomb, smallBomb);
    this.drawBomb(assets.bigbomb, bigBomb);
    this.drawLandmines(assets, landmine);
    this.drawFlameBomb(assets, flameBomb);
    this.drawFlamethrower(assets, flamethrower);
    this.drawFireExtinguisher(assets, fireExt);
    this.drawDetBomb(assets.smalldetonate, smallDet);
    this.drawDetBomb(assets.bigdetonate, bigDet);
    this.drawNuclear(assets, nuclear);
    this.drawJumpingBomb(assets, jumpingBomb);
    this.drawBarrels(assets, barrel);
    this.drawDiggerBombs(assets, diggerBomb);
    // Dead monsters below burning/armed layer so urethane/plastic cover them
    for (const s of slime.getEntities()) { if (s.phase === 'dead') this.drawSlime(assets, s); }
    for (const b of brown.getEntities()) { if (b.phase === 'dead') this.drawBrown(assets, b); }
    for (const g of grenadier.getEntities()) { if (g.phase === 'dead') this.drawGrenadier(assets, g); }
    for (const g of grey.getEntities()) { if (g.phase === 'dead') this.drawGrey(assets, g); }
    for (const c of clone.getEntities()) { if (c.phase === 'dead') this.drawClone(assets, c, detailMap); }
    // Burning/armed phase on top — covers other items beneath
    this.drawUrethane(assets, urethane, 'burning');
    this.drawPlastic(assets, plastic, 'active');
    // Alive monsters on top of everything
    for (const s of slime.getEntities()) { if (s.phase !== 'dead') this.drawSlime(assets, s); }
    for (const b of brown.getEntities()) { if (b.phase !== 'dead') this.drawBrown(assets, b); }
    for (const g of grenadier.getEntities()) { if (g.phase !== 'dead') this.drawGrenadier(assets, g); }
    for (const g of grey.getEntities()) { if (g.phase !== 'dead') this.drawGrey(assets, g); }
    for (const c of clone.getEntities()) { if (c.phase !== 'dead') this.drawClone(assets, c, detailMap); }
    for (const p of players) this.drawPlayer(assets, p, detailMap);
    if (shake > 0) this.ctx.restore();
    this.drawNuclearFlash(nuclear);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private drawHud(players: LocalPlayer[], myPlayer: LocalPlayer, selectedWeapon: string): void {
    const { ctx } = this;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(0, 0, this.totalW, HUD_HEIGHT);
    ctx.fillStyle = HUD_RULE;
    ctx.fillRect(0, HUD_HEIGHT - 2, this.totalW, 2);

    players.forEach((p, i) => {
      this.drawPlayerPanel(p, i * 248 + 6, 4, p === myPlayer, p === myPlayer ? selectedWeapon : null);
    });
  }

  private drawPlayerPanel(p: LocalPlayer, x: number, y: number, isMe: boolean, selectedWeapon: string | null = null): void {
    const { ctx } = this;

    ctx.fillStyle = HUD_PANEL;
    ctx.fillRect(x, y, 236, HUD_HEIGHT - 8);
    ctx.strokeStyle = isMe ? "#40ff40" : HUD_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 236, HUD_HEIGHT - 8);

    // Name
    ctx.fillStyle = NAME_COLORS[p.color] ?? "#fff";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(p.name.slice(0, 9), x + 8, y + 4);

    // Selected weapon (right-aligned, same row as name)
    if (selectedWeapon) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.fillText(selectedWeapon, x + 228, y + 5);
      ctx.textAlign = "left";
    }

    // Cash
    ctx.fillStyle = "#00cc44";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`$${p.cash}`, x + 228, y + 20);
    ctx.textAlign = "left";

    // Bomb count
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(x + 12, y + 24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffdd00";
    ctx.font = "9px monospace";
    ctx.fillText("x1", x + 20, y + 20);

    // Health bar
    const barX = x + 8;
    const barY = y + 33;
    const barW = 140;
    const hpFrac = Math.max(0, p.health / MAX_HEALTH);
    ctx.fillStyle = "#330000";
    ctx.fillRect(barX, barY, barW, 9);
    ctx.fillStyle = hpFrac > 0.5 ? "#cc2020" : hpFrac > 0.25 ? "#cc7000" : "#cccc00";
    ctx.fillRect(barX, barY, Math.round(barW * hpFrac), 9);
    ctx.strokeStyle = "#660000";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 9);
    ctx.fillStyle = "#aaa";
    ctx.font = "8px monospace";
    ctx.fillText("HP", barX + barW + 4, barY + 8);

    // Dig power
    if (p.digPower > 0) {
      ctx.fillStyle = "#a06030";
      ctx.fillText(`⛏${p.digPower}`, barX, barY + 20);
    }
  }

  // ── Terrain ────────────────────────────────────────────────────────────────

  private buildTerrainCanvas(detailMap: TerrainDetailMap, assets: Assets): HTMLCanvasElement {
    const oc = document.createElement('canvas');
    oc.width  = MAP_WIDTH  * TILE_SIZE;
    oc.height = MAP_HEIGHT * TILE_SIZE;
    const octx = oc.getContext('2d')!;
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = octx.createPattern(assets.ground, 'repeat')!;
    octx.fillRect(0, 0, oc.width, oc.height);
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        const { type } = detailMap[row][col];
        if (type === 'ground') continue;
        const x = col * TILE_SIZE, y = row * TILE_SIZE;
        if (type === 'border') {
          octx.drawImage(assets.wall, x, y, TILE_SIZE, TILE_SIZE);
        } else {
          const sprite = assets.terrainTiles[type];
          octx.drawImage(sprite ?? assets.wall, x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    // Border overlays: draw directional borders on sand/solid_rock tiles adjacent to ground
    const borderDirs = [
      { dc: 0, dr: -1, dir: 'up' },
      { dc: 0, dr:  1, dir: 'down' },
      { dc: -1, dr: 0, dir: 'left' },
      { dc:  1, dr: 0, dir: 'right' },
    ];
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        const { type } = detailMap[row][col];
        const base = type.startsWith('solid_rock') ? 'solid_rock'
                   : type.startsWith('sand')        ? 'sand'
                   : null;
        if (!base) continue;
        const x = col * TILE_SIZE, y = row * TILE_SIZE;
        for (const { dc, dr, dir } of borderDirs) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= MAP_HEIGHT || nc < 0 || nc >= MAP_WIDTH) continue;
          const neighbor = detailMap[nr][nc];
          if (neighbor.type !== 'ground') continue;
          const key = neighbor.burnedGround ? `${base}_burned_${dir}` : `${base}_${dir}`;
          const sprite = assets.tileBorders[key];
          if (!sprite) continue;
          // Draw at natural size, aligned to the correct edge
          const bx = dir === 'right' ? x + TILE_SIZE - sprite.width  : x;
          const by = dir === 'down'  ? y + TILE_SIZE - sprite.height : y;
          octx.drawImage(sprite, bx, by);
        }
      }
    }
    return oc;
  }

  private drawTerrain(detailMap: TerrainDetailMap, assets: Assets): void {
    if (this._terrainDirty || !this._terrainCanvas) {
      this._terrainCanvas = this.buildTerrainCanvas(detailMap, assets);
      this._terrainDirty = false;
    }
    this.ctx.drawImage(this._terrainCanvas, 0, HUD_HEIGHT);
  }

  // ── Treasure ───────────────────────────────────────────────────────────────

  private drawTreasure(assets: Assets, mgr: TreasureManager): void {
    const { ctx } = this;
    for (const e of mgr.getEntities()) {
      const sprite = assets.treasure[TREASURE_NAMES.indexOf(e.type)];
      if (!sprite) continue;
      const x = e.col * TILE_SIZE;
      const y = e.row * TILE_SIZE + HUD_HEIGHT;
      ctx.drawImage(sprite, x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Pickables ──────────────────────────────────────────────────────────────

  private drawPickable(assets: Assets, mgr: PickableManager): void {
    const { ctx } = this;
    for (const e of mgr.getEntities()) {
      const sprite = assets.pickable[PICKABLE_TYPES.indexOf(e.type)];
      if (!sprite) continue;
      ctx.drawImage(sprite, e.col * TILE_SIZE, e.row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Teleports ──────────────────────────────────────────────────────────────

  private drawTeleports(assets: Assets, mgr: TeleportManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'placed') {
        this.ctx.drawImage(assets.teleport, e.col * TILE_SIZE, e.row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Boulders ───────────────────────────────────────────────────────────────

  private drawBoulders(assets: Assets, mgr: BoulderManager): void {
    for (const { tileX, tileY } of mgr.getEntities()) {
      this.ctx.drawImage(assets.boulder, tileX * TILE_SIZE, tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Placed Walls ───────────────────────────────────────────────────────────

  private drawWalls(assets: Assets, wall: WallManager): void {
    for (const { col, row } of wall.getEntities()) {
      this.ctx.drawImage(assets.wall, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Doors ──────────────────────────────────────────────────────────────────

  private drawDoors(assets: Assets, mgr: DoorManager): void {
    if (mgr.isOpen()) return;
    for (const { col, row } of mgr.getEntities()) {
      this.ctx.drawImage(assets.door, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Door Switches ──────────────────────────────────────────────────────────

  private drawSwitches(assets: Assets, mgr: DoorSwitchManager): void {
    const sprite = mgr.isOn() ? assets.doorswitch.on : assets.doorswitch.off;
    for (const { col, row } of mgr.getEntities()) {
      this.ctx.drawImage(sprite, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── TNT ────────────────────────────────────────────────────────────────────

  private drawTnt(assets: Assets, tnt: TntManager): void {
    for (const e of tnt.getEntities()) {
      if (e.phase === 'exploding') {
        this.drawTntExplosion(assets, tnt, e);
      }
      this.drawTntSprite(assets, tnt, e);
    }
  }

  private drawTntSprite(assets: Assets, tnt: TntManager, e: TntEntity): void {
    let sprite: HTMLCanvasElement;
    if (e.phase === 'fusing') {
      sprite = assets.tnt.fuse[tnt.fuseFrame(e)];
    } else if (e.phase === 'disabled') {
      sprite = assets.tnt.disabled;
    } else {
      return; // exploding phase — only show explosion cells
    }
    const x = e.tileX * TILE_SIZE;
    const y = e.tileY * TILE_SIZE + HUD_HEIGHT;
    this.ctx.drawImage(sprite, x, y, TILE_SIZE, TILE_SIZE);
  }

  private drawTntExplosion(assets: Assets, tnt: TntManager, e: TntEntity): void {
    const frame = assets.tnt.explosion[tnt.explosionFrame(e)];
    for (const [col, row] of tnt.explosionCells(e)) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE + HUD_HEIGHT;
      this.ctx.drawImage(frame, x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Big Cross ──────────────────────────────────────────────────────────────

  private drawCross(crossAssets: { fuse: HTMLCanvasElement[]; explosion: HTMLCanvasElement[] }, mgr: BigCrossManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'exploding') {
        const frame = crossAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      } else if (e.phase === 'fusing') {
        const sprite = crossAssets.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Bomb (small / big) ────────────────────────────────────────────────────

  private drawBomb(bombAssets: { fuse: HTMLCanvasElement[]; disabled: HTMLCanvasElement; explosion: HTMLCanvasElement[] }, mgr: BombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'exploding') {
        const frame = bombAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      } else if (e.phase === 'fusing') {
        const sprite = bombAssets.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'disabled') {
        this.ctx.drawImage(bombAssets.disabled, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Landmine ───────────────────────────────────────────────────────────────

  private drawLandmines(assets: Assets, mgr: LandmineManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'armed') {
        this.ctx.drawImage(assets.landmine, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Grenade ────────────────────────────────────────────────────────────────

  private drawGrenades(assets: Assets, mgr: GrenadeManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'flying') {
        this.ctx.drawImage(assets.grenade, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Flame Bomb ─────────────────────────────────────────────────────────────

  private drawFlameBomb(assets: Assets, mgr: FlameBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'fusing') {
        const sprite = assets.flamebomb.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'disabled') {
        this.ctx.drawImage(assets.flamebomb.disabled, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Flamethrower ───────────────────────────────────────────────────────────

  private drawFlamethrower(assets: Assets, mgr: FlamethrowerManager): void {
    for (const e of mgr.getEntities()) {
      const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
      for (const [col, row] of e.cells) {
        this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Urethane ───────────────────────────────────────────────────────────────

  private drawUrethane(assets: Assets, mgr: UrethaneManager, layer: 'placed' | 'burning'): void {
    if (layer === 'placed') {
      for (const e of mgr.getEntities()) {
        if (e.phase === 'placed') {
          this.ctx.drawImage(assets.urethane.placed, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    } else {
      for (const e of mgr.getEntities()) {
        if (e.phase === 'burning') {
          for (const [col, row] of e.cells) {
            this.ctx.drawImage(assets.urethane.burning, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        }
      }
      for (const f of mgr.getFires()) {
        const frame = assets.flamebomb.explosion[mgr.fireFrame(f)];
        this.ctx.drawImage(frame, f.col * TILE_SIZE, f.row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Det Bomb ───────────────────────────────────────────────────────────────

  private drawDetBomb(bombAssets: { placed: HTMLCanvasElement; explosion: HTMLCanvasElement[] }, mgr: DetBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'placed') {
        this.ctx.drawImage(bombAssets.placed, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = bombAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Fire Extinguisher ──────────────────────────────────────────────────────

  private drawFireExtinguisher(assets: Assets, mgr: FireExtinguisherManager): void {
    for (const e of mgr.getEntities()) {
      const frame = assets.tnt.explosion[mgr.smokeFrame(e)];
      for (const [col, row] of e.cells) {
        this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Plastic ────────────────────────────────────────────────────────────────

  private drawPlastic(assets: Assets, mgr: PlasticManager, layer: 'placed' | 'active'): void {
    if (layer === 'placed') {
      for (const e of mgr.getEntities()) {
        if (e.phase === 'placed') {
          this.ctx.drawImage(assets.plastic.placed, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    } else {
      for (const e of mgr.getEntities()) {
        if (e.phase === 'armed') {
          for (const [col, row] of e.armedCells) {
            this.ctx.drawImage(assets.plastic.armed, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        } else if (e.phase === 'exploding') {
          const frame = assets.plastic.explosion[mgr.explosionFrame(e)];
          for (const [col, row] of e.explosionCells) {
            this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
  }

  // ── Nuclear ────────────────────────────────────────────────────────────────

  private drawNuclear(assets: Assets, mgr: NuclearManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'fusing') {
        const frame = assets.nuclear.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(frame, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.nuclear.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  private drawNuclearFlash(mgr: NuclearManager): void {
    const intensity = mgr.getFlashIntensity();
    if (intensity <= 0) return;
    this.ctx.globalAlpha = intensity;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.totalW, this.totalH);
    this.ctx.globalAlpha = 1;
  }

  // ── Lava ───────────────────────────────────────────────────────────────────

  private drawLava(assets: Assets, mgr: LavaManager): void {
    for (const e of mgr.getEntities()) {
      for (const [col, row] of e.cellList) {
        this.ctx.drawImage(assets.lava, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Barrel ─────────────────────────────────────────────────────────────────

  private drawBarrels(assets: Assets, mgr: BarrelManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'placed') {
        this.ctx.drawImage(assets.barrel, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.centralCells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
        for (const s of e.secondaryBlasts) {
          for (const [col, row] of s.cells) {
            this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
  }

  // ── Digger Bomb ────────────────────────────────────────────────────────────

  private drawDiggerBombs(assets: Assets, mgr: DiggerBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === 'fusing') {
        this.ctx.drawImage(assets.diggerbomb, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === 'exploding') {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Jumping Bomb ───────────────────────────────────────────────────────────

  private drawJumpingBomb(assets: Assets, mgr: JumpingBombManager): void {
    for (const e of mgr.getEntities()) {
      // Draw bomb sprite at current position (unless exhausted)
      if (!e.done) {
        this.ctx.drawImage(assets.jumpingbomb, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
      // Draw all active explosion visuals
      for (const ex of e.explosions) {
        const frame = assets.tnt.explosion[mgr.explosionFrame(ex)];
        for (const [col, row] of ex.cells) {
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Slime ──────────────────────────────────────────────────────────────────

  private drawSlime(assets: Assets, s: import('./slime.js').SlimeEntity): void {
    if (s.phase === 'dead') {
      this.ctx.drawImage(assets.slime.dead, Math.round(s.x), Math.round(s.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = s.dir === 'none' ? 'down' : s.dir;
    const frames = assets.slime[dir];
    const frame = s.moving ? frames[s.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(s.x), Math.round(s.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Brown ──────────────────────────────────────────────────────────────────

  private drawBrown(assets: Assets, b: import('./brown.js').BrownEntity): void {
    if (b.phase === 'dead') {
      this.ctx.drawImage(assets.brown.dead, Math.round(b.x), Math.round(b.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = b.dir === 'none' ? 'down' : b.dir;
    const frames = assets.brown[dir];
    const frame = b.moving ? frames[b.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(b.x), Math.round(b.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Grey ───────────────────────────────────────────────────────────────────

  private drawGrey(assets: Assets, g: import('./grey.js').GreyEntity): void {
    if (g.phase === 'dead') {
      this.ctx.drawImage(assets.grey.dead, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = g.dir === 'none' ? 'down' : g.dir;
    const frames = assets.grey[dir];
    const frame = g.moving ? frames[g.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Grenadier ──────────────────────────────────────────────────────────────

  private drawGrenadier(assets: Assets, g: import('./grenadier.js').GrenadierEntity): void {
    if (g.phase === 'dead') {
      this.ctx.drawImage(assets.grenadier.dead, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = g.dir === 'none' ? 'down' : g.dir;
    const frames = assets.grenadier[dir];
    const frame = g.moving ? frames[g.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Clone ──────────────────────────────────────────────────────────────────

  private drawClone(assets: Assets, e: import('./clone.js').CloneEntity, detailMap: TerrainDetailMap): void {
    const dirKey = e.dir === 'none' ? 'down' : e.dir;
    if (e.phase === 'dead') {
      this.ctx.drawImage(assets.grey.dead, Math.round(e.x), Math.round(e.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    let frames: HTMLCanvasElement[];
    if (e.digging) {
      const cell = detailMap[e.digTileY]?.[e.digTileX];
      frames = (cell && isHardDigTile(cell.type)) ? assets.dig[dirKey] : assets.walk[dirKey];
    } else {
      frames = assets.walk[dirKey];
    }
    const frame = (e.moving || e.digging) ? frames[e.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(e.x), Math.round(e.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Player ─────────────────────────────────────────────────────────────────

  private drawPlayer(assets: Assets, p: LocalPlayer, detailMap: TerrainDetailMap): void {
    if (p.dead) {
      this.ctx.drawImage(assets.playerDead, Math.round(p.x), Math.round(p.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }

    const dirKey = p.dir === 'none' ? 'down' : p.dir;

    let frames: HTMLCanvasElement[];
    if (p.digging) {
      // Use digging animation for hard tiles, walk animation for soft tiles
      const dcol = p.dir === 'right' ? 1 : p.dir === 'left' ? -1 : 0;
      const drow = p.dir === 'down'  ? 1 : p.dir === 'up'   ? -1 : 0;
      const nc = p.tileX + dcol, nr = p.tileY + drow;
      const cell = detailMap[nr]?.[nc];
      frames = (cell && isHardDigTile(cell.type)) ? assets.dig[dirKey] : assets.walk[dirKey];
    } else {
      frames = assets.walk[dirKey];
    }

    const frame = (p.moving || p.digging) ? frames[p.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(p.x), Math.round(p.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }
}
