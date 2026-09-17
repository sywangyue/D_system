import type { Dict, Locale } from "@/lib/i18n-shared"
import { fill, fmtDateTime, fmtNum } from "@/lib/i18n-shared"
import { CRAWL_STATUS, enumLabel } from "@/lib/enums"

export interface DataStatus {
  total_companies: number;
  total_opportunities: number;
  total_reports: number;
  total_resources: number;
  total_brands: number;
  total_editions: number;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_crawl_status: string | null;
}

/** 一个计数格子。数字统一 .num（等宽）+ fmtNum（走 Intl）。 */
function Metric({ label, value, locale }: { label: string; value?: number; locale: Locale }) {
  return (
    <div>
      <div className="text-xs text-fg-muted mb-1">{label}</div>
      <div className="num text-2xl font-semibold text-fg">{fmtNum(locale, value, "--")}</div>
    </div>
  );
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
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 bg-surface-elevated rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const status = data;
  return (
    <div className="bg-surface border border-hairline rounded-xl p-6">
      <h2 className="text-base font-semibold text-fg mb-4">
        {t.settings.dataStatus}
      </h2>
      {/* 前四项是**新架构的中心实体**（公司），原有品牌/届次/采集三项退到后面。
          顺序不是随便排的：这张卡的读者是判断「系统里到底有什么」的人。 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label={t.settings.totalCompanies} value={status?.total_companies} locale={locale} />
        <Metric label={t.settings.totalOpportunities} value={status?.total_opportunities} locale={locale} />
        <Metric label={t.settings.totalReports} value={status?.total_reports} locale={locale} />
        <Metric label={t.settings.totalResources} value={status?.total_resources} locale={locale} />

        <Metric label={t.settings.brandTotal} value={status?.total_brands} locale={locale} />
        <Metric label={t.settings.editionTotal} value={status?.total_editions} locale={locale} />

        <div>
          <div className="text-xs text-fg-muted mb-1">{t.settings.lastCrawlStatus}</div>
          <div className="text-sm font-medium text-fg">
            {status?.last_crawl_status
              ? enumLabel(CRAWL_STATUS, t.enum.crawlStatus, status.last_crawl_status)
              : t.enum.crawlStatus.none}
          </div>
          {status?.last_crawl_finished_at && (
            <div className="text-xs text-fg-muted mt-0.5">
              {fmtDateTime(locale, status.last_crawl_finished_at)}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-fg-muted mb-1">{t.settings.lastCrawlDuration}</div>
          <div className="text-sm font-medium text-fg">
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
