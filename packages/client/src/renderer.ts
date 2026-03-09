import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, HUD_HEIGHT } from "@minebombers/shared";
import { Terrain } from "./terrain.js";
import { LocalPlayer } from "./game.js";
import { Assets } from "./assets.js";
import { TntManager, TntEntity } from "./tnt.js";

const DISPLAY_SCALE = 2; // render everything at 2× — game logic stays at native tile size

// ── HUD palette ───────────────────────────────────────────────────────────────
const HUD_BG = "#000000";
const HUD_RULE = "#c8c800";
const HUD_PANEL = "#1a1a1a";
const HUD_BORDER = "#444444";
const NAME_COLORS = ["#ff4040", "#4040ff", "#40c040", "#c0a000"];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrainCanvas: HTMLCanvasElement | null = null;
  private cachedTerrain: Terrain | null = null;

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
    this.cachedTerrain = null;
    this._assets = assets;
  }

  private _assets: Assets | null = null;

  private buildTerrainCanvas(terrain: Terrain, assets: Assets): HTMLCanvasElement {
    const oc = document.createElement("canvas");
    oc.width = MAP_WIDTH * TILE_SIZE;
    oc.height = MAP_HEIGHT * TILE_SIZE;
    const octx = oc.getContext("2d")!;
    octx.imageSmoothingEnabled = false;

    const groundPat = octx.createPattern(assets.ground, "repeat")!;
    const wallPat = octx.createPattern(assets.wall, "repeat")!;

    octx.fillStyle = groundPat;
    octx.fillRect(0, 0, oc.width, oc.height);

    octx.fillStyle = wallPat;
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        if (terrain[row][col]) {
          octx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    return oc;
  }

  render(assets: Assets, terrain: Terrain, players: LocalPlayer[], myPlayer: LocalPlayer, tnt: TntManager): void {
    this.drawHud(players, myPlayer);
    this.drawTerrain(terrain);
    this.drawTnt(assets, tnt);
    for (const p of players) this.drawPlayer(assets, p);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private drawHud(players: LocalPlayer[], myPlayer: LocalPlayer): void {
    const { ctx } = this;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(0, 0, this.totalW, HUD_HEIGHT);
    ctx.fillStyle = HUD_RULE;
    ctx.fillRect(0, HUD_HEIGHT - 2, this.totalW, 2);

    players.forEach((p, i) => {
      this.drawPlayerPanel(p, i * 248 + 6, 4, p === myPlayer);
    });
  }

  private drawPlayerPanel(p: LocalPlayer, x: number, y: number, isMe: boolean): void {
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
    ctx.fillStyle = "#330000";
    ctx.fillRect(barX, barY, barW, 9);
    ctx.fillStyle = "#cc2020";
    ctx.fillRect(barX, barY, barW, 9);
    ctx.strokeStyle = "#660000";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 9);
    ctx.fillStyle = "#aaa";
    ctx.font = "8px monospace";
    ctx.fillText("HP", barX + barW + 4, barY + 8);
  }

  // ── Terrain ────────────────────────────────────────────────────────────────

  private drawTerrain(terrain: Terrain): void {
    if (!this._assets) return;
    if (terrain !== this.cachedTerrain) {
      this.cachedTerrain = terrain;
      this.terrainCanvas = this.buildTerrainCanvas(terrain, this._assets);
    }
    this.ctx.drawImage(this.terrainCanvas!, 0, HUD_HEIGHT);
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

  // ── Player ─────────────────────────────────────────────────────────────────

  private drawPlayer(assets: Assets, p: LocalPlayer): void {
    const frames = assets.walk[p.dir === "none" ? "down" : p.dir];
    const frame = p.moving ? frames[p.animFrame % frames.length] : frames[0];

    const dstX = Math.round(p.x);
    const dstY = Math.round(p.y) + HUD_HEIGHT;

    this.ctx.drawImage(frame, dstX, dstY, TILE_SIZE, TILE_SIZE);
  }
}
