import MapSvg from "@/components/basemap/MapSvg"
import IndustryBar from "@/components/basemap/IndustryBar"
import { fill, fmtNum, LOCALE_TAG, type Dict, type Locale } from "@/lib/i18n-shared"
import type { LandingData } from "@/lib/queries/landing"

/**
 * §4.4 数据切面 —— 全页主 section。3×2 六块面板，每块：标题 + 一行说明 + 一个真实数据小图。
 *
 * 图的规矩（§4.4）：不要网格线、不要图内图例，只在两端标数值。
 * 面板之间只用发丝线分隔，不填底色、不加圆角、不带投影（§6.6 禁「带投影的卡片网格」）。
 *
 * 第 1、3 块**复用 H 的组件**（MapSvg / IndustryBar）—— 照着重画一份的话，
 * 投影、半径标度、行业口径早晚会与 /expo 不一致。
 * 地图**不传 onPick**，即只读：不响应点击、不改筛选（§4.4 第 1 块）。
 *
 * EN 下的数据中文按 §4.4 回退：品牌名有 name_en 用 name_en，没有才回退 name_cn。
 * 集团名与城市名是数据，原样显示（不进字典，§6.5）。
 */

/** 月份标签从 Intl 生成，字典里不放「1 月」这种串（数字不进字典，§6.5）。 */
function monthLabel(locale: Locale, month: number): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: "short" })
    .format(new Date(2026, month - 1, 1))
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col bg-canvas p-8">
      <h3 className="text-[15px] text-fg">{title}</h3>
      <p className="mt-1.5 text-[12px] text-fg-subtle">{desc}</p>
      <div className="mt-7 flex flex-1 flex-col justify-center">{children}</div>
    </div>
  )
}

/**
 * 集团名是数据（brand_organizer.canonical），但库里多为「中文（English）」的写法，
 * 如「法兰克福展览（Messe Frankfurt）」。英文界面取括号里的英文名；
 * 没有括号的（如 Informa Markets）原样显示。
 */
function orgName(locale: Locale, canonical: string): string {
  if (locale !== "en") return canonical
  const m = canonical.match(/[（(]([^（）()]+)[）)]\s*$/)
  return m ? m[1].trim() : canonical
}

export default function DataFacets({
  locale, t, data,
}: {
  locale: Locale
  t: Dict
  data: LandingData
}) {
  const l = t.landing.facets
  const h2 = locale === "zh" ? "text-[42px]" : "text-[44px]"

  const { organizers, topCities, schedule, no2026, expo } = data

  const orgMax = Math.max(...organizers.map(o => o.count), 1)
  const peakIndustry = expo.industry.reduce<{ key: string; count: number } | null>(
    (top, r) => (top === null || r.count > top.count ? r : top), null,
  )
  const scheduleMax = Math.max(...schedule.map(s => s.count), 1)
  const no2026Total = no2026.withCount + no2026.withoutCount || 1

  return (
    <section id="capability" className="mx-auto mt-40 w-full max-w-[1200px] scroll-mt-14 px-6">
      <div className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">{l.overline}</div>
      <h2 className={`${h2} mt-4 font-medium leading-[1.2] text-fg`}>{l.headline}</h2>

      <div className="mt-16 grid grid-cols-3 gap-px bg-hairline">
        {/* 1 · 地理分布 —— 复用 H 的地图组件，只读 */}
        <Panel title={l.mapTitle} desc={l.mapDesc}>
          <MapSvg points={expo.points} locale={locale} />
          {expo.unlocated > 0 && (
            <p className="mt-2.5 text-[10px] text-fg-faint">
              {fill(l.mapUnlocated, { count: fmtNum(locale, expo.unlocated) })}
            </p>
          )}
        </Panel>

        {/* 2 · 主办方集团 —— 杜塞尔多夫展览那一条用最深中性色强调（§6.4） */}
        <Panel title={l.orgTitle} desc={l.orgDesc}>
          <div className="space-y-2.5">
            {organizers.map(o => (
              <div key={o.canonical} className="grid grid-cols-[1fr_84px_32px] items-center gap-3">
                <span className={`truncate text-[12px] ${o.highlight ? "text-fg" : "text-fg-subtle"}`}>
                  {orgName(locale, o.canonical)}
                </span>
                <span className="block h-[8px] bg-sidebar">
                  <span
                    className="block h-full"
                    style={{
                      width: `${(o.count / orgMax) * 100}%`,
                      background: "var(--color-fg)",
                      opacity: o.highlight ? 1 : 0.28,
                    }}
                  />
                </span>
                <span className={`num text-right text-[11px] ${o.highlight ? "text-fg" : "text-fg-faint"}`}>
                  {fmtNum(locale, o.count)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* 3 · 行业结构 —— 复用 H 的行业堆叠条，最大那一类用最深中性色 */}
        <Panel title={l.industryTitle} desc={l.industryDesc}>
          <IndustryBar
            industry={expo.industry}
            t={t}
            locale={locale}
            highlightKey={peakIndustry?.key ?? null}
          />
        </Panel>

        {/* 4 · 规模排名 —— 按城市汇总，不点名品牌（重复记录未合并前，品牌榜会露出重复与脏名字） */}
        <Panel title={l.scaleTitle} desc={l.scaleDesc}>
          <table className="w-full table-fixed border-collapse text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                <th className="w-[40%] pb-2 text-left font-normal">{l.colCity}</th>
                <th className="w-[24%] pb-2 text-right font-normal">{l.colBrands}</th>
                <th className="w-[36%] pb-2 pl-2 text-right font-normal">{l.colArea}</th>
              </tr>
            </thead>
            <tbody>
              {topCities.map(r => (
                <tr key={r.city} className="hairline-t">
                  {/* 城市名是数据，原样显示 */}
                  <td className="truncate py-2 pr-2 text-fg-muted">{r.city}</td>
                  <td className="num py-2 text-right text-fg-muted">{fmtNum(locale, r.brands)}</td>
                  <td className="num py-2 pl-2 text-right text-fg-subtle">{fmtNum(locale, r.area)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* 5 · 档期分布 —— 12 根柱，最密的月份用最深中性色，只在柱顶标数值 */}
        <Panel title={l.scheduleTitle} desc={l.scheduleDesc}>
          <div>
            <div className="flex h-[120px] items-end gap-1.5">
              {schedule.map(s => (
                <div key={s.month} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span
                    className={`num mb-1 text-[10px] leading-none ${
                      s.highlight ? "text-fg" : "text-transparent"
                    }`}
                  >
                    {fmtNum(locale, s.count)}
                  </span>
                  <span
                    className="block w-full"
                    style={{
                      height: `${(s.count / scheduleMax) * 82}%`,
                      background: "var(--color-fg)",
                      opacity: s.highlight ? 1 : 0.22,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              {schedule.map(s => (
                <span key={s.month} className="flex-1 text-center text-[10px] text-fg-faint">
                  {monthLabel(locale, s.month)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-fg-subtle">
              {fill(l.schedulePeak, { n: fmtNum(locale, scheduleMax) })}
            </p>
          </div>
        </Panel>

        {/* 6 · 无 2026 年届次的品牌 —— 只有双色横条，不列样例品牌（2026-09-17 Max 定）。
        ⚠️ 标签只能是事实描述（「无 2026 年届次」）。这是公开页面，
        对两千多个真实展会品牌下「已终止」这类判断是超出数据的事实（§2）。 */}
        <Panel title={l.no2026Title} desc={l.no2026Desc}>
          <div>
            <div className="flex h-[10px] overflow-hidden">
              <span
                className="block"
                style={{
                  width: `${(no2026.withCount / no2026Total) * 100}%`,
                  background: "var(--color-fg)",
                }}
              />
              <span
                className="block"
                style={{
                  width: `${(no2026.withoutCount / no2026Total) * 100}%`,
                  background: "var(--color-fg)",
                  opacity: 0.28,
                }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-[11px]">
              <span className="text-fg">
                {fill(l.no2026With, { n: fmtNum(locale, no2026.withCount) })}
              </span>
              <span className="text-fg-subtle">
                {fill(l.no2026Without, { n: fmtNum(locale, no2026.withoutCount) })}
              </span>
            </div>

          </div>
        </Panel>
      </div>
    </section>
  )
}
