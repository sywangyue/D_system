import { fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"
import type { Coverage } from "@/lib/queries/landing"

/**
 * §4.3 数据覆盖带。一整行，竖向发丝线分成 6 格，上下各一条发丝线。
 *
 * 六个数全部来自 getLandingData()，一个都不写死在 JSX 或字典里（§2）。
 * 「企业档案」只给行数，不给任何 company 的行 —— 公开页面不带内部数据（§6.2）。
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
    <section id="data" className="mx-auto mt-40 w-full max-w-[1200px] scroll-mt-14 px-6">
      {/* gap-px + 底色发丝色 = 六条竖向发丝线；上下两条由 hairline-t/b 给 */}
      <div className="hairline-t hairline-b grid grid-cols-6 gap-px bg-hairline">
        {cells.map(c => (
          <div key={c.label} className="bg-canvas px-5 py-7">
            <div className="num text-[36px] leading-none text-fg">{fmtNum(locale, c.n)}</div>
            <div className="mt-3 text-[11px] uppercase tracking-wider text-fg-subtle">{c.label}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-fg-subtle">{l.note}</p>
    </section>
  )
}
