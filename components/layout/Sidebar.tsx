"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Target, Building2, FileText, BookOpen, Map, Settings, LogOut,
  Menu, X,
} from "lucide-react"
import type { SessionUser } from "@/lib/session"
import type { Dict, Locale } from "@/lib/i18n-shared"
import BrandLockup from "@/components/brand/BrandLockup"

/**
 * 侧栏。user 与字典都由服务端组件经 AppShell 传入 ——
 * 客户端不再自己读登录态，也不自己读语言。
 * 品牌锁定走 BrandLockup（橙板 + 衬线中文），规范见 docs/DESIGN.md。
 *
 * 两个形态，同一份内容（V2-21）：
 *   ≥768px  左侧固定 200px 栏，与改版前完全一致
 *   <768px  收成 52px 顶栏（Logo + 汉堡），点开从左侧滑出全高抽屉
 * 手机上留着 200px 固定栏会吃掉 390px 屏的一半，正文只剩 190px，
 * 中文就会一个字一行 —— 这是手机端最主要的病灶。
 */

/** key 对应字典的 nav.*；lat 是中文版右侧的拉丁小字。 */
const NAV: { href: string; key: keyof Dict["nav"]; lat: string; icon: typeof Target; adminOnly?: boolean }[] = [
  { href: "/overview",    key: "overview", lat: "Overview", icon: LayoutDashboard },
  { href: "/opportunity", key: "pipeline", lat: "Pipeline", icon: Target },
  { href: "/company",     key: "entities", lat: "Entities", icon: Building2 },
  { href: "/research",     key: "reports",  lat: "Reports",  icon: FileText },
  { href: "/knowledge",    key: "knowledge", lat: "Knowledge", icon: BookOpen },
  { href: "/expo",        key: "basemap",  lat: "Basemap",  icon: Map },
  { href: "/setting",     key: "settings", lat: "Settings", icon: Settings, adminOnly: true },
]

export default function Sidebar({
  user, locale, t,
}: {
  user: SessionUser
  locale: Locale
  t: Dict
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isEn = locale === "en"
  const [open, setOpen] = useState(false)

  // 路由一变就收起抽屉。点导航项是客户端跳转，不收的话新页面开着一层遮罩。
  useEffect(() => { setOpen(false) }, [pathname])

  // Esc 关闭：抽屉盖住整屏，键盘用户得有一条不靠鼠标的退路
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    // 只有 cookie 一处状态，清掉后刷新即可，没有 localStorage 要一起清
    router.replace("/login")
    router.refresh()
  }

  const items = NAV.filter(i => !i.adminOnly || user.role === "admin")

  /* 导航项与底部用户块在两个形态里逐字相同，抽出来各写一次。
     手机上把行高从 36 提到 44 —— 触摸目标低于 44px 点不准，
     这是两个形态唯一的差别，用 max-md: 前缀单独给。 */
  const nav = (
    <nav className="flex-1 py-2">
      {items.map(({ href, key, lat, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-3 h-11 md:h-9 px-5 text-[13px]
              ${active ? "text-fg bg-surface-elevated" : "text-fg-muted hover:text-fg hover:bg-surface"}`}
            style={{ transition: "background-color var(--dur-fast) var(--ease-standard)" }}
          >
            <Icon size={16} className={active ? "text-fg" : "text-fg-subtle"} />
            <span>{t.nav[key]}</span>
            {/* 拉丁小字只在中文版出现：英文版标签本身就是拉丁，再挂一个会重复 */}
            {!isEn && (
              <span className="lat ml-auto text-[10px] uppercase tracking-wider text-fg-faint">
                {lat}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="p-4 hairline-t">
      <div className="text-[12px] text-fg-muted truncate">{user.display_name}</div>
      <div className="lat text-[11px] text-fg-subtle truncate mb-2">{user.email}</div>
      <button
        onClick={handleLogout}
        className="btn flex items-center gap-1.5 text-[12px] text-fg-subtle hover:text-fg bg-transparent border-0 p-0 cursor-pointer"
      >
        <LogOut size={13} />
        <span>{t.nav.logout}</span>
      </button>
    </div>
  )

  return (
    <>
      {/* ── 手机顶栏。52px，参与 AppShell 的纵向 flex，不遮内容 ───────────── */}
      <header className="md:hidden shrink-0 h-13 flex items-center justify-between pl-4 pr-2 bg-sidebar hairline-b">
        <BrandLockup size="dense" showCn={!isEn} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.nav.menu}
          aria-expanded={open}
          className="btn flex h-11 w-11 items-center justify-center bg-transparent border-0 text-fg-muted cursor-pointer"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* ── 手机抽屉。open 时才挂，省得遮罩常驻在 DOM 里挡点击 ─────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-fg/25"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] max-w-[80vw] flex flex-col bg-sidebar hairline-r overflow-y-auto">
            <div className="h-13 shrink-0 flex items-center justify-between pl-4 pr-2 hairline-b">
              <BrandLockup size="dense" showCn={!isEn} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.nav.closeMenu}
                className="btn flex h-11 w-11 items-center justify-center bg-transparent border-0 text-fg-muted cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* ── 桌面侧栏。改版前那一份，一个像素没动 ────────────────────── */}
      <aside className="hidden md:flex w-[200px] shrink-0 h-full flex-col bg-sidebar hairline-r">
        {/* 品牌锁定 —— 橙板内拉丁在前、发丝线、衬线中文在后。规范见 docs/DESIGN.md
            用标准态：这块 56px 高、200px 宽的栏能容下的最大一档（板 92×33，两侧余 8px）。
            再大就得动侧栏宽度与表头高度，那是另一个决定。
            英文版摘掉「万象」二字 —— 那两个字必然要 CJK 字体。 */}
        <div className="h-14 flex items-center px-5 hairline-b">
          <BrandLockup size="standard" showCn={!isEn} />
        </div>
        {nav}
        {footer}
      </aside>
    </>
  )
}
