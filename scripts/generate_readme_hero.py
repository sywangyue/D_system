#!/usr/bin/env python3
"""
Generate docs/readme-hero-mds.png — fine-grid pixel lettering “MDS”
(GSD-style: small pixel blocks, dark canvas), MD Orange #fe5c00.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "readme-hero-mds.png"

ORANGE = (254, 92, 0)
BG = (20, 20, 22)  # near-black, common dev / GSD readme heroes

# Physical pixels per logical “pixel” (keep small for GSD-like look)
PIX = 3

# Extra physical padding — wide strip so the header reads on GitHub
PAD_X = 48
PAD_Y = 18

# Gap between letters (logical pixels)
LETTER_GAP = 2

# Each string: one row, '#' = pixel on. Same height per glyph.
_GLYPHS: dict[str, list[str]] = {
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


def rasterize(text: str) -> list[list[bool]]:
    glyphs = [_GLYPHS[ch] for ch in text]
    h = len(glyphs[0])
    if not all(len(g) == h for g in glyphs):
        raise ValueError("glyph heights must match")
    rows: list[list[bool]] = []
    for r in range(h):
        parts: list[list[bool]] = []
        for i, g in enumerate(glyphs):
            parts.append([c == "#" for c in g[r]])
            if i < len(glyphs) - 1:
                parts.append([False] * LETTER_GAP)
        rows.append([cell for part in parts for cell in part])
    return rows


def main() -> None:
    grid = rasterize("MDS")
    gh, gw = len(grid), len(grid[0])

    W = gw * PIX + 2 * PAD_X
    H = gh * PIX + 2 * PAD_Y

    im = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(im)

    for r in range(gh):
        for c in range(gw):
            if not grid[r][c]:
                continue
            x0 = PAD_X + c * PIX
            y0 = PAD_Y + r * PIX
            dr.rectangle([x0, y0, x0 + PIX - 1, y0 + PIX - 1], fill=ORANGE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({W}×{H}), logical {gw}×{gh}, PIX={PIX}")


if __name__ == "__main__":
    main()
