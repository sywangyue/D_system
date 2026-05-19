export interface DataStatus {
  total_brands: number;
  total_editions: number;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_crawl_status: string | null;
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
    case "success":  return "成功";
    case "running":  return "运行中";
    case "failed":   return "失败";
    case "partial":  return "部分成功";
    default:         return "无记录";
  }
}

export default function DataStatusCard({
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
