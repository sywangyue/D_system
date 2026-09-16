"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import {
  LayoutDashboard,
  Settings,
  LogOut,
  User,
} from "lucide-react"
import { getAuthState, clearAuth } from "@/lib/auth"

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard.html", label: "看板",    icon: <LayoutDashboard size={18} /> },
  { href: "/profile",        label: "个人资料", icon: <User size={18} /> },
  { href: "/setting",        label: "设置",    icon: <Settings size={18} />, adminOnly: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userInfo] = useState(() => getAuthState())
  const { userEmail, isAdmin } = userInfo

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    clearAuth()
    router.push("/login")
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  )

  return (
    <aside className="w-sidebar flex-shrink-0 h-full bg-surface flex flex-col" style={{ borderRight: "1px solid #F2F2F7" }}>
      {/* Logo area */}
      <div style={{ height: "64px", display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid #F2F2F7" }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#1D1D1F", letterSpacing: "-0.3px" }}>
          MWLAB
        </span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#AEAEB2", marginLeft: "6px" }}>
          2026
        </span>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-2">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-5 min-h-nav-item transition-all duration-150"
              style={{
                background: isActive ? "#FFF8F5" : "transparent",
                color: isActive ? "#FE5C00" : "#6E6E73",
              }}
            >
              <span style={{ color: isActive ? "#FE5C00" : "#AEAEB2", display: "flex", alignItems: "center" }}>
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#FE5C00" : "#6E6E73",
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom user area */}
      {userEmail && (
        <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: "12px", color: "#6E6E73", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>
            {userEmail}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 transition-colors cursor-pointer"
            style={{ fontSize: "12px", color: "#AEAEB2", background: "none", border: "none", padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1D1D1F")}
            onMouseLeave={e => (e.currentTarget.style.color = "#AEAEB2")}
          >
            <LogOut size={14} />
            <span>退出</span>
          </button>
        </div>
      )}
    </aside>
  )
}
