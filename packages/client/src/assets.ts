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
    Array.from({ length: n }, (_, i) => loadImage(`/art/walk/${dir}/${prefix}${i + 1}.png`)),
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

export async function loadAssets(): Promise<Assets> {
  const [ground, wall, up, down, left, right, explosion] = await Promise.all([
    loadImage('/art/texture/world/ground.png'),
    loadImage('/art/texture/world/wall.png'),
    loadFrames('top',   'mb_mans_top_',  4),
    loadFrames('down',  'mb_mans_down_', 4),
    loadFrames('left',  'mb_mans_l_',    4),
    loadFrames('right', 'mb_mans_r_',    4),
    loadExplosionFrames(),
  ]);
  const [tnt, bigcross, smallcross, grenadeImg, smallbomb, bigbomb, landmineImg, flamebomb, sdImg, bdImg, u1Img, u2Img, p1Img, p2Img, n1Img, n2Img, n3Img, jbImg] = await Promise.all([
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
  ]);
  const grenade       = removeBg(grenadeImg);
  const landmine      = removeBg(landmineImg);
  const smalldetonate = { placed: removeBg(sdImg), explosion };
  const bigdetonate   = { placed: removeBg(bdImg), explosion };
  const urethane      = { placed: removeBg(u1Img), burning: removeBg(u2Img) };
  const plastic       = { placed: removeBg(p1Img), armed: toCanvas(p2Img), explosion };
  const nuclear       = { fuse: [n1Img, n2Img, n3Img].map(removeBg), explosion };
  const jumpingbomb   = removeBg(jbImg);
  return { ground, wall, walk: { up, down, left, right }, tnt, bigcross, smallcross, grenade, smallbomb, bigbomb, landmine, flamebomb, smalldetonate, bigdetonate, urethane, plastic, nuclear, jumpingbomb };
}
