"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataStatusCard, { type DataStatus } from "@/components/settings/DataStatusCard";
import UsersTable, { UsersTableSkeleton, type UserEntry } from "@/components/settings/UsersTable";
import SystemInfoBlock, { type SystemInfo } from "@/components/settings/SystemInfoBlock";
import type { Dict, Locale } from "@/lib/i18n-shared";
import { errorText } from "@/lib/i18n-shared"

interface StatusResponse {
  data_status: DataStatus;
  system_info: SystemInfo;
}

/**
 * 两个请求各自失败要分开呈现，所以错误对象带一个稳定的标记 ——
 * 原先靠 `e.message.includes("用户")` 派发，接 i18n 后英文文案里没有「用户」二字，
 * 派发会静默失效。标记与文案分开：标记派发、文案只负责显示。
 */
class LoadError extends Error {
  constructor(readonly which: "users" | "status", message: string) {
    super(message);
  }
}

function ErrorCard({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-12 bg-surface border border-hairline rounded-xl text-center"
    >
      <div className="text-sm text-destructive mb-3">{message}</div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-accent text-[var(--color-accent-fg)] text-sm hover:bg-accent-hover transition-colors"
      >
        {retryLabel}
      </button>
    </div>
  );
}

export default function SettingContent({ t, locale }: { t: Dict; locale: Locale }) {
  const router = useRouter();

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
    // 角色校验由中间件负责（proxy.ts 里 /setting 非 admin 直接重定向），
    // 此处不再重复判断，避免与 cookie 登录态形成第二个真源。
    setRoleChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roleChecked) return;
    Promise.all([
      fetch("/api/users").then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new LoadError("users", errorText(t, body.error, body.values, t.settings.loadUsersFailed));
        }
        return r.json();
      }),
      fetch("/api/setting/status").then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new LoadError("status", errorText(t, body.error, body.values, t.settings.loadSystemFailed));
        }
        return r.json();
      }),
    ])
      .then(([userData, statusData]: [{ users: UserEntry[] }, StatusResponse]) => {
        setUsers(userData.users || []);
        setDataStatus(statusData.data_status);
        setSystemInfo(statusData.system_info);
        setIsLoading(false);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : t.settings.networkError;
        if (e instanceof LoadError && e.which === "users") setUserError(msg);
        else if (e instanceof LoadError && e.which === "status") setStatusError(msg);
        else setUserError(msg);
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

  // ─── Loading ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-fg">{t.settings.title}</h1>
        <DataStatusCard isLoading t={t} locale={locale} />
        <UsersTableSkeleton />
        <SystemInfoBlock isLoading t={t} locale={locale} />
      </div>
    );
  }

  // ─── Partial errors with fallback ─────────────────────────────────
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
      .then(([userData, statusData]: [{ users: UserEntry[] }, StatusResponse]) => {
        setUsers(userData.users || []);
        setDataStatus(statusData.data_status);
        setSystemInfo(statusData.system_info);
        setUserError(null);
        setStatusError(null);
        setIsLoading(false);
      })
      .catch(() => {
        setUserError(t.settings.retryFailed);
        setStatusError(t.settings.retryFailed);
        setIsLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.settings.title}</h1>

      {statusError && !dataStatus ? (
        <ErrorCard message={statusError} retryLabel={t.settings.clickRetry} onRetry={retry} />
      ) : (
        <DataStatusCard data={dataStatus ?? undefined} t={t} locale={locale} />
      )}

      {userError && users.length === 0 ? (
        <ErrorCard message={userError} retryLabel={t.settings.clickRetry} onRetry={retry} />
      ) : (
        <UsersTable users={users} t={t} locale={locale} />
      )}

      <SystemInfoBlock info={systemInfo ?? undefined} t={t} locale={locale} />
    </div>
  );
}
