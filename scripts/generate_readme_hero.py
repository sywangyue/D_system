#!/usr/bin/env python3
"""
Generate docs/readme-hero-mds.png — 80s terminal pixel style.
Custom 5×7 bitmap font, drop shadow, terminal brackets, blinking cursor,
transparent background. GitHub README header (~1200px wide).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "readme-hero-mds.png"

ORANGE = (254, 92, 0, 255)
SHADOW_COLOR = (140, 40, 0, 100)
DIVIDER_COLOR = (254, 92, 0, 180)
CURSOR_COLOR = (254, 92, 0, 200)
TRANSPARENT = (0, 0, 0, 0)

CW = 5   # character width (logical px)
CH = 7   # character height (logical px)
GAP = 1  # gap between characters (logical px)

SHADOW_X = 1  # shadow offset in logical px
SHADOW_Y = 1

# ─── 5×7 bitmap font ───────────────────────────────────────────────────
chars_5x7: dict[str, list[int]] = {
    'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
    'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
    'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
    'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
    'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
    'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
    'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
    'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
    'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
    '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
    '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
    '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
    '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
    '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
    '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
    '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b00100, 0b00100, 0b00100],
    '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
    '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
    '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
    '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
    ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
    ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
}

CURSOR_BM = [0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111]
DIVIDER_BM = [0b01010, 0b10101, 0b01010, 0b10101, 0b01010, 0b10101, 0b01010]


def text_logical_w(text: str) -> int:
    return len(text) * (CW + GAP) - GAP


def render(text: str) -> list[list[bool]]:
    rows: list[list[bool]] = [[] for _ in range(CH)]
    for i, ch in enumerate(text):
        bm = chars_5x7.get(ch.upper(), chars_5x7[' '])
        for row in range(CH):
            bits = bm[row]
            for col in range(CW):
                rows[row].append(bool(bits & (1 << (CW - 1 - col))))
        if i < len(text) - 1:
            for row in range(CH):
                rows[row].extend([False] * GAP)
    return rows


def render_divider(length: int) -> list[list[bool]]:
    rows: list[list[bool]] = [[] for _ in range(CH)]
    for col in range(length):
        for row in range(CH):
            rows[row].append(bool(DIVIDER_BM[row] & (1 << (CW - 1 - (col % CW)))))
    return rows


def render_cursor() -> list[list[bool]]:
    return [[bool(CURSOR_BM[row] & (1 << (CW - 1 - col))) for col in range(CW)] for row in range(CH)]


def stamp(img: Image.Image, grid: list[list[bool]], ox: int, oy: int, scale: int, color: tuple) -> None:
    px = img.load()
    gh, gw = len(grid), len(grid[0])
    for r in range(gh):
        for c in range(gw):
            if not grid[r][c]:
                continue
            x0, y0 = ox + c * scale, oy + r * scale
            for dy in range(scale):
                for dx in range(scale):
                    px[x0 + dx, y0 + dy] = color


def main() -> None:
    TITLE_SCALE = 9
    SUB_SCALE = 6
    TAG_SCALE = 4
    DIV_SCALE = 7

    title_text = "MWLAB-2026"
    sub_text = "BD DATABASE"
    tag_text = "EXHIBITION COMPETITIVE DASHBOARD"

    # Build lines
    title_full = "[[[  " + title_text + "  ]]]"
    cursor_text = " "  # gap before cursor

    title_grid = render(title_full)
    cursor_grid = render_cursor()
    gap_grid = render(cursor_text)  # 1-char gap before cursor
    sub_grid = render(sub_text)
    tag_grid = render(tag_text)

    # Divider — match subtitle width in logical px
    div_len = text_logical_w(sub_text)
    div_grid = render_divider(div_len)

    # Pixel dimensions
    title_px_w = text_logical_w(title_full) * TITLE_SCALE
    gap_px_w = text_logical_w(cursor_text) * TITLE_SCALE
    cursor_px_w = (CW + GAP) * TITLE_SCALE
    title_total_w = title_px_w + gap_px_w + cursor_px_w

    sub_px_w = text_logical_w(sub_text) * SUB_SCALE
    tag_px_w = text_logical_w(tag_text) * TAG_SCALE
    div_px_w = div_len * DIV_SCALE

    content_max_w = max(title_total_w, sub_px_w, tag_px_w, div_px_w)
    pad_x = 6 * TITLE_SCALE
    img_w = content_max_w + 2 * pad_x

    # Vertical
    title_h = CH * TITLE_SCALE
    sub_h = CH * SUB_SCALE
    tag_h = CH * TAG_SCALE
    div_h = CH * DIV_SCALE

    gap_y = 2 * TITLE_SCALE       # between title and subtitle
    div_gap = 2 * TITLE_SCALE     # around divider
    pad_y = 3 * TITLE_SCALE

    img_h = pad_y + title_h + gap_y + sub_h + div_gap + div_h + div_gap + tag_h + pad_y

    img = Image.new("RGBA", (img_w, img_h), TRANSPARENT)
    y = pad_y

    # ── Title row: [[[ MWLAB-2026 ]]] ■ (with drop shadow) ──
    title_x = pad_x + (img_w - 2 * pad_x - title_total_w) // 2

    # Drop shadow
    stamp(img, title_grid,
          title_x + SHADOW_X * TITLE_SCALE,
          y + SHADOW_Y * TITLE_SCALE,
          TITLE_SCALE, SHADOW_COLOR)
    # Main title
    stamp(img, title_grid, title_x, y, TITLE_SCALE, ORANGE)
    # Cursor
    cursor_x = title_x + title_px_w + gap_px_w
    stamp(img, cursor_grid, cursor_x, y, TITLE_SCALE, CURSOR_COLOR)

    y += title_h + gap_y

    # ── Subtitle: BD DATABASE ──
    sub_x = pad_x + (img_w - 2 * pad_x - sub_px_w) // 2
    stamp(img, sub_grid, sub_x, y, SUB_SCALE, ORANGE)
    y += sub_h + div_gap

    # ── Divider ──
    div_x = pad_x + (img_w - 2 * pad_x - div_px_w) // 2
    stamp(img, div_grid, div_x, y, DIV_SCALE, DIVIDER_COLOR)
    y += div_h + div_gap

    # ── Tagline: EXHIBITION COMPETITIVE DASHBOARD ──
    tag_x = pad_x + (img_w - 2 * pad_x - tag_px_w) // 2
    stamp(img, tag_grid, tag_x, y, TAG_SCALE, ORANGE)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({img_w}×{img_h}) RGBA")
    print(f"  Title: {TITLE_SCALE}x scale, {title_px_w}px wide (with shadow + cursor)")
    print(f"  Sub:   {SUB_SCALE}x scale, {sub_px_w}px wide")
    print(f"  Tag:   {TAG_SCALE}x scale, {tag_px_w}px wide")


if __name__ == "__main__":
    main()
