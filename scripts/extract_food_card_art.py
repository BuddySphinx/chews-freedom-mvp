"""Split the generated 4×3 food-art sheets into web-ready transparent card art.

The generated sheets are retained under output/imagegen. This script keeps the
crop coordinates and card order explicit, so a revised sheet can be extracted
again without manually pairing any illustration with the wrong food card.
"""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEET_WIDTH = 1536
SHEET_HEIGHT = 1536
CELL_WIDTH = SHEET_WIDTH // 4
CELL_HEIGHT = SHEET_HEIGHT // 3
CELL_INSET = 12
ICON_SIZE = 256
ICON_INSET = 18

SHEETS = [
    (
        ROOT / "tmp/imagegen/alpha/food-card-art-sheet-01-alpha.png",
        [
            "food-01-apple", "food-02-cucumber", "food-03-watermelon", "food-04-banana",
            "food-05-orange", "food-06-broccoli", "food-07-boiled-potato", "food-08-sweetcorn",
            "food-09-green-peas", "food-10-avocado", "food-11-button-mushrooms", "food-12-cooked-white-rice",
        ],
    ),
    (
        ROOT / "tmp/imagegen/alpha/food-card-art-sheet-02-alpha.png",
        [
            "food-13-wholemeal-bread", "food-14-cooked-spaghetti", "food-15-rolled-oats", "food-16-cornflakes",
            "food-17-canned-baked-beans", "food-18-whole-milk", "food-19-cooked-green-beans", "food-20-boiled-egg",
            "food-21-smooth-peanut-butter", "food-22-greek-yogurt", "food-23-hummus", "food-24-cooked-kidney-beans",
        ],
    ),
    (
        ROOT / "tmp/imagegen/alpha/food-card-art-sheet-03-alpha.png",
        [
            "food-25-cheddar-cheese", "food-26-firm-tofu", "food-27-cooked-black-beans", "food-28-canned-tuna-in-water",
            "food-29-cooked-salmon", "food-30-cooked-turkey-breast", "food-31-cooked-lean-beef-mince", "food-32-almonds",
            "food-33-fish-fingers", "food-34-cooked-cod", "food-35-cooked-prawns", "food-36-canned-sardines",
        ],
    ),
    (
        ROOT / "tmp/imagegen/alpha/food-card-art-sheet-04-alpha.png",
        [
            "food-37-cooked-pork-loin", "food-38-cooked-mussels", "food-39-cooked-chicken-breast", "food-40-cooked-haddock",
            "food-41-cooked-trout", "food-42-cooked-lamb-leg", "food-43-cooked-beef-steak", "food-44-corned-beef",
            "food-45-cooked-lentils", "food-46-pork-sausage", "food-47-cooked-mackerel", "food-48-cooked-ham",
        ],
    ),
]


def remove_edge_artifacts(cell: Image.Image) -> Image.Image:
    """Drop a stray neighboring illustration that enters a cell at an edge."""
    alpha = cell.getchannel("A")
    cleaned = alpha.copy()
    source = alpha.load()
    target = cleaned.load()
    width, height = cell.size
    seen: set[tuple[int, int]] = set()
    edge_pixels = [(x, y) for x in range(width) for y in (0, height - 1)]
    edge_pixels += [(x, y) for y in range(1, height - 1) for x in (0, width - 1)]

    for start in edge_pixels:
        if start in seen or source[start[0], start[1]] < 16:
            continue
        queue: deque[tuple[int, int]] = deque([start])
        seen.add(start)
        component: list[tuple[int, int]] = []
        while queue:
            x, y = queue.popleft()
            component.append((x, y))
            for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= next_x < width and 0 <= next_y < height and (next_x, next_y) not in seen and source[next_x, next_y] >= 16:
                    seen.add((next_x, next_y))
                    queue.append((next_x, next_y))
        if len(component) < (width * height * 0.07):
            for x, y in component:
                target[x, y] = 0

    result = cell.copy()
    result.putalpha(cleaned)
    return result


def web_icon(cell: Image.Image) -> Image.Image:
    """Trim the transparent key background, then make a consistent square icon."""
    cell = remove_edge_artifacts(cell)
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("A generated food cell did not contain any visible artwork.")

    left, top, right, bottom = bounds
    pad = max(8, round(max(right - left, bottom - top) * 0.07))
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(cell.width, right + pad)
    bottom = min(cell.height, bottom + pad)
    food = cell.crop((left, top, right, bottom))
    food.thumbnail((ICON_SIZE - (ICON_INSET * 2), ICON_SIZE - (ICON_INSET * 2)), Image.Resampling.LANCZOS)

    icon = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    x = (ICON_SIZE - food.width) // 2
    y = (ICON_SIZE - food.height) // 2
    icon.alpha_composite(food, (x, y))
    return icon


def main() -> None:
    destination = ROOT / "src/assets/food-cards"
    destination.mkdir(parents=True, exist_ok=True)

    exported: list[Path] = []
    for sheet_path, card_ids in SHEETS:
        with Image.open(sheet_path).convert("RGBA") as sheet:
            if sheet.size != (SHEET_WIDTH, SHEET_HEIGHT):
                raise ValueError(f"Expected {SHEET_WIDTH}×{SHEET_HEIGHT}: {sheet_path}")
            for index, card_id in enumerate(card_ids):
                row, column = divmod(index, 4)
                cell = sheet.crop((
                    (column * CELL_WIDTH) + CELL_INSET,
                    (row * CELL_HEIGHT) + CELL_INSET,
                    ((column + 1) * CELL_WIDTH) - CELL_INSET,
                    ((row + 1) * CELL_HEIGHT) - CELL_INSET,
                ))
                output = destination / f"{card_id}.png"
                web_icon(cell).save(output, "PNG", optimize=True)
                exported.append(output)

    print(f"Exported {len(exported)} food-card illustrations to {destination}")


if __name__ == "__main__":
    main()
