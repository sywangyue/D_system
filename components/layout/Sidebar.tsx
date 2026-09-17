"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Target, Building2, FileText, Map, Settings, LogOut,
} from "lucide-react"
import type { SessionUser } from "@/lib/session"

/**
 * 侧栏。user 由服务端组件经 AppShell 传入 —— 客户端不再自己读登录态。
 * 品牌锁定：拉丁在前、中文在后，永不调换。收起态只留单字「象」。
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
      {/* 品牌锁定 —— 拉丁在前，中文在后 */}
      <div className="h-14 flex items-center gap-2.5 px-5 hairline-b">
        <span className="lat text-[15px] font-semibold tracking-tight text-fg">MWLAB</span>
        <span className="w-px h-3.5 bg-hairline-active" />
        <span className="text-[13px] font-normal text-fg-muted">万象</span>
      </div>

      <nav className="flex-1 py-2">
        {items.map(({ href, label, lat, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 h-9 px-5 text-[13px]
                ${active ? "text-fg bg-surface-hover" : "text-fg-muted hover:text-fg hover:bg-surface"}`}
              style={{ transition: "background-color var(--dur-fast) var(--ease-standard)" }}
            >
              {active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}
              <Icon size={16} className={active ? "text-accent" : "text-fg-faint"} />
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
        <div className="lat text-[11px] text-fg-faint truncate mb-2">{user.email}</div>
        <button
          onClick={handleLogout}
          className="btn flex items-center gap-1.5 text-[12px] text-fg-faint hover:text-fg bg-transparent border-0 p-0 cursor-pointer"
        >
          <LogOut size={13} />
          <span>退出</span>
        </button>
      </div>
    </aside>
  )
}
