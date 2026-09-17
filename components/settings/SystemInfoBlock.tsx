import type { Dict, Locale } from "@/lib/i18n-shared"
import { fmtDateTime } from "@/lib/i18n-shared"

export interface SystemInfo {
  node_version: string;
  build_time: string;
}

export default function SystemInfoBlock({
  info,
  isLoading,
  t,
  locale,
}: {
  info?: SystemInfo;
  isLoading?: boolean;
  t: Dict;
  locale: Locale;
}) {
  if (isLoading) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-6 animate-pulse space-y-3">
        <div className="h-5 w-20 bg-surface-elevated rounded" />
        <div className="h-4 w-64 bg-surface-elevated rounded" />
        <div className="h-4 w-48 bg-surface-elevated rounded" />
        <div className="h-4 w-56 bg-surface-elevated rounded" />
      </div>
    );
  }

  const sys = info;
  return (
    <div className="bg-surface border border-hairline rounded-xl p-6">
      <h2 className="text-base font-semibold text-fg mb-3">
        {t.settings.systemInfo}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-fg-muted">{t.settings.nodeVersion}</span>
          <span className="text-fg font-mono">{sys?.node_version ?? "--"}</span>
        </div>
        <div>
          <span className="text-fg-muted">{t.settings.buildTime}</span>
          <span className="text-fg">
            {fmtDateTime(locale, sys?.build_time, "--")}
          </span>
        </div>
      </div>
    </div>
  );
}
