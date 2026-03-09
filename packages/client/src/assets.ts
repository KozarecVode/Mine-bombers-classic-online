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
function removeBg(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;

  // Sample background color from top-left pixel
  const bgR = px[0], bgG = px[1], bgB = px[2];

  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === bgR && px[i + 1] === bgG && px[i + 2] === bgB) {
      px[i + 3] = 0; // fully transparent
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

async function loadTntAssets(): Promise<Assets['tnt']> {
  const [t1, t2, t3, disabled, e1, e2, e3] = await Promise.all([
    loadImage('/art/texture/tnt/weapons/tnt_1.png'),
    loadImage('/art/texture/tnt/weapons/tnt_2.png'),
    loadImage('/art/texture/tnt/weapons/tnt_10.png'),
    loadImage('/art/texture/tnt/weapons/tnt_disabled.png'),
    loadImage('/art/texture/tnt/explosion/explosion_1.png'),
    loadImage('/art/texture/tnt/explosion/explosion_2.png'),
    loadImage('/art/texture/tnt/explosion/explosion_3.png'),
  ]);
  return {
    fuse:      [t1, t2, t3].map(removeBg),
    disabled:  removeBg(disabled),
    explosion: interpolateFrames([e1, e2, e3].map(removeBg), 4),
  };
}

export function loadAssets(): Promise<Assets> {
  return Promise.all([
    loadImage('/art/texture/ground.png'),
    loadImage('/art/texture/wall.png'),
    loadFrames('top',   'mb_mans_top_',  4),
    loadFrames('down',  'mb_mans_down_', 4),
    loadFrames('left',  'mb_mans_l_',    4),
    loadFrames('right', 'mb_mans_r_',    4),
    loadTntAssets(),
  ]).then(([ground, wall, up, down, left, right, tnt]) => ({
    ground, wall,
    walk: { up, down, left, right },
    tnt,
  }));
}
