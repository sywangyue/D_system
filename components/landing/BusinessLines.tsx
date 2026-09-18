import { Check } from "lucide-react"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * 三条业务线（V2-18 改版）。
 *
 * 旧版是三列纯文字、竖向发丝线分隔。改版后是三张翻转卡片：
 * 正面放序号 + 标题 + 一行说明，背面放三个短条目。
 * 旧规范的「不用卡片、不填底色、不加圆角」已作废，见 docs/DESIGN.md 第 6.0 节。
 *
 * **翻转靠 CSS，不用 JS**，所以这仍然是服务端组件。
 * 触屏没有 hover，`.flip-card` 在 (hover: none) 下退化为常驻双栏，
 * 背面内容不会变成摸不到的死信息 —— 规则在 globals.css。
 *
 * 标题直接用字典里现成的 enum.bizLine，不再写一份。
 * 第二列写「届次断档识别」而不是「已终止信号识别」：断档是数据事实，
 * 终止是品牌状态判断，公开页面上只能写前者。
 * 条目小勾用最深中性色，不用橙 —— 页面上除字标外不许有橙。
 */
export default function BusinessLines({
  locale, t,
}: {
  locale: Locale
  t: Dict
}) {
  const l = t.landing.biz
  const h2 = locale === "zh" ? "text-[27px]" : "text-[28px]"

  const lines: { index: string; title: string; desc: string; items: string[] }[] = [
    { index: "01", title: t.enum.bizLine.ma, desc: l.maDesc, items: l.maItems },
    { index: "02", title: t.enum.bizLine.greenfield, desc: l.greenfieldDesc, items: l.greenfieldItems },
    { index: "03", title: t.enum.bizLine.project_support, desc: l.projectDesc, items: l.projectItems },
  ]

  return (
    <section id="business" className="mx-auto w-full max-w-[1240px] scroll-mt-14 px-6 py-20">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-fg-subtle">
        {l.overline}
      </div>
      <h2 className={`${h2} mt-2 font-semibold leading-[1.2] text-fg`}>{l.headline}</h2>

      <div className="mt-8 grid grid-cols-3 gap-5">
        {lines.map(line => (
          <div key={line.index} className="flip-card min-h-[260px]">
            <div className="flip-card-inner">
              {/* 正面 */}
              <div className="flip-face rounded-[8px] border border-hairline bg-surface-elevated p-6">
                <div className="num text-[32px] leading-none text-fg-faint">{line.index}</div>
                <h3 className="mt-5 text-[18px] font-semibold leading-snug text-fg">{line.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{line.desc}</p>
              </div>
              {/* 背面 */}
              <div className="flip-face flip-face-back rounded-[8px] border border-hairline bg-surface-elevated p-6">
                <div className="num text-[12px] leading-none text-fg-faint">{line.index}</div>
                <ul className="mt-5 space-y-3">
                  {line.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-[13px] text-fg-muted">
                      <Check size={12} strokeWidth={2.5} className="shrink-0 text-fg" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
