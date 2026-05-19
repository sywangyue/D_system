export interface UserEntry {
  user_id: string;
  email: string;
  role: string;
  is_active: number;
  last_login: string | null;
}

function getUserStatus(user: UserEntry): { label: string; color: string } {
  if (!user.is_active) return { label: "已禁用", color: "bg-amber-100 text-amber-800" };
  if (user.last_login) {
    const lastLogin = new Date(user.last_login).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (lastLogin > thirtyDaysAgo) return { label: "活跃", color: "bg-green-100 text-green-800" };
  }
  return { label: "未活跃", color: "bg-gray-100 text-gray-600" };
}

function getRoleBadge(role: string): { label: string; color: string } {
  switch (role) {
    case "admin":   return { label: "管理员", color: "bg-red-100 text-red-700" };
    case "manager": return { label: "经理",   color: "bg-blue-100 text-blue-700" };
    default:        return { label: "只读",   color: "bg-gray-100 text-gray-600" };
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

export function UsersTableSkeleton() {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden animate-pulse">
      <div className="h-10 bg-gray-100 mx-6 mt-5 rounded w-28" />
      <div className="px-6 py-3 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-5 w-48 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-5 w-12 bg-gray-100 rounded-full" />
            <div className="h-5 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsersTable({ users }: { users: UserEntry[] }) {
  if (users.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-text-secondary">
        暂无用户数据
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <h2 className="text-base font-semibold text-text-primary px-6 pt-5 pb-3">
        用户管理 ({users.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                邮箱
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                角色
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                状态
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                最后登录
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleBadge = getRoleBadge(user.role);
              const status = getUserStatus(user);
              return (
                <tr
                  key={user.user_id}
                  className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-xs text-text-primary">
                    {user.email}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.color}`}
                    >
                      {roleBadge.label}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {formatDateTime(user.last_login)}
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
