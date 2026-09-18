import type { Dict, Locale } from "@/lib/i18n-shared"
import type { LandingData } from "@/lib/queries/landing"
import CoverageBand from "./CoverageBand"
import DataFacets from "./DataFacets"
import FluidBackdrop from "./FluidBackdrop"

/**
 * 数据段（V2-18 新增的包装层）。
 *
 * 改版前「数据覆盖带」与「数据切面」是两个并列 section，中间隔 160px 留白，
 * 读起来是两件事。合并成一段之后它们共享一块底色和一层流体背景，
 * 读起来是「这是我们的数据，这是它的六种读法」。
 *
 * 三层结构，顺序不能乱：
 *   底  `--color-surface` 底色 + 上下发丝线，与画布白拉开层次
 *   中  FluidBackdrop（z-1，pointer-events-none）
 *   上  内容层（z-2），数字与图表在这里，不受流体影响
 */
export default function DataSection({
  locale, t, data,
}: {
  locale: Locale
  t: Dict
  data: LandingData
}) {
  return (
    <section
      id="data"
      className="hairline-t hairline-b relative scroll-mt-14 overflow-hidden bg-surface px-6 py-20"
    >
      <FluidBackdrop />
      <div className="relative z-[2] mx-auto w-full max-w-[1240px]">
        <CoverageBand locale={locale} t={t} coverage={data.coverage} />
        <DataFacets locale={locale} t={t} data={data} />
      </div>
    </section>
  )
}
