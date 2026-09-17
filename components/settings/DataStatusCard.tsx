import type { Dict, Locale } from "@/lib/i18n-shared"
import { fill, fmtDateTime, fmtNum } from "@/lib/i18n-shared"
import { CRAWL_STATUS, enumLabel } from "@/lib/enums"

export interface DataStatus {
  total_brands: number;
  total_editions: number;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_crawl_status: string | null;
}

export default function DataStatusCard({
  data,
  isLoading,
  t,
  locale,
}: {
  data?: DataStatus;
  isLoading?: boolean;
  t: Dict;
  locale: Locale;
}) {
  if (isLoading) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-6 space-y-3 animate-pulse">
        <div className="h-5 w-24 bg-surface-elevated rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-elevated rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const status = data;
  return (
    <div className="bg-surface border border-hairline rounded-xl p-6">
      <h2 className="text-base font-semibold text-text-primary mb-4">
        {t.settings.dataStatus}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-text-secondary mb-1">{t.settings.brandTotal}</div>
          <div className="text-2xl font-semibold text-text-primary">
            {fmtNum(locale, status?.total_brands, "--")}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">{t.settings.editionTotal}</div>
          <div className="text-2xl font-semibold text-text-primary">
            {fmtNum(locale, status?.total_editions, "--")}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">{t.settings.lastCrawlStatus}</div>
          <div className="text-sm font-medium text-text-primary">
            {status?.last_crawl_status
              ? enumLabel(CRAWL_STATUS, t.enum.crawlStatus, status.last_crawl_status)
              : t.enum.crawlStatus.none}
          </div>
          {status?.last_crawl_finished_at && (
            <div className="text-xs text-text-secondary mt-0.5">
              {fmtDateTime(locale, status.last_crawl_finished_at)}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-1">{t.settings.lastCrawlDuration}</div>
          <div className="text-sm font-medium text-text-primary">
            {status?.last_crawl_started_at && status?.last_crawl_finished_at
              ? (() => {
                  const start = new Date(status.last_crawl_started_at).getTime();
                  const end = new Date(status.last_crawl_finished_at).getTime();
                  const min = Math.round((end - start) / 60000);
                  // 单位不手拼：中文「分钟」/英文「min」的语序与写法都在字典里
                  return min < 1
                    ? t.settings.underMinute
                    : fill(t.settings.minutes, { n: fmtNum(locale, min) });
                })()
              : "--"}
          </div>
        </div>
      </div>
    </div>
  );
}
