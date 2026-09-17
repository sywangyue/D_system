import type { Dict, Locale } from "@/lib/i18n-shared"
import type { LandingData } from "@/lib/queries/landing"
import LandingNav from "./LandingNav"
import LandingHero from "./LandingHero"
import CoverageBand from "./CoverageBand"
import DataFacets from "./DataFacets"
import BusinessLines from "./BusinessLines"
import LandingFooter from "./LandingFooter"

/**
 * 官网落地页 = 六个 section，不多加（§1 铁律 2）：
 *   1 导航 · 2 首屏 · 3 数据覆盖带 · 4 数据切面 · 5 三条业务线 · 6 页脚
 *
 * 整页**一个服务端组件取一次数**（`app/page.tsx` → `getLandingData()`），
 * 往下传；section 之间 160px（mt-40），内容列最宽 1200px（§4 开头）。
 *
 * 语气：陈述事实，不讲好处。没有口号、感叹号、「赋能」、创始人故事、路线图、
 * 开发者署名、技术栈展示（§1）。
 */
export default function LandingPage({
  locale, t, data,
}: {
  locale: Locale
  t: Dict
  data: LandingData
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav locale={locale} t={t} />

      <main>
        <LandingHero locale={locale} t={t} coverage={data.coverage} />
        <CoverageBand locale={locale} t={t} coverage={data.coverage} />
        <DataFacets locale={locale} t={t} data={data} />
        <BusinessLines locale={locale} t={t} />
      </main>

      <LandingFooter locale={locale} t={t} />
    </div>
  )
}
