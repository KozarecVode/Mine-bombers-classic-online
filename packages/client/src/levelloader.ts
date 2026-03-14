import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from "@minebombers/shared";
import { Terrain, TerrainDetailMap, TerrainTileType, TILE_MAX_HP } from "./terrain.js";
import { TreasureType } from "./treasure.js";
import { PickableType } from "./pickable.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LevelEntity {
  col: number;
  row: number;
  kind:
    | "brown"
    | "grenadier"
    | "slime"
    | "grey"
    | "boulder"
    | "landmine"
    | "door"
    | "doorswitch"
    | "lava"
    | "barrel"
    | "teleport"
    | "urethane"
    | "treasure"
    | "pickable";
  subtype?: TreasureType | PickableType;
}

export interface ParsedLevel {
  terrain: Terrain;
  detailMap: TerrainDetailMap;
  entities: LevelEntity[];
  spawnCol: number;
  spawnRow: number;
}

// ── Thumbnail color palette (1 px per tile) ───────────────────────────────────

function byteToColor(b: number): [number, number, number] {
  switch (b) {
    case 0x30:
      return [55, 28, 0]; // ground
    case 0x31:
      return [70, 70, 80]; // wall
    case 0x32:
      return [200, 160, 80]; // sand_1
    case 0x33:
      return [195, 155, 75]; // sand_2
    case 0x34:
      return [190, 150, 70]; // sand_3
    case 0x35:
      return [175, 135, 62]; // sand_rock_1
    case 0x36:
      return [162, 122, 56]; // sand_rock_2
    case 0x37:
      return [115, 92, 72]; // rock_1
    case 0x38:
      return [108, 87, 68]; // rock_2
    case 0x39:
      return [102, 82, 62]; // rock_3
    case 0x41:
      return [96, 76, 56]; // rock_4 ('A')
    case 0x43:
      return [58, 58, 68]; // solid_rock_1 ('C')
    case 0x44:
      return [52, 52, 62]; // solid_rock_2 ('D')
    case 0x45:
      return [48, 48, 60]; // solid_rock_3 ('E')
    case 0x46:
      return [44, 44, 56]; // solid_rock_4 ('F')
    case 0x42:
      return [130, 130, 140]; // boulder ('B')
    case 0x47:
    case 0x48:
    case 0x49:
    case 0x4a:
      return [210, 105, 30]; // brown
    case 0x4b:
    case 0x4c:
    case 0x4d:
    case 0x4e:
      return [200, 60, 60]; // grenadier
    case 0x4f:
    case 0x50:
    case 0x51:
    case 0x52:
      return [50, 200, 50]; // slime
    case 0x53:
    case 0x54:
    case 0x55:
    case 0x56:
      return [140, 140, 210]; // grey
    case 0x65:
      return [220, 220, 30]; // landmine ('e')
    case 0x6c:
      return [180, 120, 60]; // door ('l')
    case 0x6d:
      return [220, 60, 60]; // medikit ('m')
    case 0x6f:
      return [50, 200, 50]; // lava ('o')
    case 0x70:
      return [90, 72, 55]; // rock_destroyed_1 ('p')
    case 0x71:
      return [82, 65, 50]; // rock_destroyed_2 ('q')
    case 0x73:
      return [0, 180, 255]; // diamond ('s')
    case 0x79:
      return [200, 200, 100]; // random_weapon ('y')
    case 0x8f:
    case 0x90:
    case 0x91:
      return [112, 113, 102]; // dig power
    case 0x92:
    case 0x93:
    case 0x94:
    case 0x95:
    case 0x96:
    case 0x97:
    case 0x98:
    case 0x99:
    case 0x9a:
      return [255, 215, 0]; // treasure
    case 0x9b:
      return [220, 195, 50]; // urethane
    case 0x9c:
      return [80, 80, 255]; // teleport
    case 0xa4:
      return [150, 110, 60]; // barrel (¤)
    case 0xac:
      return [132, 62, 30]; // brick_1 (¬)
    case 0xad:
      return [122, 56, 28]; // brick_2
    case 0xae:
      return [112, 50, 24]; // brick_3 (®)
    case 0xb4:
      return [160, 160, 50]; // switch (´)
    default:
      return [20, 20, 30]; // unknown → ground color
  }
}

// ── Thumbnail builder ─────────────────────────────────────────────────────────

/** Build thumbnail from a ParsedLevel (for random map previews). */
export function buildThumbnailFromParsed(parsed: ParsedLevel): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);

  const typeToColor: Record<string, [number, number, number]> = {
    ground:           [55,  28,   0],
    border:           [70,  70,  80],
    sand_1:           [200, 160, 80],
    sand_2:           [195, 155, 75],
    sand_3:           [190, 150, 70],
    sand_rock_1:      [175, 135, 62],
    sand_rock_2:      [162, 122, 56],
    rock_1:           [115,  92, 72],
    rock_2:           [108,  87, 68],
    rock_3:           [102,  82, 62],
    rock_4:           [ 96,  76, 56],
    solid_rock_1:     [ 58,  58, 68],
    solid_rock_2:     [ 52,  52, 62],
    solid_rock_3:     [ 48,  48, 60],
    solid_rock_4:     [ 44,  44, 56],
    rock_destroyed_1: [ 90,  72, 55],
    rock_destroyed_2: [ 82,  65, 50],
  };

  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (let col = 0; col < MAP_WIDTH; col++) {
      const type = parsed.detailMap[row][col].type;
      const [r, g, b] = typeToColor[type] ?? [55, 28, 0];
      const idx = (row * MAP_WIDTH + col) * 4;
      img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Returns a MAP_WIDTH × MAP_HEIGHT canvas (1 px per tile). Scale up with CSS. */
export function buildThumbnail(data: Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);

  let row = 0,
    col = 0;
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === 0x0d) continue;
    if (b === 0x0a) {
      row++;
      col = 0;
      continue;
    }
    if (row >= MAP_HEIGHT || col >= MAP_WIDTH) {
      col++;
      continue;
    }

    const [r, g, bv] = byteToColor(b);
    const idx = (row * MAP_WIDTH + col) * 4;
    img.data[idx] = r;
    img.data[idx + 1] = g;
    img.data[idx + 2] = bv;
    img.data[idx + 3] = 255;
    col++;
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── Level parser ──────────────────────────────────────────────────────────────

export function parseMneLevel(data: Uint8Array): ParsedLevel {
  // Initialise empty terrain (all ground)
  const terrain: Terrain = [];
  const detailMap: TerrainDetailMap = [];
  for (let r = 0; r < MAP_HEIGHT; r++) {
    terrain[r] = new Array<boolean>(MAP_WIDTH).fill(false);
    detailMap[r] = Array.from({ length: MAP_WIDTH }, () => ({
      type: "ground" as TerrainTileType,
      hp: 0,
    }));
  }

  const entities: LevelEntity[] = [];

  const setTile = (r: number, c: number, type: TerrainTileType, solid: boolean) => {
    terrain[r][c] = solid;
    detailMap[r][c] = { type, hp: TILE_MAX_HP[type] };
  };

  const addEntity = (r: number, c: number, kind: LevelEntity["kind"], subtype?: LevelEntity["subtype"]) => {
    terrain[r][c] = false;
    detailMap[r][c] = { type: "ground", hp: 0 };
    entities.push({ col: c, row: r, kind, subtype });
  };

  let row = 0,
    col = 0;
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === 0x0d) continue;
    if (b === 0x0a) {
      row++;
      col = 0;
      continue;
    }
    if (row >= MAP_HEIGHT || col >= MAP_WIDTH) {
      col++;
      continue;
    }

    switch (b) {
      // ── Terrain tiles ──────────────────────────────────────────────────────
      case 0x30:
        setTile(row, col, "ground", false);
        break; // '0'
      case 0x31:
        setTile(row, col, "border", true);
        break; // '1' wall
      case 0x32:
        setTile(row, col, "sand_1", true);
        break; // '2'
      case 0x33:
        setTile(row, col, "sand_2", true);
        break; // '3'
      case 0x34:
        setTile(row, col, "sand_3", true);
        break; // '4'
      case 0x35:
        setTile(row, col, "sand_rock_1", true);
        break; // '5'
      case 0x36:
        setTile(row, col, "sand_rock_2", true);
        break; // '6'
      case 0x37:
        setTile(row, col, "rock_1", true);
        break; // '7'
      case 0x38:
        setTile(row, col, "rock_2", true);
        break; // '8'
      case 0x39:
        setTile(row, col, "rock_3", true);
        break; // '9'
      case 0x41:
        setTile(row, col, "rock_4", true);
        break; // 'A'
      case 0x43:
        setTile(row, col, "solid_rock_1", true);
        break; // 'C'
      case 0x44:
        setTile(row, col, "solid_rock_2", true);
        break; // 'D'
      case 0x45:
        setTile(row, col, "solid_rock_3", true);
        break; // 'E'
      case 0x46:
        setTile(row, col, "solid_rock_4", true);
        break; // 'F'
      case 0x70:
        setTile(row, col, "rock_destroyed_1", true);
        break; // 'p'
      case 0x71:
        setTile(row, col, "rock_destroyed_2", true);
        break; // 'q'
      case 0xac:
        setTile(row, col, "brick_1", true);
        break; // '¬'
      case 0xad:
        setTile(row, col, "brick_2", true);
        break;
      case 0xae:
        setTile(row, col, "brick_3", true);
        break; // '®'

      // ── Monster entities ────────────────────────────────────────────────────
      case 0x47:
      case 0x48:
      case 0x49:
      case 0x4a:
        addEntity(row, col, "brown");
        break; // G-J
      case 0x4b:
      case 0x4c:
      case 0x4d:
      case 0x4e:
        addEntity(row, col, "grenadier");
        break; // K-N
      case 0x4f:
      case 0x50:
      case 0x51:
      case 0x52:
        addEntity(row, col, "slime");
        break; // O-R
      case 0x53:
      case 0x54:
      case 0x55:
      case 0x56:
        addEntity(row, col, "grey");
        break; // S-V

      // ── Item / object entities ──────────────────────────────────────────────
      case 0x42:
        addEntity(row, col, "boulder");
        break; // 'B'
      case 0x65:
        addEntity(row, col, "landmine");
        break; // 'e'
      case 0x6c:
        addEntity(row, col, "door");
        break; // 'l'
      case 0x6d:
        addEntity(row, col, "pickable", "medpac");
        break; // 'm'
      case 0x6f:
        addEntity(row, col, "lava");
        break; // 'o'
      case 0x73:
        addEntity(row, col, "treasure", "diamond");
        break; // 's'
      case 0x79:
        addEntity(row, col, "pickable", "random_weapon");
        break; // 'y'
      case 0x8f:
        addEntity(row, col, "pickable", "dig_power_1");
        break;
      case 0x90:
        addEntity(row, col, "pickable", "dig_power_2");
        break;
      case 0x91:
        addEntity(row, col, "pickable", "dig_power_3");
        break;
      case 0x92:
        addEntity(row, col, "treasure", "shield");
        break;
      case 0x93:
        addEntity(row, col, "treasure", "egg");
        break;
      case 0x94:
        addEntity(row, col, "treasure", "mushroom");
        break;
      case 0x95:
        addEntity(row, col, "treasure", "bracelet");
        break;
      case 0x96:
        addEntity(row, col, "treasure", "bar");
        break;
      case 0x97:
        addEntity(row, col, "treasure", "cross");
        break;
      case 0x98:
        addEntity(row, col, "treasure", "scepter");
        break;
      case 0x99:
        addEntity(row, col, "treasure", "ring");
        break;
      case 0x9a:
        addEntity(row, col, "treasure", "crown");
        break;
      case 0x9b:
        addEntity(row, col, "urethane");
        break;
      case 0x9c:
        addEntity(row, col, "teleport");
        break;
      case 0xa4:
        addEntity(row, col, "barrel");
        break; // '¤'
      case 0xb4:
        addEntity(row, col, "doorswitch");
        break; // '´'

      default:
        setTile(row, col, "ground", false); // unknown → ground
    }

    col++;
  }

  // Find spawn point: first passable tile scanning from (1,1) inward
  let spawnCol = 1,
    spawnRow = 1;
  outer: for (let r = 1; r < MAP_HEIGHT - 1; r++) {
    for (let c = 1; c < MAP_WIDTH - 1; c++) {
      if (!terrain[r][c]) {
        spawnCol = c;
        spawnRow = r;
        break outer;
      }
    }
  }

  return { terrain, detailMap, entities, spawnCol, spawnRow };
}

// ── Random level generator ────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function randomOffset(val: number, max: number): number {
  return Math.max(1, Math.min(max - 2, val + Math.floor(Math.random() * 3) - 1));
}

function generateStoneChunk(
  setRock: (r: number, c: number) => void,
): void {
  let col = randInt(1, MAP_WIDTH - 1);
  let row = randInt(1, MAP_HEIGHT - 1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const t = randInt(0, 10);
    if (t === 0) {
      setRock(row, col);
    } else if (t === 1) {
      setRock(row, col); setRock(row + 1, col);
    } else if (t === 2) {
      setRock(row, col); setRock(row - 1, col);
    } else if (t === 3) {
      setRock(row, col); setRock(row, col + 1);
    } else if (t === 4) {
      setRock(row, col); setRock(row - 1, col); setRock(row + 1, col);
    } else if (t === 5) {
      setRock(row, col); setRock(row - 1, col); setRock(row + 1, col); setRock(row, col - 1);
    } else if (t === 6 || t === 7) {
      setRock(row, col); setRock(row - 1, col); setRock(row + 1, col);
      setRock(row, col - 1); setRock(row, col + 1);
    } else if (t === 8) {
      setRock(row - 1, col); setRock(row + 1, col); setRock(row, col - 1);
      setRock(row - 1, col - 1); setRock(row + 1, col + 1);
      setRock(row + 1, col - 1); setRock(row - 1, col + 1);
    } else {
      setRock(row, col); setRock(row - 1, col); setRock(row + 1, col);
      setRock(row, col - 1); setRock(row, col + 1);
      setRock(row - 1, col - 1); setRock(row + 1, col + 1);
      setRock(row + 1, col - 1); setRock(row - 1, col + 1);
    }
    if (Math.random() * 100 > 93 + Math.random() * 10) break;
    row = randomOffset(row, MAP_HEIGHT);
    col = randomOffset(col, MAP_WIDTH);
  }
}

export function generateRandomLevel(): ParsedLevel {
  const terrain: Terrain = [];
  const detailMap: TerrainDetailMap = [];
  for (let r = 0; r < MAP_HEIGHT; r++) {
    terrain[r] = new Array<boolean>(MAP_WIDTH).fill(false);
    detailMap[r] = Array.from({ length: MAP_WIDTH }, () => ({
      type: "ground" as TerrainTileType,
      hp: 0,
    }));
  }

  const entities: LevelEntity[] = [];

  // Bounds-checked tile setter (never touches border row/col)
  const setTile = (r: number, c: number, type: TerrainTileType, solid: boolean) => {
    if (r < 1 || r >= MAP_HEIGHT - 1 || c < 1 || c >= MAP_WIDTH - 1) return;
    terrain[r][c] = solid;
    detailMap[r][c] = { type, hp: TILE_MAX_HP[type] };
  };

  // generate_random_stone: 29–39 stone chunks (mark terrain=true only, no tile type yet)
  const numChunks = randInt(29, 40);
  const markStone = (r: number, c: number) => {
    if (r < 1 || r >= MAP_HEIGHT - 1 || c < 1 || c >= MAP_WIDTH - 1) return;
    terrain[r][c] = true;
  };
  for (let i = 0; i < numChunks; i++) {
    generateStoneChunk(markStone);
  }

  // finalize_map — grid-based state: 0=passage 1=stone 2=corner-TL 3=corner-TR 4=corner-BR 5=corner-BL
  const PASS=0, STONE=1, CTL=2, CTR=3, CBR=4, CBL=5;
  const grid: number[][] = Array.from({ length: MAP_HEIGHT }, (_, r) =>
    Array.from({ length: MAP_WIDTH }, (_, c) => terrain[r][c] ? STONE : PASS)
  );
  const get  = (r: number, c: number) => r>=0&&r<MAP_HEIGHT&&c>=0&&c<MAP_WIDTH ? grid[r][c] : STONE;
  const isPass = (r: number, c: number) => get(r,c) === PASS;
  const isS1   = (r: number, c: number) => get(r,c) === STONE;
  const isSL   = (r: number, c: number) => get(r,c) >= STONE;

  // Step 1: lonely stones → boulders
  for (let r = 1; r < MAP_HEIGHT - 1; r++)
    for (let c = 1; c < MAP_WIDTH - 1; c++)
      if (isS1(r,c) && isPass(r,c+1) && isPass(r,c-1) && isPass(r-1,c) && isPass(r+1,c)) {
        grid[r][c] = PASS;
        entities.push({ col: c, row: r, kind: "boulder" });
      }

  // Step 2: passage tiles at stone corners → corner tiles
  for (let r = 1; r < MAP_HEIGHT - 1; r++)
    for (let c = 1; c < MAP_WIDTH - 1; c++) {
      if (!isPass(r,c)) continue;
      if      (isS1(r,c+1)&&isS1(r+1,c)&&isPass(r,c-1)&&isPass(r-1,c)) grid[r][c] = CTL;
      else if (isS1(r,c+1)&&isPass(r+1,c)&&isPass(r,c-1)&&isS1(r-1,c)) grid[r][c] = CBL;
      else if (isPass(r,c+1)&&isS1(r+1,c)&&isS1(r,c-1)&&isPass(r-1,c)) grid[r][c] = CTR;
      else if (isPass(r,c+1)&&isPass(r+1,c)&&isS1(r,c-1)&&isS1(r-1,c)) grid[r][c] = CBR;
    }

  // Step 3: stone tiles at corners → corner tiles (isStoneLike for neighbours)
  for (let r = 1; r < MAP_HEIGHT - 1; r++)
    for (let c = 1; c < MAP_WIDTH - 1; c++) {
      if (!isS1(r,c)) continue;
      if      (isSL(r,c+1)&&isSL(r+1,c)&&isPass(r,c-1)&&isPass(r-1,c)) grid[r][c] = CTL;
      else if (isSL(r,c+1)&&isPass(r+1,c)&&isPass(r,c-1)&&isSL(r-1,c)) grid[r][c] = CBL;
      else if (isPass(r,c+1)&&isSL(r+1,c)&&isSL(r,c-1)&&isPass(r-1,c)) grid[r][c] = CTR;
      else if (isPass(r,c+1)&&isPass(r+1,c)&&isSL(r,c-1)&&isSL(r-1,c)) grid[r][c] = CBR;
    }

  // Step 4: stone→solid_rock_1/2/3/4 | corner→rock_1/2/3/4 | passage→sand_1/2/3
  const sandTypes:      TerrainTileType[] = ["sand_1","sand_2","sand_3"];
  const solidRockTypes: TerrainTileType[] = ["solid_rock_1","solid_rock_2","solid_rock_3","solid_rock_4"];
  const cornerTiles:    TerrainTileType[] = ["rock_1","rock_2","rock_3","rock_4"];
  for (let r = 1; r < MAP_HEIGHT - 1; r++)
    for (let c = 1; c < MAP_WIDTH - 1; c++) {
      const g = grid[r][c];
      if      (g === STONE) setTile(r, c, solidRockTypes[randInt(0, solidRockTypes.length)], true);
      else if (g === PASS)  setTile(r, c, sandTypes[randInt(0, sandTypes.length)], true);
      else                  setTile(r, c, cornerTiles[g - CTL], true);
    }

  // Step 5: 300 random sand tiles → gravel (sand_rock_1/2)
  const gravelTypes: TerrainTileType[] = ["sand_rock_1","sand_rock_2"];
  for (let i = 0; i < 300; i++) {
    const r = randInt(1, MAP_HEIGHT - 1), c = randInt(1, MAP_WIDTH - 1);
    const t = detailMap[r][c].type;
    if (t === "sand_1" || t === "sand_2" || t === "sand_3")
      setTile(r, c, gravelTypes[randInt(0, gravelTypes.length)], true);
  }

  // generate_treasures: matching Rust RANDOM_TREASURES list and weights
  // Items: dig_power_1/2/3 (pickables), then gold treasures, then diamond
  type PickableSubtype = "dig_power_1" | "dig_power_2" | "dig_power_3" | "random_weapon" | "medpac";
  type RandItem = { kind: "treasure"; subtype: TreasureType } | { kind: "pickable"; subtype: PickableSubtype };
  const randItems: RandItem[] = [
    { kind: "pickable",  subtype: "dig_power_1" },  // SmallPickaxe  weight 18
    { kind: "pickable",  subtype: "dig_power_2" },  // LargePickaxe  weight 12
    { kind: "pickable",  subtype: "dig_power_3" },  // Drill         weight  8
    { kind: "treasure",  subtype: "shield"      },  // GoldShield    weight 200
    { kind: "treasure",  subtype: "egg"         },  // GoldEgg       weight 200
    { kind: "treasure",  subtype: "ring"        },  // GoldPileCoins weight 200
    { kind: "treasure",  subtype: "bracelet"    },  // GoldBracelet  weight 200
    { kind: "treasure",  subtype: "bar"         },  // GoldBar       weight 200
    { kind: "treasure",  subtype: "cross"       },  // GoldCross     weight 180
    { kind: "treasure",  subtype: "scepter"     },  // GoldScepter   weight 160
    { kind: "treasure",  subtype: "crown"       },  // GoldRubin     weight 140
    { kind: "treasure",  subtype: "crown"       },  // GoldCrown     weight  80
    { kind: "treasure",  subtype: "diamond"     },  // Diamond       weight   3
  ];
  const randItemWeights = [18, 12, 8, 200, 200, 200, 200, 200, 180, 160, 140, 80, 3];
  let treasuresInStone = 0;
  for (let i = 0; i < 30; i++) {
    const item = weightedPick(randItems, randItemWeights);
    if (treasuresInStone <= 20) {
      const stoneTiles: [number, number][] = [];
      for (let r = 1; r < MAP_HEIGHT - 1; r++)
        for (let c = 1; c < MAP_WIDTH - 1; c++)
          if (terrain[r][c]) stoneTiles.push([r, c]);
      if (stoneTiles.length > 0) {
        const [r, c] = stoneTiles[randInt(0, stoneTiles.length)];
        terrain[r][c] = false;
        detailMap[r][c] = { type: "ground", hp: 0 };
        entities.push({ col: c, row: r, ...item });
        treasuresInStone++;
      }
    } else {
      entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), ...item });
    }
  }

  // generate_random_items
  while (Math.random() * 100 > 70)
    entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), kind: "boulder" });

  while (Math.random() * 100 > 70)
    entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), kind: "pickable", subtype: "random_weapon" });

  while (Math.random() * 100 > 65)
    entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), kind: "pickable", subtype: "medpac" });

  while (Math.random() * 100 > 70) {
    entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), kind: "teleport" });
    entities.push({ col: randInt(1, MAP_WIDTH - 1), row: randInt(1, MAP_HEIGHT - 1), kind: "teleport" });
  }

  // generate_borders: indestructible edges
  for (let r = 0; r < MAP_HEIGHT; r++) {
    terrain[r][0] = true; detailMap[r][0] = { type: "border", hp: Infinity };
    terrain[r][MAP_WIDTH - 1] = true; detailMap[r][MAP_WIDTH - 1] = { type: "border", hp: Infinity };
  }
  for (let c = 0; c < MAP_WIDTH; c++) {
    terrain[0][c] = true; detailMap[0][c] = { type: "border", hp: Infinity };
    terrain[MAP_HEIGHT - 1][c] = true; detailMap[MAP_HEIGHT - 1][c] = { type: "border", hp: Infinity };
  }

  // generate_entrances: top-left only (1 player), arm length random 4–9
  const clearTile = (r: number, c: number) => {
    terrain[r][c] = false;
    detailMap[r][c] = { type: "ground", hp: 0 };
  };
  for (let c = 1; c <= randInt(4, 10); c++) clearTile(1, c);
  for (let r = 1; r <= randInt(4, 10); r++) clearTile(r, 1);

  return { terrain, detailMap, entities, spawnCol: 1, spawnRow: 1 };
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Level names (all .MNE files in /levels/) ──────────────────────────────────

export const LEVEL_NAMES = [
  "ANZULABY",
  "BATTLE",
  "BESTIARY",
  "BIOFARM",
  "BOULDER",
  "CARAMBA",
  "CASTLE",
  "CIRCLE",
  "CRUMBLE",
  "DENT",
  "EGYPTI",
  "EXPLO",
  "FAUST",
  "FLIPPI",
  "GRAMBBI",
  "GURAMI",
  "GURAMI2",
  "HITLER",
  "HUBLE",
  "HURRY",
  "INSIDE",
  "JAIL",
  "JAKAUS",
  "KOMPLEX",
  "LABY",
  "LABYRINT",
  "LARGE",
  "MEDIEVAL",
  "MONIMUT",
  "OLDMINE",
  "OLDTIME",
  "PALACE",
  "PUSH",
  "QUARTER",
  "ROCKS",
  "ROOMS",
  "RUSPE",
  "RUUBENS",
  "SHATTER",
  "SKI",
  "SOLUKKO",
  "SPYKO",
  "TEENS",
  "TELEROOM",
  "TIILII",
  "TOTHECEN",
] as const;

export type LevelName = (typeof LEVEL_NAMES)[number];
