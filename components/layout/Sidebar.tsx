"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import {
  LayoutDashboard,
  Calendar,
  Map,
  Settings,
  LogOut,
} from "lucide-react"
import { getAuthState, clearAuth } from "@/lib/auth"

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { href: "/calendar", label: "日历", icon: <Calendar size={20} /> },
  { href: "/map", label: "地图", icon: <Map size={20} /> },
  { href: "/setting", label: "设置", icon: <Settings size={20} />, adminOnly: true },
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
    <aside className="w-sidebar flex-shrink-0 h-full bg-surface border-r border-border flex flex-col">
      {/* Logo area */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <span className="text-base font-semibold text-text-primary tracking-wide">
          MWLAB
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
              className={`flex items-center gap-3 px-4 min-h-nav-item transition-all duration-150 ease
                ${isActive
                  ? "border-l-4 border-accent bg-accent-surface text-accent-dark"
                  : "border-l-4 border-transparent hover:bg-border text-gray-600 hover:text-text-primary"
                }`}
            >
              <span className={isActive ? "text-accent" : "text-gray-400"}>
                {item.icon}
              </span>
              <span
                className={`text-sm ${isActive ? "font-semibold" : "font-normal"}`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom user area */}
      {userEmail && (
        <div className="mt-auto p-4 border-t border-border">
          <div className="text-sm text-text-secondary truncate mb-1">
            {userEmail}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-text-primary transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>退出</span>
          </button>
        </div>
      )}
    </aside>
  )
}
