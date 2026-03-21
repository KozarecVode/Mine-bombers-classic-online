import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, HUD_HEIGHT } from "@minebombers/shared";
import { Terrain, TerrainDetailMap, isHardDigTile, isStone } from "./terrain.js";
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
const HUD_RULE = "#333333";
const HUD_PANEL = "#1a1a1a";
const HUD_BORDER = "#444444";
const NAME_COLORS = ["#4040ff", "#ff4040", "#40c040", "#c0a000"];

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
    this._groundPattern = this.ctx.createPattern(assets.ground, "repeat");
    this._terrainDirty = true;
    this._assets = assets;
  }

  markTerrainDirty(): void {
    this._terrainDirty = true;
  }

  private _assets: Assets | null = null;
  private _terrain: Terrain | null = null;
  private _door: DoorManager | null = null;
  private _doorSwitch: DoorSwitchManager | null = null;

  private skipFireCell(col: number, row: number): boolean {
    if (this._terrain && isStone(this._terrain, col, row)) return true;
    if (this._door?.hasAt(col, row)) return true;
    if (this._doorSwitch?.hasSolidAt(col, row)) return true;
    return false;
  }

  render(
    assets: Assets,
    terrain: Terrain,
    detailMap: TerrainDetailMap,
    players: LocalPlayer[],
    myPlayer: LocalPlayer,
    tnt: TntManager,
    bigCross: BigCrossManager,
    smallCross: BigCrossManager,
    grenade: GrenadeManager,
    smallBomb: BombManager,
    bigBomb: BombManager,
    landmine: LandmineManager,
    flameBomb: FlameBombManager,
    flamethrower: FlamethrowerManager,
    fireExt: FireExtinguisherManager,
    smallDet: DetBombManager,
    bigDet: DetBombManager,
    urethane: UrethaneManager,
    plastic: PlasticManager,
    nuclear: NuclearManager,
    jumpingBomb: JumpingBombManager,
    lava: LavaManager,
    wall: WallManager,
    teleport: TeleportManager,
    barrel: BarrelManager,
    diggerBomb: DiggerBombManager,
    boulder: BoulderManager,
    slime: SlimeManager,
    brown: BrownManager,
    grenadier: GrenadierManager,
    grey: GreyManager,
    clone: CloneManager,
    door: DoorManager,
    doorSwitch: DoorSwitchManager,
    treasure: TreasureManager,
    pickable: PickableManager,
    selectedWeapon: string,
    weaponCount: number,
    roundTick: number,
    timeLimitTicks: number,
    playerGold: number,
  ): void {
    this._terrain = terrain;
    this._door = door;
    this._doorSwitch = doorSwitch;
    const shake = nuclear.getShakeIntensity();
    if (shake > 0) {
      const MAX_SHAKE = 3;
      this.ctx.save();
      this.ctx.translate((Math.random() * 2 - 1) * MAX_SHAKE * shake, (Math.random() * 2 - 1) * MAX_SHAKE * shake);
    }
    this.drawHud(players, myPlayer, selectedWeapon, weaponCount, playerGold);
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
    this.drawUrethane(assets, urethane, "placed");
    this.drawPlastic(assets, plastic, "placed");
    this.drawTnt(assets, tnt, door, doorSwitch);
    this.drawCross(assets.bigcross, bigCross);
    this.drawCross(assets.smallcross, smallCross);
    this.drawGrenades(assets, grenade);
    this.drawBomb(assets.smallbomb, smallBomb, door, doorSwitch);
    this.drawBomb(assets.bigbomb, bigBomb, door, doorSwitch);
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
    for (const s of slime.getEntities()) {
      if (s.phase === "dead") this.drawSlime(assets, s);
    }
    for (const b of brown.getEntities()) {
      if (b.phase === "dead") this.drawBrown(assets, b);
    }
    for (const g of grenadier.getEntities()) {
      if (g.phase === "dead") this.drawGrenadier(assets, g);
    }
    for (const g of grey.getEntities()) {
      if (g.phase === "dead") this.drawGrey(assets, g);
    }
    for (const c of clone.getEntities()) {
      if (c.phase === "dead") this.drawClone(assets, c, detailMap);
    }
    // Burning/armed phase on top — covers other items beneath
    this.drawUrethane(assets, urethane, "burning");
    this.drawPlastic(assets, plastic, "active");
    // Alive monsters on top of everything
    for (const s of slime.getEntities()) {
      if (s.phase !== "dead") this.drawSlime(assets, s);
    }
    for (const b of brown.getEntities()) {
      if (b.phase !== "dead") this.drawBrown(assets, b);
    }
    for (const g of grenadier.getEntities()) {
      if (g.phase !== "dead") this.drawGrenadier(assets, g);
    }
    for (const g of grey.getEntities()) {
      if (g.phase !== "dead") this.drawGrey(assets, g);
    }
    for (const c of clone.getEntities()) {
      if (c.phase !== "dead") this.drawClone(assets, c, detailMap);
    }
    // Dead players (blood splatters) below alive players
    for (const p of players) { if (p.dead) this.drawPlayer(assets, p, detailMap); }
    for (const p of players) { if (!p.dead) this.drawPlayer(assets, p, detailMap); }
    if (shake > 0) this.ctx.restore();
    this.drawNuclearFlash(nuclear);
    this.drawTimerBar(roundTick, timeLimitTicks);
  }


  // ── Timer bar ──────────────────────────────────────────────────────────────

  private drawTimerBar(roundTick: number, timeLimitTicks: number): void {
    if (timeLimitTicks <= 0) return;
    const frac = Math.max(0, 1 - roundTick / timeLimitTicks);
    const barH = 3;
    const y = this.totalH - barH;
    this.ctx.fillStyle = "#111111";
    this.ctx.fillRect(0, y, this.totalW, barH);
    if (frac > 0) {
      this.ctx.fillStyle = "#ffdd00";
      this.ctx.fillRect(0, y, Math.round(this.totalW * frac), barH);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  // Maps weapon id → shop icon filename
  private static readonly WEAPON_ICON: Record<string, string> = {
    smallbomb: "small_bomb",
    bigbomb: "big_bomb",
    tnt: "tnt",
    nuclear: "nuclear",
    smalldetonate: "small_detonate",
    bigdetonate: "big_detonate",
    grenade: "grenade",
    landmine: "landmine",
    flamethrower: "flamethrower",
    flamebomb: "flame_bomb",
    barrel: "barrel",
    smallcross: "small_cross",
    bigcross: "big_cross",
    urethane: "urethane",
    plastic: "plastic",
    diggerbomb: "digger_bomb",
    wall: "wall",
    teleport: "teleport",
    clone: "clone",
    lava: "lava",
    fireextinguisher: "fire_extinguisher",
    armor: "armor",
    jumpingbomb: "jumping_bomb",
    jetpack: "jetpack",
  };

  private drawHud(players: LocalPlayer[], myPlayer: LocalPlayer, selectedWeapon: string, weaponCount: number, playerGold: number): void {
    const { ctx } = this;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(0, 0, this.totalW, HUD_HEIGHT);

    ctx.fillRect(0, HUD_HEIGHT - 2, this.totalW, 2);
    this.drawPlayerPanel(myPlayer, selectedWeapon, weaponCount, playerGold);
  }

  private drawPlayerPanel(p: LocalPlayer, selectedWeapon: string, weaponCount: number, playerGold: number): void {
    if (!this._assets) return;
    const { ctx } = this;
    const assets = this._assets;

    const panelX = 0;
    const panelH = 30;
    const panelW = 143;
    const panelY = Math.floor((HUD_HEIGHT - panelH) / 2) + 13;

    // Draw player state background (has built-in HP bar on right side)
    const panel = assets.playerStatePanels[p.color] ?? assets.playerStatePanels[0];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(panel, panelX, panelY, panelW, panelH);

    // Vertical HP bar on the right side of the panel
    const BAR_COLORS = ["#00008B ", "#ff2222", "#22cc44", "#ffdd00"];
    const barX = panelX + 133;
    const barW = 8;
    const barH = panelH - 4;
    const barY = panelY + 2;
    const hpFrac = Math.max(0, p.health / (MAX_HEALTH + p.armorBonus));
    const fillH = Math.round(barH * hpFrac);
    ctx.fillStyle = "#111111";
    ctx.fillRect(barX, barY, barW, barH);
    if (fillH > 0) {
      ctx.fillStyle = BAR_COLORS[p.color] ?? BAR_COLORS[0];
      ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
    }

    // Weapon icon in the left 30×30 black square; fall back to small_bomb when no icon
    const iconName = Renderer.WEAPON_ICON[selectedWeapon] ?? "small_bomb";
    const iconImg = assets.shopIcons[iconName] ?? assets.shopIcons["small_bomb"];
    if (iconImg) {
      const iconSize = 30;
      const iconSlotCx = panelX + 4 + 14; // centre of the 28px slot
      const iconSlotCy = panelY + 1 + 14;
      ctx.drawImage(iconImg, iconSlotCx - iconSize / 2, iconSlotCy - iconSize / 2, iconSize, iconSize);
      // Count badge — top-left corner of the icon (always shown)
      const countStr = String(weaponCount);
      ctx.font = "bold 7px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = "#000000";
      ctx.fillText(countStr, panelX + 3, panelY + 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(countStr, panelX + 5, panelY + 2);
    }

    // Player name above dig power
    ctx.textBaseline = "top";
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#cccccc";
    ctx.fillText(p.name.slice(0, 10), panelX + 38, panelY + 2);

    // Dig power (red) and cash (yellow) in the centre section
    const textY = panelY + panelH - 11;
    const textY2 = panelY + panelH - 2;
    ctx.textBaseline = "bottom";
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff4444";
    ctx.fillText(`${p.digPower}`, panelX + 55, textY);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffdd00";
    ctx.fillText(`$${playerGold}`, panelX + 75, textY2);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  // ── Terrain ────────────────────────────────────────────────────────────────

  private buildTerrainCanvas(detailMap: TerrainDetailMap, assets: Assets): HTMLCanvasElement {
    const oc = document.createElement("canvas");
    oc.width = MAP_WIDTH * TILE_SIZE;
    oc.height = MAP_HEIGHT * TILE_SIZE;
    const octx = oc.getContext("2d")!;
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = octx.createPattern(assets.ground, "repeat")!;
    octx.fillRect(0, 0, oc.width, oc.height);
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        const { type } = detailMap[row][col];
        if (type === "ground") continue;
        const x = col * TILE_SIZE,
          y = row * TILE_SIZE;
        if (type === "border") {
          octx.drawImage(assets.wall, x, y, TILE_SIZE, TILE_SIZE);
        } else {
          const sprite = assets.terrainTiles[type];
          octx.drawImage(sprite ?? assets.wall, x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    // Border overlays: draw directional borders on sand/solid_rock tiles adjacent to ground
    const borderDirs = [
      { dc: 0, dr: -1, dir: "up" },
      { dc: 0, dr: 1, dir: "down" },
      { dc: -1, dr: 0, dir: "left" },
      { dc: 1, dr: 0, dir: "right" },
    ];
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        const { type } = detailMap[row][col];
        const base = type.startsWith("solid_rock") ? "solid_rock" : type.startsWith("sand") ? "sand" : null;
        if (!base) continue;
        const x = col * TILE_SIZE,
          y = row * TILE_SIZE;
        for (const { dc, dr, dir } of borderDirs) {
          const nr = row + dr,
            nc = col + dc;
          if (nr < 0 || nr >= MAP_HEIGHT || nc < 0 || nc >= MAP_WIDTH) continue;
          const neighbor = detailMap[nr][nc];
          if (neighbor.type !== "ground") continue;
          const key = neighbor.burnedGround ? `${base}_burned_${dir}` : `${base}_${dir}`;
          const sprite = assets.tileBorders[key];
          if (!sprite) continue;
          // Draw at natural size, aligned to the correct edge
          const bx = dir === "right" ? x + TILE_SIZE - sprite.width : x;
          const by = dir === "down" ? y + TILE_SIZE - sprite.height : y;
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
      if (e.phase === "placed") {
        this.ctx.drawImage(assets.teleport, e.col * TILE_SIZE, e.row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
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

  private drawTnt(assets: Assets, tnt: TntManager, door: DoorManager, doorSwitch: DoorSwitchManager): void {
    for (const e of tnt.getEntities()) {
      if (e.phase === "exploding") {
        this.drawTntExplosion(assets, tnt, e, door, doorSwitch);
      }
      this.drawTntSprite(assets, tnt, e);
    }
  }

  private drawTntSprite(assets: Assets, tnt: TntManager, e: TntEntity): void {
    let sprite: HTMLCanvasElement;
    if (e.phase === "fusing") {
      sprite = assets.tnt.fuse[tnt.fuseFrame(e)];
    } else if (e.phase === "disabled") {
      sprite = assets.tnt.disabled;
    } else {
      return; // exploding phase — only show explosion cells
    }
    const x = e.tileX * TILE_SIZE;
    const y = e.tileY * TILE_SIZE + HUD_HEIGHT;
    this.ctx.drawImage(sprite, x, y, TILE_SIZE, TILE_SIZE);
  }

  private drawTntExplosion(assets: Assets, tnt: TntManager, e: TntEntity, _door: DoorManager, _doorSwitch: DoorSwitchManager): void {
    const frame = assets.tnt.explosion[tnt.explosionFrame(e)];
    for (const [col, row] of tnt.explosionCells(e)) {
      if (this.skipFireCell(col, row)) continue;
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE + HUD_HEIGHT;
      this.ctx.drawImage(frame, x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  // ── Big Cross ──────────────────────────────────────────────────────────────

  private drawCross(crossAssets: { fuse: HTMLCanvasElement[]; explosion: HTMLCanvasElement[] }, mgr: BigCrossManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "exploding") {
        const frame = crossAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      } else if (e.phase === "fusing") {
        const sprite = crossAssets.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Bomb (small / big) ────────────────────────────────────────────────────

  private drawBomb(
    bombAssets: { fuse: HTMLCanvasElement[]; disabled: HTMLCanvasElement; explosion: HTMLCanvasElement[] },
    mgr: BombManager,
    _door: DoorManager,
    _doorSwitch: DoorSwitchManager,
  ): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "exploding") {
        const frame = bombAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      } else if (e.phase === "fusing") {
        const sprite = bombAssets.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "disabled") {
        this.ctx.drawImage(bombAssets.disabled, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Landmine ───────────────────────────────────────────────────────────────

  private drawLandmines(assets: Assets, mgr: LandmineManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "armed") {
        this.ctx.drawImage(assets.landmine, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Grenade ────────────────────────────────────────────────────────────────

  private drawGrenades(assets: Assets, mgr: GrenadeManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "flying") {
        this.ctx.drawImage(assets.grenade, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Flame Bomb ─────────────────────────────────────────────────────────────

  private drawFlameBomb(assets: Assets, mgr: FlameBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "fusing") {
        const sprite = assets.flamebomb.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(sprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "disabled") {
        this.ctx.drawImage(assets.flamebomb.disabled, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
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
        if (this.skipFireCell(col, row)) continue;
        this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Urethane ───────────────────────────────────────────────────────────────

  private drawUrethane(assets: Assets, mgr: UrethaneManager, layer: "placed" | "burning"): void {
    if (layer === "placed") {
      for (const e of mgr.getEntities()) {
        if (e.phase === "placed") {
          this.ctx.drawImage(assets.urethane.placed, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    } else {
      for (const e of mgr.getEntities()) {
        if (e.phase === "burning") {
          for (const [col, row] of e.cells) {
            this.ctx.drawImage(assets.urethane.burning, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        }
      }
      for (const f of mgr.getFires()) {
        if (this.skipFireCell(f.col, f.row)) continue;
        const frame = assets.flamebomb.explosion[mgr.fireFrame(f)];
        this.ctx.drawImage(frame, f.col * TILE_SIZE, f.row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Det Bomb ───────────────────────────────────────────────────────────────

  private drawDetBomb(bombAssets: { placed: HTMLCanvasElement[]; explosion: HTMLCanvasElement[] }, mgr: DetBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "placed") {
        const placedSprite = bombAssets.placed[e.ownerColor] ?? bombAssets.placed[0];
        this.ctx.drawImage(placedSprite, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = bombAssets.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
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
        if (this.skipFireCell(col, row)) continue;
        this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Plastic ────────────────────────────────────────────────────────────────

  private drawPlastic(assets: Assets, mgr: PlasticManager, layer: "placed" | "active"): void {
    if (layer === "placed") {
      for (const e of mgr.getEntities()) {
        if (e.phase === "placed") {
          this.ctx.drawImage(assets.plastic.placed, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    } else {
      for (const e of mgr.getEntities()) {
        if (e.phase === "armed") {
          for (const [col, row] of e.armedCells) {
            this.ctx.drawImage(assets.plastic.armed, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        } else if (e.phase === "exploding") {
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
      if (e.phase === "fusing") {
        const frame = assets.nuclear.fuse[mgr.fuseFrame(e)];
        this.ctx.drawImage(frame, e.centerX * TILE_SIZE, e.centerY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.nuclear.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  private drawNuclearFlash(mgr: NuclearManager): void {
    const intensity = mgr.getFlashIntensity();
    if (intensity <= 0) return;
    this.ctx.globalAlpha = intensity;
    this.ctx.fillStyle = "#ffffff";
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
      if (e.phase === "placed") {
        this.ctx.drawImage(assets.barrel, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.centralCells) {
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
        for (const s of e.secondaryBlasts) {
          for (const [col, row] of s.cells) {
            if (this.skipFireCell(col, row)) continue;
            this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
  }

  // ── Digger Bomb ────────────────────────────────────────────────────────────

  private drawDiggerBombs(assets: Assets, mgr: DiggerBombManager): void {
    for (const e of mgr.getEntities()) {
      if (e.phase === "fusing") {
        this.ctx.drawImage(assets.diggerbomb, e.tileX * TILE_SIZE, e.tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      } else if (e.phase === "exploding") {
        const frame = assets.tnt.explosion[mgr.explosionFrame(e)];
        for (const [col, row] of e.cells) {
          if (this.skipFireCell(col, row)) continue;
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
          if (this.skipFireCell(col, row)) continue;
          this.ctx.drawImage(frame, col * TILE_SIZE, row * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ── Slime ──────────────────────────────────────────────────────────────────

  private drawSlime(assets: Assets, s: import("./slime.js").SlimeEntity): void {
    if (s.phase === "dead") {
      this.ctx.drawImage(assets.slime.dead, Math.round(s.x), Math.round(s.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = s.dir === "none" ? "down" : s.dir;
    const frames = assets.slime[dir];
    const frame = s.moving ? frames[s.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(s.x), Math.round(s.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Brown ──────────────────────────────────────────────────────────────────

  private drawBrown(assets: Assets, b: import("./brown.js").BrownEntity): void {
    if (b.phase === "dead") {
      this.ctx.drawImage(assets.brown.dead, Math.round(b.x), Math.round(b.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = b.dir === "none" ? "down" : b.dir;
    const frames = assets.brown[dir];
    const frame = b.moving ? frames[b.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(b.x), Math.round(b.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Grey ───────────────────────────────────────────────────────────────────

  private drawGrey(assets: Assets, g: import("./grey.js").GreyEntity): void {
    if (g.phase === "dead") {
      this.ctx.drawImage(assets.grey.dead, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = g.dir === "none" ? "down" : g.dir;
    const frames = assets.grey[dir];
    const frame = g.moving ? frames[g.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Grenadier ──────────────────────────────────────────────────────────────

  private drawGrenadier(assets: Assets, g: import("./grenadier.js").GrenadierEntity): void {
    if (g.phase === "dead") {
      this.ctx.drawImage(assets.grenadier.dead, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    const dir = g.dir === "none" ? "down" : g.dir;
    const frames = assets.grenadier[dir];
    const frame = g.moving ? frames[g.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(g.x), Math.round(g.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Clone ──────────────────────────────────────────────────────────────────

  private drawClone(assets: Assets, e: import("./clone.js").CloneEntity, detailMap: TerrainDetailMap): void {
    const dirKey = e.dir === "none" ? "down" : e.dir;
    if (e.phase === "dead") {
      this.ctx.drawImage(assets.grey.dead, Math.round(e.x), Math.round(e.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }
    let frames: HTMLCanvasElement[];
    if (e.digging) {
      const cell = detailMap[e.digTileY]?.[e.digTileX];
      frames =
        cell && isHardDigTile(cell.type)
          ? (assets.dig[e.color] ?? assets.dig[0])[dirKey]
          : (assets.walk[e.color] ?? assets.walk[0])[dirKey];
    } else {
      frames = (assets.walk[e.color] ?? assets.walk[0])[dirKey];
    }
    const frame = e.moving || e.digging ? frames[e.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, Math.round(e.x), Math.round(e.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
  }

  // ── Player ─────────────────────────────────────────────────────────────────

  private drawPlayer(assets: Assets, p: LocalPlayer, detailMap: TerrainDetailMap): void {
    if (p.dead) {
      this.ctx.drawImage(assets.playerDead, Math.round(p.x), Math.round(p.y) + HUD_HEIGHT, TILE_SIZE, TILE_SIZE);
      return;
    }

    const dirKey = p.dir === "none" ? "down" : p.dir;

    const playerWalk = assets.walk[p.color] ?? assets.walk[0];
    const playerDig = assets.dig[p.color] ?? assets.dig[0];

    let frames: HTMLCanvasElement[];
    if (p.digging) {
      // Use digging animation for hard tiles, walk animation for soft tiles
      const dcol = p.dir === "right" ? 1 : p.dir === "left" ? -1 : 0;
      const drow = p.dir === "down" ? 1 : p.dir === "up" ? -1 : 0;
      const nc = p.tileX + dcol,
        nr = p.tileY + drow;
      const cell = detailMap[nr]?.[nc];
      frames = cell && isHardDigTile(cell.type) ? playerDig[dirKey] : playerWalk[dirKey];
    } else {
      frames = playerWalk[dirKey];
    }

    const px = Math.round(p.x),
      py = Math.round(p.y) + HUD_HEIGHT;
    const frame = p.moving || p.digging ? frames[p.animFrame % frames.length] : frames[0];
    this.ctx.drawImage(frame, px, py, TILE_SIZE, TILE_SIZE);
  }
}
