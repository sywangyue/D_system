export interface SystemInfo {
  node_version: string;
  next_version: string;
  build_time: string;
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

export default function SystemInfoBlock({
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
          <span className="text-text-secondary">构建时间：</span>
          <span className="text-text-primary">
            {formatDateTime(sys?.build_time ?? null)}
          </span>
        </div>
      </div>
    </div>
  );
}
