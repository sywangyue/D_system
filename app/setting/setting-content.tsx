"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserInfo } from "@/lib/auth";
import DataStatusCard, { type DataStatus } from "@/components/settings/DataStatusCard";
import UsersTable, { UsersTableSkeleton, type UserEntry } from "@/components/settings/UsersTable";
import SystemInfoBlock, { type SystemInfo } from "@/components/settings/SystemInfoBlock";

interface StatusResponse {
  data_status: DataStatus;
  system_info: SystemInfo;
}

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

export default function SettingContent() {
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
    const info = getUserInfo();
    if (!info || info.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    setRoleChecked(true);
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
      .then(([userData, statusData]: [{ users: UserEntry[] }, StatusResponse]) => {
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

  // ─── Loading ──────────────────────────────────────────────────────
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
        setUserError("重试失败");
        setStatusError("重试失败");
        setIsLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-text-primary">设置</h1>

      {statusError && !dataStatus ? (
        <ErrorCard message={statusError} onRetry={retry} />
      ) : (
        <DataStatusCard data={dataStatus ?? undefined} />
      )}

      {userError && users.length === 0 ? (
        <ErrorCard message={userError} onRetry={retry} />
      ) : (
        <UsersTable users={users} />
      )}

      <SystemInfoBlock info={systemInfo ?? undefined} />
    </div>
  );
}
