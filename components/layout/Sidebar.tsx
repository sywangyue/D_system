"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Target, Building2, FileText, Map, Settings, LogOut,
} from "lucide-react"
import type { SessionUser } from "@/lib/session"
import BrandLockup from "@/components/brand/BrandLockup"

/**
 * 侧栏。user 由服务端组件经 AppShell 传入 —— 客户端不再自己读登录态。
 * 品牌锁定走 BrandLockup（橙板 + 衬线中文），规范见 docs/BRAND-LOGO.md。
 */

const NAV = [
  { href: "/overview",    label: "盘面",     lat: "Overview", icon: LayoutDashboard },
  { href: "/opportunity", label: "机会台",   lat: "Pipeline", icon: Target },
  { href: "/company",     label: "公司库",   lat: "Entities", icon: Building2 },
  { href: "/research",    label: "调研库",   lat: "Reports",  icon: FileText },
  { href: "/expo",        label: "展会底图", lat: "Basemap",  icon: Map },
  { href: "/setting",     label: "设置",     lat: "Settings", icon: Settings, adminOnly: true },
]

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    // 只有 cookie 一处状态，清掉后刷新即可，没有 localStorage 要一起清
    router.replace("/login")
    router.refresh()
  }

  const items = NAV.filter(i => !i.adminOnly || user.role === "admin")

  return (
    <aside className="w-[200px] shrink-0 h-full flex flex-col bg-sidebar hairline-r">
      {/* 品牌锁定 —— 橙板内拉丁在前、发丝线、衬线中文在后。规范见 docs/BRAND-LOGO.md
          用标准态：这块 56px 高、200px 宽的栏能容下的最大一档（板 92×33，两侧余 8px）。
          再大就得动侧栏宽度与表头高度，那是另一个决定。 */}
      <div className="h-14 flex items-center px-5 hairline-b">
        <BrandLockup size="standard" />
      </div>

      <nav className="flex-1 py-2">
        {items.map(({ href, label, lat, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 h-9 px-5 text-[13px]
                ${active ? "text-fg bg-surface-elevated" : "text-fg-muted hover:text-fg hover:bg-surface"}`}
              style={{ transition: "background-color var(--dur-fast) var(--ease-standard)" }}
            >
              <Icon size={16} className={active ? "text-fg" : "text-fg-subtle"} />
              <span>{label}</span>
              <span className="lat ml-auto text-[10px] uppercase tracking-wider text-fg-faint">
                {lat}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 hairline-t">
        <div className="text-[12px] text-fg-muted truncate">{user.display_name}</div>
        <div className="lat text-[11px] text-fg-subtle truncate mb-2">{user.email}</div>
        <button
          onClick={handleLogout}
          className="btn flex items-center gap-1.5 text-[12px] text-fg-subtle hover:text-fg bg-transparent border-0 p-0 cursor-pointer"
        >
          <LogOut size={13} />
          <span>退出</span>
        </button>
      </div>
    </aside>
  )
}
