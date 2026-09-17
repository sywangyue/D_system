import { INDUSTRY_L1, enumLabel } from "@/lib/enums"
import { fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"

/**
 * 行业结构的单条横向堆叠条（+ 可选标签列表）。
 *
 * 抽出来给 /expo 与落地页共用（TASK-J §4.4 第 3 块「复用 H 的行业堆叠条」）。
 * 单条堆叠、不是饼图；不画轴线、不画网格线、图内不放图例；
 * 8 个分段靠**同一色的透明度阶梯**区分（不引入新颜色，§6.4）。
 *
 * 服务端组件即可（无状态、无事件），落地页直接渲染、不用多一个客户端包。
 */
export default function IndustryBar({
  industry, t, locale, showList = true, highlightKey = null,
}: {
  industry: { key: string; count: number }[]
  t: Dict
  locale: Locale
  showList?: boolean
  /** 落地页会把「最大的那一类」用最深的中性色强调；/expo 不强调 */
  highlightKey?: string | null
}) {
  const total = industry.reduce((s, r) => s + r.count, 0) || 1
  const labels = t.enum.industryL1 as Record<string, string>

  return (
    <>
      <div className="flex h-[9px] rounded-[2px] overflow-hidden bg-surface-elevated">
        {industry.map((r, i) => (
          <div key={r.key}
               title={`${enumLabel(INDUSTRY_L1, labels, r.key)} · ${fmtNum(locale, r.count)}`}
               style={{ width: `${(r.count / total) * 100}%`, background: "var(--color-fg)",
                        opacity: highlightKey === r.key ? 1 : 0.85 - (i % 8) * 0.09 }} />
        ))}
      </div>

      {showList && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
          {industry.map((r, i) => (
            <li key={r.key} className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
              <span className="w-1.5 h-1.5 shrink-0"
                    style={{ background: "var(--color-fg)",
                             opacity: highlightKey === r.key ? 1 : 0.85 - (i % 8) * 0.09 }} />
              <span className="truncate flex-1">{enumLabel(INDUSTRY_L1, labels, r.key)}</span>
              <span className="num text-fg-faint">{fmtNum(locale, r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
