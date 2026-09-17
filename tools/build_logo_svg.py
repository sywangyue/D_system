#!/usr/bin/env python3
"""生成 MWLAB 万象 的 logo SVG 资产（public/brand/logo/*.svg）。

为什么要有这个脚本，而不是手写 SVG：
  「MWLAB」的字形与「万象」两个字**都是字体轮廓烘出来的**，不引用任何 webfont ——
  这样 SVG 在 PPT / 邮件签名 / 印刷 / <img> 里都能原样渲染，不赌对方能不能加载字体。
  脚本让每个坐标都能追溯到 public/fonts/ 下的源文件，而不是一张没人说得清来历的图。

依赖：pip install fonttools brotli
用法：python3 tools/build_logo_svg.py

坐标口径（1 个 SVG 单位 = 标准态 1px，即 1:1 出图）：
  板高 33 = 上下内距 6.5 ×2 + 拉丁字号 20
  拉丁基线 23.5 = 内距 6.5 + 行盒内基线偏移 17
  中文基线 24   = (33-17)/2 + 行盒内基线偏移 16
  字形 x 位置取自浏览器实测（Geist 600 开了 kerning，
  纯按 advance 累加会宽出 1.6px，所以位置是量的、不是算的）
"""

from pathlib import Path
import re
import json

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
FONT_SANS = ROOT / "public/fonts/geist-latin.woff2"
FONT_CN = ROOT / "public/fonts/noto-serif-sc-logo.woff2"
OUT = ROOT / "public/brand/logo"

# ── 品牌色（出处：docs/DESIGN.md P0-4 / whenjin 的 --color-rule）──
BRAND = "#FE5C00"
BRAND_FG = "#FFFFFF"
INK_DARK = "#08090A"    # 反白单色版里的字
CN_DARK = "#F7F8F8"     # 暗场里的中文
CN_LIGHT = "#111111"    # 浅底里的中文
ERRATA = "#E2E2E0"

# 「象」的墨迹右沿（em）。只用于算 viewBox 宽度，避免按 advance 收口留出空边。
XIANG_INK_RIGHT_EM = 972 / 1000

# ── 标准态几何 ──────────────────────────────────────────────
LATIN_SIZE = 20
CN_SIZE = 17
PAD_X, PAD_Y = 9.0, 6.5
GAP = 12.0
DIV_W, DIV_H = 1.0, 15.0
WEIGHT = 600
CN_TRACKING_EM = 0.06    # 与 whenjin --letter-spacing-cn 同值

# 浏览器实测的逐字 x（Geist 600 / 20px / letter-spacing -0.02em，含 kerning）
LATIN_X = {"M": 0.0, "W": 17.156, "L": 36.281, "A": 47.203, "B": 60.516}
LATIN_ADV_TOTAL = 74.032
LATIN_BASELINE_IN_BOX = 17.0   # (20 - (ascent 20 + descent 6)) / 2 + 20
CN_BASELINE_IN_BOX = 16.0      # (17 - (ascent 20 + descent 5)) / 2 + 20

PLATE_W = PAD_X * 2 + LATIN_ADV_TOTAL
PLATE_H = PAD_Y * 2 + LATIN_SIZE
LATIN_BASELINE = PAD_Y + LATIN_BASELINE_IN_BOX
CN_BOX_TOP = (PLATE_H - CN_SIZE) / 2
CN_BASELINE = CN_BOX_TOP + CN_BASELINE_IN_BOX
# 板 │ 空 12 │ 竖线 1 │ 空 12 │ 中文 —— 竖线两侧各有 12 的间距，漏一个就少 12px
DIV_X = PLATE_W + GAP
CN_X = DIV_X + DIV_W + GAP

# ── 非资产尺寸的两档，只在规范文档里报数。两档都是纯缩放，比例是乘出来的不是配的。
# latin_w 是 15px 下 MWLAB 的实测字标宽（字距 -0.02em = -0.3px）。
DENSE = {"latin": 15, "latin_w": 55.52, "cn": 13, "pad_x": 6, "pad_y": 4, "gap": 9}
# 展示态 = 密集态 ×4（登录页左栏）。六个数全部 ×4，改一个就得改全部。
DISPLAY = {k: v * 4 for k, v in DENSE.items()}


def tier_metrics(m: dict) -> dict:
    """一档尺寸的板宽高与整幅墨迹宽。"""
    plate_w = m["pad_x"] * 2 + m["latin_w"]
    return {
        "plate": f"{r1(plate_w)}x{r1(m['pad_y'] * 2 + m['latin'])}",
        "total_w": r1(plate_w + m["gap"] * 2 + DIV_W
                      + m["cn"] * (1 + CN_TRACKING_EM)
                      + m["cn"] * XIANG_INK_RIGHT_EM),
    }


def r1(v: float) -> float:
    """坐标保留 1 位小数。排版误差远小于 0.05px，肉眼与打印都不可见。"""
    return round(v, 1)


def round_path(d: str) -> str:
    """字形路径的坐标取整 —— 源坐标是 1/1000 em，取整误差 0.0085px。"""
    return re.sub(r"-?\d+\.?\d*", lambda m: str(int(round(float(m.group())))), d)


def glyph_paths(font_path: Path, chars: str, weight: int | None):
    f = TTFont(font_path)
    if weight is not None and "fvar" in f:
        instantiateVariableFont(f, {"wght": weight}, inplace=True)
    upem = f["head"].unitsPerEm
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    out = {}
    for ch in chars:
        pen = SVGPathPen(gs)
        gs[cmap[ord(ch)]].draw(pen)
        bp = BoundsPen(gs)
        gs[cmap[ord(ch)]].draw(bp)
        # 墨迹左右沿（em 为单位）—— viewBox 要贴着墨迹收口。
        # 不能按 advance 算：中文字两侧自带边距，会把版面撑出空白。
        ink = (bp.bounds[0] / upem, bp.bounds[2] / upem) if bp.bounds else (0.0, 0.0)
        out[ch] = {"d": round_path(pen.getCommands()), "ink": ink}
    return upem, out


def path_el(ch: str, d: str, x: float, baseline: float, size: float, upem: int, fill: str) -> str:
    s = size / upem
    return (f'  <path transform="translate({r1(x)},{r1(baseline)}) scale({s:.6f},{-s:.6f})" '
            f'fill="{fill}" d="{d}"/><!-- {ch} -->')


def lockup(theme: str) -> str:
    """theme: dark | light | mono-dark | mono-light"""
    if theme == "dark":
        plate, latin, cn, div = BRAND, BRAND_FG, CN_DARK, ("#FFFFFF", 0.18)
        plate_el = f'  <rect width="{r1(PLATE_W)}" height="{r1(PLATE_H)}" fill="{plate}"/>'
    elif theme == "light":
        plate, latin, cn, div = BRAND, BRAND_FG, CN_LIGHT, (ERRATA, 1.0)
        plate_el = f'  <rect width="{r1(PLATE_W)}" height="{r1(PLATE_H)}" fill="{plate}"/>'
    elif theme == "mono-dark":
        plate, latin, cn, div = BRAND_FG, INK_DARK, CN_DARK, ("#FFFFFF", 0.18)
        plate_el = f'  <rect width="{r1(PLATE_W)}" height="{r1(PLATE_H)}" fill="{plate}"/>'
    elif theme == "mono-light":
        latin, cn, div = CN_LIGHT, CN_LIGHT, (CN_LIGHT, 1.0)
        # 空心板：描边居中对齐，内缩半个描边宽，外沿仍落在 0 / PLATE_W
        sw = 1.5
        plate_el = (f'  <rect x="{sw / 2}" y="{sw / 2}" width="{r1(PLATE_W - sw)}" '
                    f'height="{r1(PLATE_H - sw)}" fill="none" stroke="{CN_LIGHT}" '
                    f'stroke-width="{sw}"/>')
    else:
        raise ValueError(theme)

    sans_upem, sans = glyph_paths(FONT_SANS, "MWLAB", WEIGHT)
    cn_upem, cn_glyphs = glyph_paths(FONT_CN, "万象", None)

    # 整幅宽度 = 「象」的墨迹右沿。左沿就是板的左沿（x=0），两侧不留空。
    total_w = CN_X + CN_SIZE * (1 + CN_TRACKING_EM) + CN_SIZE * cn_glyphs["象"]["ink"][1]

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {r1(total_w)} {r1(PLATE_H)}" '
        f'width="{r1(total_w)}" height="{r1(PLATE_H)}" role="img" '
        f'aria-label="MWLAB 万象">',
        '  <title>MWLAB 万象</title>',
        f'  <!-- 板：{theme} · 品牌橙 {BRAND} -->',
        plate_el,
    ]
    for ch, x in LATIN_X.items():
        lines.append(path_el(ch, sans[ch]["d"], PAD_X + x, LATIN_BASELINE, LATIN_SIZE, sans_upem, latin))
    lines.append(f'  <rect x="{r1(DIV_X)}" y="{r1((PLATE_H - DIV_H) / 2)}" '
                 f'width="{r1(DIV_W)}" height="{r1(DIV_H)}" fill="{div[0]}" '
                 f'fill-opacity="{div[1]}"/><!-- 发丝竖线 -->')
    lines.append(path_el("万", cn_glyphs["万"]["d"], CN_X, CN_BASELINE, CN_SIZE, cn_upem, cn))
    lines.append(path_el("象", cn_glyphs["象"]["d"], CN_X + CN_SIZE * (1 + CN_TRACKING_EM),
                         CN_BASELINE, CN_SIZE, cn_upem, cn))
    lines.append('</svg>')
    return "\n".join(lines) + "\n"


def icon(theme: str = "brand") -> str:
    """图标态：与问津的 W 共用同一套折线坐标，只做上下翻转（W → M）。"""
    field, glyph = (BRAND, BRAND_FG) if theme == "brand" else (BRAND_FG, INK_DARK)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
        'width="100" height="100" role="img" aria-label="MWLAB">\n'
        '  <title>MWLAB</title>\n'
        f'  <rect width="100" height="100" fill="{field}"/>\n'
        f'  <polyline points="18,74 34,24 50,56 66,24 82,74" fill="none" stroke="{glyph}" '
        'stroke-width="13"/>\n'
        '</svg>\n'
    )


def rasterize(icon_svg: str) -> None:
    """把图标态栅格化成 favicon-192.png 与多尺寸 favicon.ico。

    sips 渲染矢量是准的（实测角落 = #FE5C00、中心白），但它只按 SVG 的
    width/height 出图，所以每个尺寸都要另写一份带该尺寸的属性再转。
    只在 macOS 上跑得通 —— 本项目本来也只在 macOS 节点上作业。
    """
    import subprocess
    import tempfile

    pngs: dict[int, Path] = {}
    with tempfile.TemporaryDirectory() as td:
        for size in (16, 32, 48, 64, 192):
            sized = icon_svg.replace('width="100" height="100"',
                                     f'width="{size}" height="{size}"')
            src = Path(td) / f"icon-{size}.svg"
            dst = Path(td) / f"icon-{size}.png"
            src.write_text(sized, encoding="utf-8")
            subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(dst)],
                           check=True, capture_output=True)
            pngs[size] = dst

        (ROOT / "public/favicon-192.png").write_bytes(pngs[192].read_bytes())
        print(f"{'../public/favicon-192.png':34} {pngs[192].stat().st_size:>7} bytes")

        from PIL import Image
        base = Image.open(pngs[192]).convert("RGBA")
        base.save(ROOT / "public/favicon.ico",
                  sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        print(f"{'../public/favicon.ico':34} {(ROOT / 'public/favicon.ico').stat().st_size:>7} bytes")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "mwlab-lockup-dark.svg": lockup("dark"),
        "mwlab-lockup-light.svg": lockup("light"),
        "mwlab-lockup-mono-dark.svg": lockup("mono-dark"),
        "mwlab-lockup-mono-light.svg": lockup("mono-light"),
        "mwlab-icon.svg": icon("brand"),
        "mwlab-icon-reverse.svg": icon("reverse"),
    }
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print(f"{name:34} {len(content.encode()):>7} bytes")

    # favicon 与图标态同源 —— 不另存一份手写的图形，免得两处各改各的
    (ROOT / "public/favicon.svg").write_text(files["mwlab-icon.svg"], encoding="utf-8")
    print(f"{'../public/favicon.svg':34} {len(files['mwlab-icon.svg'].encode()):>7} bytes")

    rasterize(files["mwlab-icon.svg"])
    print(json.dumps({"plate": f"{r1(PLATE_W)}x{r1(PLATE_H)}",
                      "latin_baseline": LATIN_BASELINE,
                      "cn_baseline": CN_BASELINE,
                      "cn_x": r1(CN_X),
                      "total_w": r1(CN_X + CN_SIZE * (1 + CN_TRACKING_EM)
                                    + CN_SIZE * XIANG_INK_RIGHT_EM),
                      # 规范文档要报这两档的数，顺手算准它
                      "dense": tier_metrics(DENSE),
                      "display": tier_metrics(DISPLAY)},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
