export interface Assets {
  ground: HTMLImageElement;
  wall:   HTMLImageElement;
  walk: {
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

export function loadAssets(): Promise<Assets> {
  return Promise.all([
    loadImage('/art/texture/ground.png'),
    loadImage('/art/texture/wall.png'),
    loadFrames('top',   'mb_mans_top_',  4),
    loadFrames('down',  'mb_mans_down_', 4),
    loadFrames('left',  'mb_mans_l_',    4),
    loadFrames('right', 'mb_mans_r_',    4),
  ]).then(([ground, wall, up, down, left, right]) => ({
    ground, wall,
    walk: { up, down, left, right },
  }));
}
