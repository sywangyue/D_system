import Link from "next/link"
import ProductShot from "./ProductShot"
import { fill, fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"
import type { Coverage } from "@/lib/queries/landing"

/**
 * 首屏（V2-18 改版）。
 *
 * 从左对齐改为居中，参照 Linear：顶光渐变背景 → 悬浮的真实看板 → 大范围低透明度投影。
 * 三层都走令牌（--gradient-hero / --shadow-hero），组件里不写色值。
 *
 * 截图底边**故意裁掉一截**并向下渐隐到画布色，暗示「下面还有内容」——
 * 这是 Linear 首屏的关键手法，不要把它当成没对齐的 bug 修掉。
 *
 * 数字仍然全部走 fmtNum + 字典插值，页面里没有任何写死的计数。
 */
export default function LandingHero({
  locale, t, coverage, enterHref,
}: {
  locale: Locale
  t: Dict
  coverage: Coverage
  enterHref: string
}) {
  const l = t.landing.hero
  // 中英配对字号：拉丁 72 / 中文 68
  const h1 = locale === "zh" ? "text-[32px] md:text-[68px]" : "text-[34px] md:text-[72px]"

  return (
    <section
      className="relative flex flex-col items-center overflow-hidden px-4 pt-24 text-center md:px-6 md:pt-[144px]"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* 资质条 —— 说明这是谁的系统，不是口号 */}
      <span
        className="mb-7 inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[12px] text-fg-muted"
        style={{
          background: "color-mix(in srgb, var(--color-canvas) 80%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-fg-subtle" />
        {l.badge}
      </span>

      <h1 className={`${h1} max-w-[900px] font-medium leading-[1.15] text-fg-muted`}>
        {l.headlineLead}
        <br />
        <span className="text-fg">{l.headlineFocus}</span>
      </h1>

      <p className="mt-5 max-w-[740px] text-[15px] leading-relaxed text-fg-muted md:mt-6 md:text-[17px]">
        {fill(l.subline, {
          brands: fmtNum(locale, coverage.brands),
          groups: fmtNum(locale, coverage.groups),
          editions: fmtNum(locale, coverage.editions),
        })}
      </p>

      <div className="mt-7 mb-10 flex items-center gap-5 md:mt-9 md:mb-16 md:gap-7">
        <Link
          href={enterHref}
          className="btn inline-flex h-11 items-center rounded-[4px] bg-accent px-7 text-[15px] font-medium text-accent-fg transition-transform hover:-translate-y-px"
        >
          {l.enter}
        </Link>
        <a
          href="#data"
          className="inline-flex items-center gap-1 text-[14px] text-fg-muted transition-all hover:-translate-y-px hover:text-fg"
        >
          {l.viewCoverage}
        </a>
      </div>

      {/* 悬浮看板。外层 1px 渐变描边 + 大投影，内层裁圆角装真实截图 */}
      <div
        className="relative w-full max-w-[1240px] rounded-t-[8px] p-px pb-0"
        style={{
          background: "linear-gradient(180deg, rgb(0 0 0 / 0.12) 0%, rgb(0 0 0 / 0.02) 100%)",
          boxShadow: "var(--shadow-hero)",
        }}
      >
        <div className="relative overflow-hidden rounded-t-[7px] bg-canvas">
          <div style={{ aspectRatio: "16 / 10" }}>
            <ProductShot src="/landing/product.webp" alt={l.shotAlt} note={l.shotPending} />
          </div>
          {/* 底边渐隐 —— 与裁切配合，做出「还有更多」的暗示 */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
            style={{ background: "linear-gradient(to top, var(--color-canvas), transparent)" }}
          />
        </div>
      </div>
    </section>
  )
}
