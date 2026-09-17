import Link from "next/link"
import BrandLockup from "@/components/brand/BrandLockup"
import LocaleSwitch from "@/components/layout/LocaleSwitch"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * §4.1 导航 —— 56px（h-14），固定在顶部。
 *
 * 左：品牌锁定（现成组件，不改）。右：三个锚点 → §4.3 / §4.4 / §4.5，
 * 语言切换（与登录页共用同一个 LocaleSwitch），以及「进入系统」→ /login。
 *
 * 没有 DE：`locales/` 里只有 zh 与 en，德文待人工翻译。
 * 放一个点了没反应的按钮比不放更糟。
 */
export default function LandingNav({
  locale, t, enterHref,
}: { locale: Locale; t: Dict; enterHref: string }) {
  const l = t.landing.nav
  const anchors: { href: string; label: string }[] = [
    { href: "#data", label: l.data },
    { href: "#capability", label: l.capability },
    { href: "#business", label: l.business },
  ]

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 hairline-b bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-6">
        <BrandLockup size="standard" showCn={locale === "zh"} />

        <nav className="flex items-center gap-7">
          {anchors.map(a => (
            <a
              key={a.href}
              href={a.href}
              className="text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              {a.label}
            </a>
          ))}

          <LocaleSwitch locale={locale} />

          <Link
            href={enterHref}
            className="btn inline-flex h-8 items-center rounded-[4px] bg-accent px-3.5 text-[13px] font-medium text-accent-fg"
          >
            {l.enter}
          </Link>
        </nav>
      </div>
    </header>
  )
}
