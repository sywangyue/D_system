"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/calendar", label: "日历", icon: "calendar" },
  { href: "/map", label: "地图", icon: "map" },
  { href: "/setting", label: "设置", icon: "settings", adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? null);
        setIsAdmin(data.user.app_metadata?.role === "admin");
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="w-sidebar flex-shrink-0 h-full bg-surface border-r border-border flex flex-col">
      {/* Logo area */}
      <div className="h-16 flex items-center px-4">
        <span className="text-base font-semibold text-text-primary">MWLAB</span>
      </div>

      {/* Navigation items */}
      <nav className="flex-1">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 min-h-nav-item transition-[background] duration-150 ease
                ${isActive
                  ? "border-l-4 border-accent bg-accent-surface"
                  : "border-l-4 border-transparent hover:bg-border"
                }`}
            >
              <svg
                className={`w-5 h-5 ${isActive ? "text-accent" : "text-gray-500"}`}
                aria-hidden="true"
              >
                <use href={`/icons.svg#${item.icon}`} />
              </svg>
              <span
                className={`text-sm ${isActive ? "font-semibold text-accent-dark" : "font-normal text-gray-700"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom user area */}
      {userEmail && (
        <div className="mt-auto p-4 border-t border-border">
          <div className="text-sm text-text-secondary truncate">
            {userEmail}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-text-primary mt-1 cursor-pointer"
          >
            退出
          </button>
        </div>
      )}
    </aside>
  );
}
