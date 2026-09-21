import type { Dict, Locale } from "@/lib/i18n-shared"
import { fill, fmtDateTime } from "@/lib/i18n-shared"
import { enumLabel, USER_ROLE, USER_STATE } from "@/lib/enums"

export interface UserEntry {
  user_id: string;
  email: string;
  role: string;
  is_active: number;
  last_login: string | null;
}

/** 角色与状态都是闭集枚举，标签走字典（原先 switch 里写死中文） */
function getUserStatus(user: UserEntry, t: Dict): { label: string; color: string } {
  if (!user.is_active) {
    return { label: enumLabel(USER_STATE, t.enum.userState, "disabled"),
             color: "bg-amber-100 text-amber-800" };
  }
  if (user.last_login) {
    const lastLogin = new Date(user.last_login).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (lastLogin > thirtyDaysAgo) {
      return { label: enumLabel(USER_STATE, t.enum.userState, "active"),
               color: "bg-green-100 text-green-800" };
    }
  }
  return { label: enumLabel(USER_STATE, t.enum.userState, "inactive"),
           color: "bg-surface-elevated text-fg-muted" };
}

function getRoleBadge(role: string, t: Dict): { label: string; color: string } {
  // role 值本身就是 admin / manager / readonly，与字典 slug 一致
  const label = enumLabel(USER_ROLE, t.enum.role, role, role);
  switch (role) {
    case "admin":   return { label, color: "bg-red-100 text-red-700" };
    case "manager": return { label, color: "bg-blue-100 text-blue-700" };
    default:        return { label, color: "bg-surface-elevated text-fg-muted" };
  }
}

export function UsersTableSkeleton() {
  return (
    <div className="bg-surface border border-hairline rounded-xl overflow-hidden animate-pulse">
      <div className="h-10 bg-surface-elevated mx-6 mt-5 rounded w-28" />
      <div className="px-4 md:px-6 py-3 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-5 w-48 bg-surface-elevated rounded" />
            <div className="h-5 w-16 bg-surface-elevated rounded-full" />
            <div className="h-5 w-12 bg-surface-elevated rounded-full" />
            <div className="h-5 w-32 bg-surface-elevated rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsersTable({
  users, t, locale,
}: {
  users: UserEntry[]
  t: Dict
  locale: Locale
}) {
  if (users.length === 0) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-6 text-center text-sm text-fg-muted">
        {t.settings.usersEmpty}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-xl overflow-hidden">
      <h2 className="text-base font-semibold text-fg px-4 md:px-6 pt-5 pb-3">
        {fill(t.settings.usersTitle, { count: users.length })}
      </h2>
      <div className="overflow-x-auto">
        <table className="table-cards w-full text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-fg-muted uppercase">
                {t.settings.colEmail}
              </th>
              <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-fg-muted uppercase">
                {t.settings.colRole}
              </th>
              <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-fg-muted uppercase">
                {t.settings.colState}
              </th>
              <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-fg-muted uppercase">
                {t.settings.colLastLogin}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleBadge = getRoleBadge(user.role, t);
              const status = getUserStatus(user, t);
              return (
                <tr
                  key={user.user_id}
                  className="border-b border-hairline last:border-0 hover:bg-surface-elevated transition-colors"
                >
                  <td className="px-4 md:px-6 py-3 font-mono text-xs text-fg">
                    {user.email}
                  </td>
                  <td className="px-4 md:px-6 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.color}`}
                    >
                      {roleBadge.label}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3 text-fg-muted">
                    {fmtDateTime(locale, user.last_login, "--")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
