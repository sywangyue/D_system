"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserEntry {
  id: string;
  email: string;
  role: string;
  last_sign_in_at: string | null;
  created_at: string;
  confirmed_at: string | null;
}

interface DataStatus {
  total_brands: number;
  total_editions: number;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_crawl_status: string | null;
}

interface SystemInfo {
  node_version: string;
  next_version: string;
  supabase_project_ref: string;
  build_time: string;
}

interface StatusResponse {
  data_status: DataStatus;
  system_info: SystemInfo;
}

function getUserStatus(user: UserEntry): { label: string; color: string } {
  if (!user.confirmed_at) return { label: "未验证", color: "bg-amber-100 text-amber-800" };
  if (user.last_sign_in_at) {
    const lastLogin = new Date(user.last_sign_in_at).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (lastLogin > thirtyDaysAgo) return { label: "活跃", color: "bg-green-100 text-green-800" };
  }
  return { label: "未活跃", color: "bg-gray-100 text-gray-600" };
}

function getRoleBadge(role: string): { label: string; color: string } {
  switch (role) {
    case "admin":
      return { label: "管理员", color: "bg-red-100 text-red-700" };
    case "manager":
      return { label: "经理", color: "bg-blue-100 text-blue-700" };
    default:
      return { label: "只读", color: "bg-gray-100 text-gray-600" };
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

function crawlStatusLabel(status: string | null): string {
  switch (status) {
    case "success":
      return "成功";
    case "running":
      return "运行中";
    case "failed":
      return "失败";
    case "partial":
      return "部分成功";
    default:
      return "无记录";
  }
}

export default function SettingContent() {
  const router = useRouter();
  const supabase = createClient();

  // Auth + RBAC state
  const [roleChecked, setRoleChecked] = useState(false);

  // Data state
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role =
        (data.user?.app_metadata as Record<string, unknown>)?.role as string || "readonly";
      if (role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      setRoleChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roleChecked) return;
    Promise.all([
      fetch("/api/users").then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "无法加载用户数据");
        }
        return r.json();
      }),
      fetch("/api/setting/status").then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "无法加载系统状态");
        }
        return r.json();
      }),
    ])
      .then(([userData, statusData]) => {
        setUsers(userData.users || []);
        setDataStatus(statusData.data_status);
        setSystemInfo(statusData.system_info);
        setIsLoading(false);
      })
      .catch((e) => {
        if (e instanceof Error) {
          if (e.message.includes("用户")) setUserError(e.message);
          if (e.message.includes("系统")) setStatusError(e.message);
        }
        if (!userError && !statusError) {
          setUserError(e instanceof Error ? e.message : "网络异常");
        }
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleChecked]);

  // ─── Auth check pending ────────────────────────────────────────────
  if (!roleChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Loading —───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-text-primary">设置</h1>
        <DataStatusCard isLoading />
        <UsersTableSkeleton />
        <SystemInfoBlock isLoading />
      </div>
    );
  }

  // ─── Partial errors with fallback —─────────────────────────────────
  const retry = () => {
    setIsLoading(true);
    setUserError(null);
    setStatusError(null);
    Promise.all([
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error()))),
      fetch("/api/setting/status")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error()))),
    ])
      .then(([userData, statusData]) => {
        setUsers(userData.users || []);
        setDataStatus(statusData.data_status);
        setSystemInfo(statusData.system_info);
        setUserError(null);
        setStatusError(null);
        setIsLoading(false);
      })
      .catch(() => {
        setUserError("重试失败");
        setStatusError("重试失败");
        setIsLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">设置</h1>

      {/* Data status panel */}
      {statusError && !dataStatus ? (
        <ErrorCard message={statusError} onRetry={retry} />
      ) : (
        <DataStatusCard data={dataStatus ?? undefined} />
      )}

      {/* Users table */}
      {userError && users.length === 0 ? (
        <ErrorCard message={userError} onRetry={retry} />
      ) : (
        <UsersTable users={users} />
      )}

      {/* System info */}
      <SystemInfoBlock info={systemInfo ?? undefined} />
    </div>
  );
}

// ─── Data Status Card ──────────────────────────────────────────────────

function DataStatusCard({
  data,
  isLoading,
}: {
  data?: DataStatus;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl p-6 space-y-3 animate-pulse">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const status = data;
  return (
    <div className="bg-white border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-text-primary mb-4">
        数据状态
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-text-secondary mb-1">品牌总数</div>
          <div className="text-2xl font-semibold text-text-primary">
            {status?.total_brands?.toLocaleString("en-US") ?? "--"}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">展会届次</div>
          <div className="text-2xl font-semibold text-text-primary">
            {status?.total_editions?.toLocaleString("en-US") ?? "--"}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">最近采集状态</div>
          <div className="text-sm font-medium text-text-primary">
            {crawlStatusLabel(status?.last_crawl_status ?? null)}
          </div>
          {status?.last_crawl_finished_at && (
            <div className="text-xs text-text-secondary mt-0.5">
              {formatDateTime(status.last_crawl_finished_at)}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">最近采集耗时</div>
          <div className="text-sm font-medium text-text-primary">
            {status?.last_crawl_started_at && status?.last_crawl_finished_at
              ? (() => {
                  const start = new Date(status.last_crawl_started_at).getTime();
                  const end = new Date(status.last_crawl_finished_at).getTime();
                  const min = Math.round((end - start) / 60000);
                  return min < 1 ? "< 1 分钟" : `${min} 分钟`;
                })()
              : "--"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Users Table ────────────────────────────────────────────────────────

function UsersTable({ users }: { users: UserEntry[] }) {
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
                  key={user.id}
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
                    {formatDateTime(user.last_sign_in_at)}
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

function UsersTableSkeleton() {
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

// ─── System Info Block ──────────────────────────────────────────────────

function SystemInfoBlock({
  info,
  isLoading,
}: {
  info?: SystemInfo;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl p-6 animate-pulse space-y-3">
        <div className="h-5 w-20 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-100 rounded" />
        <div className="h-4 w-48 bg-gray-100 rounded" />
        <div className="h-4 w-56 bg-gray-100 rounded" />
      </div>
    );
  }

  const sys = info;
  return (
    <div className="bg-white border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-text-primary mb-3">
        系统信息
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-text-secondary">Node.js：</span>
          <span className="text-text-primary font-mono">{sys?.node_version ?? "--"}</span>
        </div>
        <div>
          <span className="text-text-secondary">Next.js：</span>
          <span className="text-text-primary font-mono">{sys?.next_version ?? "--"}</span>
        </div>
        <div>
          <span className="text-text-secondary">Supabase 项目：</span>
          <span className="text-text-primary font-mono">
            {sys?.supabase_project_ref ?? "--"}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">构建时间：</span>
          <span className="text-text-primary">
            {formatDateTime(sys?.build_time ?? null)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Error Card ──────────────────────────────────────────────────────────

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-12 bg-white border border-border rounded-xl text-center"
    >
      <div className="text-sm text-destructive mb-3">{message}</div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark transition-colors"
      >
        点击重试
      </button>
    </div>
  );
}
