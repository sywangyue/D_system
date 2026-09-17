import { Check } from "lucide-react"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * §4.5 三条业务线 —— 全页最短的 section。
 *
 * 三列：一个淡色序号、标题、两行以内的说明、三个短条目。
 * **只用竖向发丝线分隔**，不用卡片、不填底色、不加圆角（§4.5）。
 *
 * 标题直接用字典里现成的 enum.bizLine，不再写一份（§4.5）。
 * 第二列按 §2 的理由把设计稿里的「已终止信号识别」改为「届次断档识别」——
 * 断档是数据事实，终止是品牌状态判断，公开页面上只能写前者。
 * 条目小勾用最深中性色，不用橙（§6.4 —— 页面上除字标外不许有橙）。
 */
export default function BusinessLines({
  locale, t,
}: {
  locale: Locale
  t: Dict
}) {
  const l = t.landing.biz
  const h2 = locale === "zh" ? "text-[42px]" : "text-[44px]"

  const lines: { index: string; title: string; desc: string; items: string[] }[] = [
    { index: "01", title: t.enum.bizLine.ma, desc: l.maDesc, items: l.maItems },
    { index: "02", title: t.enum.bizLine.greenfield, desc: l.greenfieldDesc, items: l.greenfieldItems },
    { index: "03", title: t.enum.bizLine.project_support, desc: l.projectDesc, items: l.projectItems },
  ]

  return (
    <section id="business" className="mx-auto mt-40 w-full max-w-[1200px] scroll-mt-14 px-6">
      <div className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">{l.overline}</div>
      <h2 className={`${h2} mt-4 font-medium leading-[1.2] text-fg`}>{l.headline}</h2>

      <div className="mt-16 grid grid-cols-3">
        {lines.map((line, i) => (
          <div
            key={line.index}
            className={`${i === 0 ? "pr-8" : i === 2 ? "pl-8" : "px-8"} ${i < 2 ? "hairline-r" : ""}`}
          >
            <div className="num text-[44px] leading-none text-fg-faint">{line.index}</div>
            <h3 className="mt-6 text-[20px] leading-snug text-fg">{line.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{line.desc}</p>
            <ul className="mt-6 space-y-2.5">
              {line.items.map(item => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-fg-muted">
                  {/* 小勾：最深中性色，10px 级别，不用 emoji、不用橙 */}
                  <Check size={12} strokeWidth={2.5} className="shrink-0 text-fg" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
