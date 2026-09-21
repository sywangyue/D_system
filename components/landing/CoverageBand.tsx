import { fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"
import type { Coverage } from "@/lib/queries/landing"

/**
 * 数据覆盖带 —— V2-18 起是 DataSection 的上半部分，不再是独立 section。
 *
 * 旧版用竖向发丝线分成 6 格。改版后去掉格线：这一段整体有了底色，
 * 再加格线就是两层分隔，数字反而被框住。现在靠间距和字号分组。
 *
 * 六个数全部来自 getLandingData()，一个都不写死。
 * 「企业档案」只给行数，不给任何 company 的行 —— 公开页面不带内部数据。
 */
export default function CoverageBand({
  locale, t, coverage,
}: {
  locale: Locale
  t: Dict
  coverage: Coverage
}) {
  const l = t.landing.coverage
  const cells: { n: number; label: string }[] = [
    { n: coverage.brands, label: l.brands },
    { n: coverage.groups, label: l.groups },
    { n: coverage.editions, label: l.editions },
    { n: coverage.geoTags, label: l.geoTags },
    { n: coverage.companies, label: l.companies },
    { n: coverage.verified, label: l.verified },
  ]

  return (
    <div className="hairline-b pb-12">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-6 md:gap-5">
        {cells.map(c => (
          <div key={c.label}>
            <div className="num text-[26px] font-medium leading-[1.1] text-fg md:text-[32px]">
              {fmtNum(locale, c.n)}
            </div>
            <div className="mt-2 text-[12px] text-fg-subtle">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-fg-faint">{l.note}</p>
    </div>
  )
}
