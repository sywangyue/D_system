import Link from "next/link"
import BrandLockup from "@/components/brand/BrandLockup"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * §4.6 页脚。顶部一条发丝线；左：字标 + 两行小字；右：「进入系统 →」+ 一行小字。
 * **没有别的** —— 没有开发者署名、社交图标、订阅框、站点地图。
 */
export default function LandingFooter({
  locale, t, enterHref,
}: { locale: Locale; t: Dict; enterHref: string }) {
  const l = t.landing.footer

  return (
    <footer className="hairline-t mt-40">
      <div className="mx-auto flex w-full max-w-[1200px] items-start justify-between px-6 py-16">
        <div>
          <BrandLockup size="standard" showCn={locale === "zh"} />
          <div className="mt-5 text-[12px] leading-relaxed text-fg-subtle">
            <div>{l.org}</div>
            <div>{l.copyright}</div>
          </div>
        </div>

        <div className="text-right">
          <Link href={enterHref} className="text-[13px] text-fg transition-colors hover:text-fg-muted">
            {l.enter}
          </Link>
          <div className="mt-2 text-[12px] text-fg-subtle">{l.accessNote}</div>
        </div>
      </div>
    </footer>
  )
}
