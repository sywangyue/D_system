/**
 * 品牌锁定 —— MWLAB 万象（2026-09-17 重塑）
 *
 * 与兄弟品牌「问津 Whenjin」共用一条规矩：**色块 + 白色标记**，都在浅场上。
 *   问津：红 #c2261c 方块 + 白色几何 W + 衬线拉丁   （报的气质）
 *   万象：橙 #FE5C00 色板 + 白色 MWLAB + 无衬线拉丁（工具）
 * 中文永远在后，且必须与「问津」同款 —— Noto Serif SC 700 + 0.06em 字距，
 * 这是两个品牌之间唯一的视觉联结，不许换。浅场上中文取墨色 #111111
 * （whenjin --color-text 同值），不用正文的近黑 #171717 —— 字标与正文分开。
 *
 * 三态数值全部引用 globals.css 的 --logo-* 变量，组件里不写字面量。
 * 静态资产 public/brand/logo/*.svg 由 tools/build_logo_svg.py 同源烘出 ——
 * 改了这里的几何，必须重跑那个脚本，否则资产会与实渲染对不上。
 */

import { BRAND_CN } from "@/lib/brand"

type Props = {
  /**
   * 三档尺寸，全部引用 globals.css 的 --logo-* 变量。
   *   standard 拉丁 20 / 板 92×33   文档、PPT、物料
   *   dense    拉丁 15 / 板 67.5×23 应用内窄容器（侧栏表头）
   *   display  拉丁 60 / 板 270×92  = 密集态 ×4，登录页左栏
   */
  size?: "standard" | "dense" | "display"
  /** 英文版摘掉中文：那两个字离不开 CJK 字体，且英文语境里不需要 */
  showCn?: boolean
}

export default function BrandLockup({ size = "dense", showCn = true }: Props) {
  // 变量名只差一个后缀：标准态无后缀，密集态 -dense，展示态 -display
  const s = size === "standard" ? "" : `-${size}`

  return (
    <span
      className="flex items-center shrink-0"
      style={{ gap: `var(--logo-gap${s})` }}
    >
      {/* 色板：拉丁字标入场的地方。板不圆角 —— 与问津的硬方标同一套几何观。 */}
      <span
        className="flex items-center shrink-0 bg-brand"
        style={{ padding: `var(--logo-plate-pad-y${s}) var(--logo-plate-pad-x${s})` }}
      >
        {/* 字重 600 与 -0.02em 字距是设计系统板定的，也是 SVG 资产烘字时的口径，
            所以这里直接写死值，不走 .lat 的默认档位 */}
        <span
          className="text-brand-fg"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: `var(--logo-latin-size${s})`,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          MWLAB
        </span>
      </span>

      {showCn && (
        <>
          <span
            className="shrink-0"
            style={{
              width: 1,
              height: `var(--logo-divider-height${s})`,
              background: "var(--color-logo-rule)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-logo-cn)",
              fontWeight: 700,
              color: "var(--color-brand-ink)",
              fontSize: `var(--logo-cn-size${s})`,
              letterSpacing: "var(--logo-cn-tracking)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {BRAND_CN}
          </span>
        </>
      )}
    </span>
  )
}
