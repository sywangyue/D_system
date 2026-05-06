#!/usr/bin/env python3
"""
Generate docs/readme-hero-mds.png — pixel banner aligned with
Messe Düsseldorf Corporate Design Manual (Nov 2024):
- Signet: 8×5 square module grid (primary m shape)
- MD Orange #fe5c00 (Pantone Orange 021 C)
- D / S: same module size and stroke weight (2 modules)
- Subtitle: Inter-style black label (Messe Düsseldorf Shanghai) as raster text
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "readme-hero-mds.png"

ORANGE = (254, 92, 0)
BLACK = (0, 0, 0)
BG = (252, 252, 252)

U = 22  # module edge length in pixels


def draw_cell(im: Image.Image, ox: int, oy: int, c: int, r: int, fill: tuple[int, int, int]) -> None:
    x0, y0 = ox + c * U, oy + r * U
    ImageDraw.Draw(im).rectangle([x0, y0, x0 + U - 1, y0 + U - 1], fill=fill)


def draw_signet(im: Image.Image, ox: int, oy: int) -> None:
    """Manual primary m: top 2 rows full 8 wide; rows 2–4 three legs 2 wide, gap 1."""
    for r in range(5):
        for c in range(8):
            if r < 2:
                draw_cell(im, ox, oy, c, r, ORANGE)
            elif c in (0, 1, 3, 4, 6, 7):
                draw_cell(im, ox, oy, c, r, ORANGE)


def draw_D(im: Image.Image, ox: int, oy: int) -> None:
    """6×5 cells, 2-cell stroke, closed counter."""
    for r in range(5):
        for c in range(6):
            if c <= 1:
                draw_cell(im, ox, oy, c, r, ORANGE)
            elif r <= 1 or r >= 3:
                draw_cell(im, ox, oy, c, r, ORANGE)
            elif c >= 4:
                draw_cell(im, ox, oy, c, r, ORANGE)


def draw_S(im: Image.Image, ox: int, oy: int) -> None:
    """6×5 thick S (manual stroke weight)."""
    for r in range(5):
        for c in range(6):
            if r in (0, 2, 4):
                draw_cell(im, ox, oy, c, r, ORANGE)
            elif r == 1 and c <= 1:
                draw_cell(im, ox, oy, c, r, ORANGE)
            elif r == 3 and c >= 4:
                draw_cell(im, ox, oy, c, r, ORANGE)


def main() -> None:
    gap = 2 * U
    w_signet, h_signet = 8 * U, 5 * U
    w_d, h_d = 6 * U, 5 * U
    w_s, h_s = 6 * U, 5 * U

    content_w = w_signet + gap + w_d + gap + w_s
    pad_x, pad_y = 3 * U, 3 * U
    sub_h = 40
    W = content_w + 2 * pad_x
    H = h_signet + 2 * pad_y + sub_h + 16

    im = Image.new("RGB", (W, H), BG)
    y0 = pad_y
    x0 = pad_x

    draw_signet(im, x0, y0)
    x0 += w_signet + gap
    draw_D(im, x0, y0)
    x0 += w_d + gap
    draw_S(im, x0, y0)

    subtitle = "Messe Düsseldorf Shanghai · MWLAB-2026"
    draw = ImageDraw.Draw(im)
    font = None
    for fn in (
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ):
        p = Path(fn)
        if p.exists():
            try:
                font = ImageFont.truetype(str(p), 22)
                break
            except OSError:
                continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), subtitle, font=font)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    ty = pad_y + h_signet + 12
    draw.text((tx, ty), subtitle, fill=BLACK, font=font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({W}×{H})")


if __name__ == "__main__":
    main()
