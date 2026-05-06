#!/usr/bin/env python3
"""
Generate docs/readme-hero-mds.png — fine pixel “MDS” + subtitle “BD Database”.
Transparent background; small pixel cells (GSD-like).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "readme-hero-mds.png"

ORANGE = (254, 92, 0, 255)
TRANSPARENT = (0, 0, 0, 0)

# Main word: physical pixels per logical cell (smaller = finer)
PIX_MAIN = 2

# Subtitle: even smaller cells
PIX_SUB = 1

PAD_X = 40
PAD_Y = 14
GAP_MAIN_SUB = 12  # physical px between MDS row and subtitle
LETTER_GAP_MAIN = 2  # logical px between M, D, S

# ─── Main MDS (7×8 logical grid per letter) ─────────────────────────────
_GLYPHS_MAIN: dict[str, list[str]] = {
    "M": [
        "#.....#",
        "##...##",
        "#.#.#.#",
        "#..#..#",
        "#.....#",
        "#.....#",
        "#.....#",
        "#.....#",
    ],
    "D": [
        "#####..",
        "#....#.",
        "#....#.",
        "#....#.",
        "#....#.",
        "#....#.",
        "#....#.",
        "#####..",
    ],
    "S": [
        ".#####.",
        "#.....#",
        "#......",
        ".####..",
        ".....#.",
        "#....#.",
        "#....#.",
        ".####..",
    ],
}

# ─── Subtitle “BD Database” — compact 5 rows ───────────────────────────
# Each row same length per glyph; '.' = empty, '#' = ink
_GLYPHS_SUB: dict[str, list[str]] = {
    " ": [
        "..",
        "..",
        "..",
        "..",
        "..",
    ],
    "B": [
        "####.",
        "#...#",
        "####.",
        "#...#",
        "####.",
    ],
    "D": [
        "####.",
        "#...#",
        "#...#",
        "#...#",
        "####.",
    ],
    "a": [
        ".###.",
        "#...#",
        "#####",
        "#...#",
        "#...#",
    ],
    "t": [
        ".#...",
        "#####",
        ".#...",
        ".#...",
        ".#...",
    ],
    "b": [
        "#....",
        "####.",
        "#...#",
        "#...#",
        "####.",
    ],
    "s": [
        ".###.",
        "#....",
        ".##..",
        "...#.",
        "###..",
    ],
    "e": [
        ".###.",
        "#...#",
        "#####",
        "#....",
        ".###.",
    ],
}


def rasterize_main(text: str) -> list[list[bool]]:
    glyphs = [_GLYPHS_MAIN[ch] for ch in text]
    h = len(glyphs[0])
    rows: list[list[bool]] = []
    for r in range(h):
        parts: list[list[bool]] = []
        for i, g in enumerate(glyphs):
            parts.append([c == "#" for c in g[r]])
            if i < len(glyphs) - 1:
                parts.append([False] * LETTER_GAP_MAIN)
        rows.append([cell for part in parts for cell in part])
    return rows


def rasterize_sub(text: str) -> list[list[bool]]:
    glyphs = [_GLYPHS_SUB[ch] for ch in text]
    h = len(glyphs[0])
    if not all(len(g) == h for g in glyphs):
        raise ValueError("subtitle glyph height mismatch")
    rows: list[list[bool]] = []
    for r in range(h):
        parts: list[list[bool]] = []
        for i, g in enumerate(glyphs):
            parts.append([c == "#" for c in g[r]])
            if i < len(glyphs) - 1:
                parts.append([False])  # 1 logical px between sub letters
        rows.append([cell for part in parts for cell in part])
    return rows


def draw_grid(
    dr: ImageDraw.ImageDraw,
    grid: list[list[bool]],
    ox: int,
    oy: int,
    pix: int,
    fill: tuple[int, int, int, int],
) -> None:
    gh, gw = len(grid), len(grid[0])
    for r in range(gh):
        for c in range(gw):
            if not grid[r][c]:
                continue
            x0 = ox + c * pix
            y0 = oy + r * pix
            dr.rectangle([x0, y0, x0 + pix - 1, y0 + pix - 1], fill=fill)


def main() -> None:
    main_grid = rasterize_main("MDS")
    sub_grid = rasterize_sub("BD Database")

    gh_m, gw_m = len(main_grid), len(main_grid[0])
    gh_s, gw_s = len(sub_grid), len(sub_grid[0])

    main_w = gw_m * PIX_MAIN
    main_h = gh_m * PIX_MAIN
    sub_w = gw_s * PIX_SUB
    sub_h = gh_s * PIX_SUB

    W = max(main_w, sub_w) + 2 * PAD_X
    H = PAD_Y + main_h + GAP_MAIN_SUB + sub_h + PAD_Y

    im = Image.new("RGBA", (W, H), TRANSPARENT)
    dr = ImageDraw.Draw(im)

    main_x = PAD_X + (W - 2 * PAD_X - main_w) // 2
    main_y = PAD_Y
    draw_grid(dr, main_grid, main_x, main_y, PIX_MAIN, ORANGE)

    sub_x = PAD_X + (W - 2 * PAD_X - sub_w) // 2
    sub_y = PAD_Y + main_h + GAP_MAIN_SUB
    draw_grid(dr, sub_grid, sub_x, sub_y, PIX_SUB, ORANGE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({W}×{H}) RGBA; main PIX={PIX_MAIN}, sub PIX={PIX_SUB}")


if __name__ == "__main__":
    main()
