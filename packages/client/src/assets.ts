export interface Assets {
  ground: HTMLImageElement;
  wall:   HTMLImageElement;
  walk: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
  };
  tnt: {
    fuse:      HTMLCanvasElement[]; // [tnt_1, tnt_2, tnt_10]
    disabled:  HTMLCanvasElement;
    explosion: HTMLCanvasElement[]; // interpolated sequence from explosion_1→2→3
  };
  bigcross: {
    fuse:      HTMLCanvasElement[]; // single sprite repeated across all fuse frames
    explosion: HTMLCanvasElement[]; // shared explosion animation
  };
  smallcross: {
    fuse:      HTMLCanvasElement[];
    explosion: HTMLCanvasElement[];
  };
  grenade: HTMLCanvasElement;
  landmine: HTMLCanvasElement;
  smallbomb: {
    fuse:      HTMLCanvasElement[];
    disabled:  HTMLCanvasElement;
    explosion: HTMLCanvasElement[];
  };
  bigbomb: {
    fuse:      HTMLCanvasElement[];
    disabled:  HTMLCanvasElement;
    explosion: HTMLCanvasElement[];
  };
  flamebomb: {
    fuse:      HTMLCanvasElement[]; // [flame_bomb_1, flame_bomb_2] — loops
    disabled:  HTMLCanvasElement;
    explosion: HTMLCanvasElement[];
  };
  smalldetonate: { placed: HTMLCanvasElement; explosion: HTMLCanvasElement[] };
  bigdetonate:   { placed: HTMLCanvasElement; explosion: HTMLCanvasElement[] };
  urethane: { placed: HTMLCanvasElement; burning: HTMLCanvasElement };
  plastic:  { placed: HTMLCanvasElement; armed: HTMLCanvasElement; explosion: HTMLCanvasElement[] };
  nuclear:       { fuse: HTMLCanvasElement[]; explosion: HTMLCanvasElement[] };
  jumpingbomb:   HTMLCanvasElement;
  lava:          HTMLCanvasElement;
  teleport:      HTMLCanvasElement;
  barrel:        HTMLCanvasElement;
  diggerbomb:    HTMLCanvasElement;
  boulder:       HTMLCanvasElement;
  slime: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
    dead:  HTMLCanvasElement;
  };
  brown: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
    dead:  HTMLCanvasElement;
  };
  grenadier: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
    dead:  HTMLCanvasElement;
  };
  grey: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
    dead:  HTMLCanvasElement;
  };
  door:          HTMLImageElement;
  doorswitch:    { off: HTMLCanvasElement; on: HTMLCanvasElement };
  treasure:      HTMLCanvasElement[]; // 10 sprites, indexed by TREASURE_NAMES order
  pickable:      HTMLCanvasElement[]; // 5 sprites, indexed by PICKABLE_TYPES order
  terrainTiles:  Record<string, HTMLCanvasElement>; // keyed by TerrainTileType
  dig: {
    up:    HTMLCanvasElement[];
    down:  HTMLCanvasElement[];
    left:  HTMLCanvasElement[];
    right: HTMLCanvasElement[];
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Remove the background color (sampled from top-left pixel) from a sprite. */
function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

function removeBg(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;

  const bgR = px[0], bgG = px[1], bgB = px[2];

  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === bgR && px[i + 1] === bgG && px[i + 2] === bgB) {
      px[i + 3] = 0;
    }
  }

  ctx.putImageData(data, 0, 0);
  return c;
}

async function loadFrames(dir: string, prefix: string, n: number): Promise<HTMLCanvasElement[]> {
  const imgs = await Promise.all(
    Array.from({ length: n }, (_, i) => loadImage(`/art/walk/player_1/${dir}/${prefix}${i + 1}.png`)),
  );
  return imgs.map(removeBg);
}

/**
 * Cross-fade between consecutive keyframes, generating `steps` intermediate
 * canvases between each pair.  With 3 source frames and steps=4 you get 11
 * frames total: [f1, blend×4, f2, blend×4, f3].
 */
function interpolateFrames(frames: HTMLCanvasElement[], steps: number): HTMLCanvasElement[] {
  const result: HTMLCanvasElement[] = [];
  for (let i = 0; i < frames.length; i++) {
    result.push(frames[i]);
    if (i < frames.length - 1) {
      const a = frames[i];
      const b = frames[i + 1];
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const c = document.createElement('canvas');
        c.width  = a.width;
        c.height = a.height;
        const ctx = c.getContext('2d')!;
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(a, 0, 0);
        ctx.globalAlpha = t;
        ctx.drawImage(b, 0, 0);
        ctx.globalAlpha = 1;
        result.push(c);
      }
    }
  }
  return result;
}

async function loadExplosionFrames(): Promise<HTMLCanvasElement[]> {
  const [e1, e2, e3] = await Promise.all([
    loadImage('/art/texture/explosion/explosion_1.png'),
    loadImage('/art/texture/explosion/explosion_2.png'),
    loadImage('/art/texture/explosion/explosion_3.png'),
  ]);
  return interpolateFrames([e1, e2, e3].map(removeBg), 4);
}

async function loadTntAssets(explosion: HTMLCanvasElement[]): Promise<Assets['tnt']> {
  const [t1, t2, t3, disabled] = await Promise.all([
    loadImage('/art/texture/weapons/tnt/tnt_1.png'),
    loadImage('/art/texture/weapons/tnt/tnt_2.png'),
    loadImage('/art/texture/weapons/tnt/tnt_10.png'),
    loadImage('/art/texture/weapons/tnt/tnt_disabled.png'),
  ]);
  return {
    fuse:      [t1, t2, t3].map(removeBg),
    disabled:  removeBg(disabled),
    explosion,
  };
}

async function loadSmallBombAssets(explosion: HTMLCanvasElement[]): Promise<Assets['smallbomb']> {
  const [s1, s2, s3, disabled] = await Promise.all([
    loadImage('/art/texture/weapons/small_bomb/small_bomb_1.png'),
    loadImage('/art/texture/weapons/small_bomb/small_bomb_2.png'),
    loadImage('/art/texture/weapons/small_bomb/small_bomb_3.png'),
    loadImage('/art/texture/weapons/small_bomb/small_bomb_disabled.png'),
  ]);
  return { fuse: [s1, s2, s3].map(removeBg), disabled: removeBg(disabled), explosion };
}

async function loadFlameBombAssets(explosion: HTMLCanvasElement[]): Promise<Assets['flamebomb']> {
  const [f1, f2, fd] = await Promise.all([
    loadImage('/art/texture/weapons/flame_bomb/flame_bomb_1.png'),
    loadImage('/art/texture/weapons/flame_bomb/flame_bomb_2.png'),
    loadImage('/art/texture/weapons/flame_bomb/flame_bomb_disabled.png'),
  ]);
  return { fuse: [f1, f2].map(removeBg), disabled: removeBg(fd), explosion };
}

async function loadBigBombAssets(explosion: HTMLCanvasElement[]): Promise<Assets['bigbomb']> {
  const [b1, b2, b3, disabled] = await Promise.all([
    loadImage('/art/texture/weapons/big_bomb/big_bomb_1.png'),
    loadImage('/art/texture/weapons/big_bomb/big_bomb_2.png'),
    loadImage('/art/texture/weapons/big_bomb/big_bomb_3.png'),
    loadImage('/art/texture/weapons/big_bomb/big_bomb_disabled.png'),
  ]);
  return { fuse: [b1, b2, b3].map(removeBg), disabled: removeBg(disabled), explosion };
}

async function loadBigCrossAssets(explosion: HTMLCanvasElement[]): Promise<Assets['bigcross']> {
  const bc1 = await loadImage('/art/texture/weapons/big_cross/big_cross_1.png');
  const sprite = removeBg(bc1);
  return { fuse: [sprite, sprite, sprite], explosion };
}

async function loadSmallCrossAssets(explosion: HTMLCanvasElement[]): Promise<Assets['smallcross']> {
  const sc1 = await loadImage('/art/texture/weapons/small_cross/small_cross_1.png');
  const sprite = removeBg(sc1);
  return { fuse: [sprite, sprite, sprite], explosion };
}

async function loadGrenadierAssets(): Promise<Assets['grenadier']> {
  const base = '/art/texture/monsters/grenadier';
  const [r1, r2, r3, r4, l1, l2, l3, l4, u1, u2, u3, u4, d1, d2, d3, d4, deadImg] = await Promise.all([
    loadImage(`${base}/right/tile_6_16.png`),
    loadImage(`${base}/right/tile_6_17.png`),
    loadImage(`${base}/right/tile_6_18.png`),
    loadImage(`${base}/right/tile_6_19.png`),
    loadImage(`${base}/left/tile_6_20.png`),
    loadImage(`${base}/left/tile_6_21.png`),
    loadImage(`${base}/left/tile_6_22.png`),
    loadImage(`${base}/left/tile_6_23.png`),
    loadImage(`${base}/up/tile_6_24.png`),
    loadImage(`${base}/up/tile_6_25.png`),
    loadImage(`${base}/up/tile_6_26.png`),
    loadImage(`${base}/up/tile_6_27.png`),
    loadImage(`${base}/down/tile_6_28.png`),
    loadImage(`${base}/down/tile_6_29.png`),
    loadImage(`${base}/down/tile_6_30.png`),
    loadImage(`${base}/down/tile_6_31.png`),
    loadImage('/art/texture/world/dead.png'),
  ]);
  return {
    right: [r1, r2, r3, r4].map(removeBg),
    left:  [l1, l2, l3, l4].map(removeBg),
    up:    [u1, u2, u3, u4].map(removeBg),
    down:  [d1, d2, d3, d4].map(removeBg),
    dead:  removeBg(deadImg),
  };
}

async function loadBrownAssets(): Promise<Assets['brown']> {
  const base = '/art/texture/monsters/brown';
  const [r1, r2, r3, r4, l1, l2, l3, l4, u1, u2, u3, u4, d1, d2, d3, d4, deadImg] = await Promise.all([
    loadImage(`${base}/right/tile_5_16.png`),
    loadImage(`${base}/right/tile_5_17.png`),
    loadImage(`${base}/right/tile_5_18.png`),
    loadImage(`${base}/right/tile_5_19.png`),
    loadImage(`${base}/left/tile_5_20.png`),
    loadImage(`${base}/left/tile_5_21.png`),
    loadImage(`${base}/left/tile_5_22.png`),
    loadImage(`${base}/left/tile_5_23.png`),
    loadImage(`${base}/up/tile_5_24.png`),
    loadImage(`${base}/up/tile_5_25.png`),
    loadImage(`${base}/up/tile_5_26.png`),
    loadImage(`${base}/up/tile_5_27.png`),
    loadImage(`${base}/down/tile_5_28.png`),
    loadImage(`${base}/down/tile_5_29.png`),
    loadImage(`${base}/down/tile_5_30.png`),
    loadImage(`${base}/down/tile_5_31.png`),
    loadImage('/art/texture/world/dead.png'),
  ]);
  return {
    right: [r1, r2, r3, r4].map(removeBg),
    left:  [l1, l2, l3, l4].map(removeBg),
    up:    [u1, u2, u3, u4].map(removeBg),
    down:  [d1, d2, d3, d4].map(removeBg),
    dead:  removeBg(deadImg),
  };
}

async function loadSlimeAssets(): Promise<Assets['slime']> {
  const base = '/art/texture/monsters/slime';
  const [r1, r2, r3, r4, l1, l2, l3, l4, u1, u2, u3, u4, d1, d2, d3, d4, deadImg] = await Promise.all([
    loadImage(`${base}/right/slime_1.png`),
    loadImage(`${base}/right/slime_2.png`),
    loadImage(`${base}/right/slime_3.png`),
    loadImage(`${base}/right/slime_4.png`),
    loadImage(`${base}/left/tile_7_20.png`),
    loadImage(`${base}/left/tile_7_21.png`),
    loadImage(`${base}/left/tile_7_22.png`),
    loadImage(`${base}/left/tile_7_23.png`),
    loadImage(`${base}/up/tile_7_24.png`),
    loadImage(`${base}/up/tile_7_25.png`),
    loadImage(`${base}/up/tile_7_26.png`),
    loadImage(`${base}/up/tile_7_27.png`),
    loadImage(`${base}/down/tile_7_28.png`),
    loadImage(`${base}/down/tile_7_29.png`),
    loadImage(`${base}/down/tile_7_30.png`),
    loadImage(`${base}/down/tile_7_31.png`),
    loadImage(`${base}/dead.png`),
  ]);
  return {
    right: [r1, r2, r3, r4].map(removeBg),
    left:  [l1, l2, l3, l4].map(removeBg),
    up:    [u1, u2, u3, u4].map(removeBg),
    down:  [d1, d2, d3, d4].map(removeBg),
    dead:  removeBg(deadImg),
  };
}

async function loadGreyAssets(): Promise<Assets['grey']> {
  const base = '/art/texture/monsters/grey';
  const [r1, r2, r3, r4, l1, l2, l3, l4, u1, u2, u3, u4, d1, d2, d3, d4, deadImg] = await Promise.all([
    loadImage(`${base}/right/tile_8_0.png`),
    loadImage(`${base}/right/tile_8_1.png`),
    loadImage(`${base}/right/tile_8_2.png`),
    loadImage(`${base}/right/tile_8_3.png`),
    loadImage(`${base}/left/tile_8_4.png`),
    loadImage(`${base}/left/tile_8_5.png`),
    loadImage(`${base}/left/tile_8_6.png`),
    loadImage(`${base}/left/tile_8_7.png`),
    loadImage(`${base}/up/tile_8_8.png`),
    loadImage(`${base}/up/tile_8_9.png`),
    loadImage(`${base}/up/tile_8_10.png`),
    loadImage(`${base}/up/tile_8_11.png`),
    loadImage(`${base}/down/tile_8_12.png`),
    loadImage(`${base}/down/tile_8_13.png`),
    loadImage(`${base}/down/tile_8_14.png`),
    loadImage(`${base}/down/tile_8_15.png`),
    loadImage('/art/texture/world/dead.png'),
  ]);
  return {
    right: [r1, r2, r3, r4].map(removeBg),
    left:  [l1, l2, l3, l4].map(removeBg),
    up:    [u1, u2, u3, u4].map(removeBg),
    down:  [d1, d2, d3, d4].map(removeBg),
    dead:  removeBg(deadImg),
  };
}

async function loadTreasureAssets(): Promise<HTMLCanvasElement[]> {
  const names = ["bar", "bracelet", "cross", "crown", "diamond", "egg", "mushroom", "ring", "scepter", "shield"];
  const imgs = await Promise.all(names.map((n) => loadImage(`/art/texture/world/treasure/${n}.png`)));
  return imgs.map(removeBg);
}

async function loadTerrainTileAssets(): Promise<Record<string, HTMLCanvasElement>> {
  const names = [
    'brick_1', 'brick_2', 'brick_3',
    'solid_rock_1', 'solid_rock_2', 'solid_rock_3', 'solid_rock_4',
    'rock_1', 'rock_2', 'rock_3', 'rock_4',
    'rock_destroyed_1', 'rock_destroyed_2',
    'sand_1', 'sand_2', 'sand_3',
    'sand_rock_1', 'sand_rock_2',
  ];
  const imgs = await Promise.all(names.map(n => loadImage(`/art/texture/world/terrain/${n}.png`)));
  const result: Record<string, HTMLCanvasElement> = {};
  imgs.forEach((img, i) => { result[names[i]] = toCanvas(img); });
  return result;
}

async function loadDigAnimation(): Promise<Assets['dig']> {
  async function loadDigDir(dir: string, start: number): Promise<HTMLCanvasElement[]> {
    const imgs = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        loadImage(`/art/walk/player_1/digging/${dir}/tile_20_${start + i}.png`),
      ),
    );
    return imgs.map(removeBg);
  }
  const [up, down, left, right] = await Promise.all([
    loadDigDir('up', 24),
    loadDigDir('down', 28),
    loadDigDir('left', 20),
    loadDigDir('right', 16),
  ]);
  return { up, down, left, right };
}

async function loadPickableAssets(): Promise<HTMLCanvasElement[]> {
  const names = ["dig_power_1", "dig_power_2", "dig_power_3", "random_weapon", "medpac"];
  const imgs = await Promise.all(names.map((n) => loadImage(`/art/texture/world/pickable/${n}.png`)));
  return imgs.map((img, i) => names[i] === "random_weapon" ? toCanvas(img) : removeBg(img));
}

export async function loadAssets(): Promise<Assets> {
  const [ground, wall, up, down, left, right, explosion, slime, brown, grenadier, grey] = await Promise.all([
    loadImage('/art/texture/world/ground.png'),
    loadImage('/art/texture/world/wall.png'),
    loadFrames('top',   'mb_mans_top_',  4),
    loadFrames('down',  'mb_mans_down_', 4),
    loadFrames('left',  'mb_mans_l_',    4),
    loadFrames('right', 'mb_mans_r_',    4),
    loadExplosionFrames(),
    loadSlimeAssets(),
    loadBrownAssets(),
    loadGrenadierAssets(),
    loadGreyAssets(),
  ]);
  const [tnt, bigcross, smallcross, grenadeImg, smallbomb, bigbomb, landmineImg, flamebomb, sdImg, bdImg, u1Img, u2Img, p1Img, p2Img, n1Img, n2Img, n3Img, jbImg, lavaImg, teleportImg, barrelImg, diggerImg, boulderImg, door, swOffImg, swOnImg, treasure, pickable, terrainTiles, dig] = await Promise.all([
    loadTntAssets(explosion),
    loadBigCrossAssets(explosion),
    loadSmallCrossAssets(explosion),
    loadImage('/art/texture/weapons/grenade/grenade.png'),
    loadSmallBombAssets(explosion),
    loadBigBombAssets(explosion),
    loadImage('/art/texture/weapons/landmine/landmine.png'),
    loadFlameBombAssets(explosion),
    loadImage('/art/texture/weapons/small_detonate_blue/small_detonate_1.png'),
    loadImage('/art/texture/weapons/big_detonate_blue/big_detonate_1.png'),
    loadImage('/art/texture/weapons/urethane/urethane_1.png'),
    loadImage('/art/texture/weapons/urethane/urethane_2.png'),
    loadImage('/art/texture/weapons/plastic/plastic_1.png'),
    loadImage('/art/texture/weapons/plastic/plastic_2.png'),
    loadImage('/art/texture/weapons/nuclear_bomb/nuclear_bomb_1.png'),
    loadImage('/art/texture/weapons/nuclear_bomb/nuclear_bomb_2.png'),
    loadImage('/art/texture/weapons/nuclear_bomb/nuclear_bomb_3.png'),
    loadImage('/art/texture/weapons/jumping_bomb/jumping_bomb_1.png'),
    loadImage('/art/texture/weapons/lava/lava_1.png'),
    loadImage('/art/texture/weapons/teleport/teleport_1.png'),
    loadImage('/art/texture/weapons/barrel/barrel_1.png'),
    loadImage('/art/texture/weapons/digger_bomb/digger_bomb_1.png'),
    loadImage('/art/texture/world/boulder.png'),
    loadImage('/art/texture/world/door.png'),
    loadImage('/art/texture/world/switch_off.png'),
    loadImage('/art/texture/world/switch_on.png'),
    loadTreasureAssets(),
    loadPickableAssets(),
    loadTerrainTileAssets(),
    loadDigAnimation(),
  ]);
  const grenade       = removeBg(grenadeImg);
  const landmine      = removeBg(landmineImg);
  const smalldetonate = { placed: removeBg(sdImg), explosion };
  const bigdetonate   = { placed: removeBg(bdImg), explosion };
  const urethane      = { placed: removeBg(u1Img), burning: removeBg(u2Img) };
  const plastic       = { placed: removeBg(p1Img), armed: toCanvas(p2Img), explosion };
  const nuclear       = { fuse: [n1Img, n2Img, n3Img].map(removeBg), explosion };
  const jumpingbomb   = removeBg(jbImg);
  const lava          = removeBg(lavaImg);
  const teleport      = removeBg(teleportImg);
  const barrel        = removeBg(barrelImg);
  const diggerbomb    = removeBg(diggerImg);
  const boulder       = removeBg(boulderImg);
  const doorswitch    = { off: toCanvas(swOffImg), on: toCanvas(swOnImg) };
  return { ground, wall, walk: { up, down, left, right }, tnt, bigcross, smallcross, grenade, smallbomb, bigbomb, landmine, flamebomb, smalldetonate, bigdetonate, urethane, plastic, nuclear, jumpingbomb, lava, teleport, barrel, diggerbomb, boulder, slime, brown, grenadier, grey, door, doorswitch, treasure, pickable, terrainTiles, dig };
}
