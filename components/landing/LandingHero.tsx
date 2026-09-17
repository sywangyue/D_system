import Link from "next/link"
import ProductShot from "./ProductShot"
import { fill, fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"
import type { Coverage } from "@/lib/queries/landing"

/**
 * §4.2 首屏。左对齐，只有三样东西：标题两行、一行副标题、一个主按钮 + 一个文字链接。
 * 数字全部走 fmtNum + 字典插值，**页面里没有任何写死的计数**（§2）。
 *
 * 标题下方是产品截图：1px 发丝边框、12px 圆角、底边渐隐到页面背景（§4.2）。
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
  // 字号按语种取一节（设计板的中英配对：72/68）
  const h1 = locale === "zh" ? "text-[68px]" : "text-[72px]"

  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 pt-[236px]">
      {/* 236px = 固定导航 56px + 首屏上留白 180px */}
      <h1 className={`${h1} max-w-[900px] font-medium leading-[1.15] text-fg-muted`}>
        {l.headlineLead}
        <br />
        <span className="text-fg">{l.headlineFocus}</span>
      </h1>

      <p className="mt-6 max-w-[860px] text-[17px] text-fg-muted">
        {fill(l.subline, {
          brands: fmtNum(locale, coverage.brands),
          groups: fmtNum(locale, coverage.groups),
          editions: fmtNum(locale, coverage.editions),
        })}
      </p>

      <div className="mt-10 flex items-center gap-7">
        <Link
          href={enterHref}
          className="btn inline-flex h-10 items-center rounded-[4px] bg-accent px-5 text-[14px] font-medium text-accent-fg"
        >
          {l.enter}
        </Link>
        <a href="#data" className="text-[13px] text-fg-muted transition-colors hover:text-fg">
          {l.viewCoverage}
        </a>
      </div>

      {/* 产品截图：/expo 主内容区（清空筛选、日历翻到无事项的月份、裁掉侧栏后截取，不含任何内部数据） */}
      <div
        className="relative mt-20 overflow-hidden rounded-[12px] border border-hairline"
        style={{ aspectRatio: "16 / 10", background: "var(--color-surface)" }}
      >
        <ProductShot src="/landing/product.webp" alt={l.shotAlt} note={l.shotPending} />
        {/* 底边渐隐到页面背景 —— 用的是画布色令牌，不是新色值 */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
          style={{ background: "linear-gradient(to top, var(--color-canvas), transparent)" }}
        />
      </div>
    </section>
  )
}
