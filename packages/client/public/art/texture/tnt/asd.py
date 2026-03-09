from pathlib import Path
from PIL import Image

INPUT_FILE = "SIKA - Copy.png"
TILE_SIZE = 10  # 10x10 pixels per tile

def split_image_into_tiles(input_file: str, tile_size: int = 10):
    img = Image.open(input_file)
    width, height = img.size

    output_dir = Path("output_tiles")
    output_dir.mkdir(exist_ok=True)

    tile_count = 0
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            # Crop the 10x10 tile
            box = (x, y, min(x + tile_size, width), min(y + tile_size, height))
            tile = img.crop(box)
            out_path = output_dir / f"tile_{y//tile_size}_{x//tile_size}.png"
            tile.save(out_path)
            tile_count += 1

    print(f"Saved {tile_count} tiles to {output_dir.resolve()}")

if __name__ == "__main__":
    split_image_into_tiles(INPUT_FILE, TILE_SIZE)