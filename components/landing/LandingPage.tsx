import type { Dict, Locale } from "@/lib/i18n-shared"
import type { LandingData } from "@/lib/queries/landing"
import LandingNav from "./LandingNav"
import LandingHero from "./LandingHero"
import DataSection from "./DataSection"
import BusinessLines from "./BusinessLines"
import PipelineSection from "./PipelineSection"
import LandingFooter from "./LandingFooter"

/**
 * 官网落地页（V2-18 改版）= 六个 section：
 *   1 导航 · 2 首屏 · 3 数据段（覆盖带 + 六个切面，合并） · 4 三条业务线 ·
 *   5 数据管道 · 6 页脚
 *
 * 改版前是「覆盖带」和「数据切面」两个并列 section，中间 160px 留白；
 * 现在合并成 DataSection 共享一块底色与流体背景，并新增第 5 段管道。
 * 旧规范的「六个 section 不多加」已作废，见 docs/DESIGN.md 第 6.0 节。
 *
 * 整页**一个服务端组件取一次数**（`app/page.tsx` → `getLandingData()`），往下传。
 * 段落之间的节奏交给各 section 自己的 padding，不再统一 mt-40 ——
 * 有底色的段落靠底色分隔，再加大留白会断开。
 *
 * 语气不变：陈述事实，不讲好处。没有口号、感叹号、「赋能」、创始人故事、
 * 路线图、开发者署名、技术栈展示。
 */
export default function LandingPage({
  locale, t, data, enterHref,
}: {
  locale: Locale
  /** 「进入系统」的去向：已登录 /overview，未登录 /login */
  enterHref: string
  t: Dict
  data: LandingData
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav locale={locale} t={t} enterHref={enterHref} />

      <main>
        <LandingHero locale={locale} t={t} coverage={data.coverage} enterHref={enterHref} />
        <DataSection locale={locale} t={t} data={data} />
        <BusinessLines locale={locale} t={t} />
        <PipelineSection locale={locale} t={t} />
      </main>

      <LandingFooter locale={locale} t={t} enterHref={enterHref} />
    </div>
  )
}
