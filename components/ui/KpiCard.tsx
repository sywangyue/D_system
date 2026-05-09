import TrendBadge from "./TrendBadge";

interface KpiCardProps {
  label: string;
  value: number | null;
  unit?: string;
  trend?: "上升" | "平稳" | "下降" | null;
  variant?: "highlight" | "standard";
  isLoading?: boolean;
  error?: string | null;
  icon?: React.ReactNode;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function KpiCard({
  label,
  value,
  unit,
  trend,
  variant = "standard",
  isLoading = false,
  error = null,
  icon,
}: KpiCardProps) {
  const isHighlight = variant === "highlight";

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`flex-1 min-w-[160px] rounded-xl p-5 ${
          isHighlight
            ? "bg-accent-surface"
            : "bg-white border border-border shadow-sm"
        }`}
        aria-busy="true"
      >
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="flex justify-center mb-2">
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-10 w-24 bg-gray-200 rounded animate-pulse mb-1" />
        <div className="h-5 w-14 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`flex-1 min-w-[160px] rounded-xl p-5 ${
          isHighlight
            ? "bg-accent-surface"
            : "bg-white border border-border shadow-sm"
        }`}
        role="alert"
      >
        <div className="text-xs font-normal text-text-secondary uppercase tracking-wide">
          {label}
        </div>
        <div className="text-sm text-destructive mt-1">{error}</div>
      </div>
    );
  }

  // Empty / no data
  if (value === null || value === undefined) {
    return (
      <div
        className={`flex-1 min-w-[160px] rounded-xl p-5 ${
          isHighlight
            ? "bg-accent-surface"
            : "bg-white border border-border shadow-sm"
        }`}
      >
        <div className="text-xs font-normal text-text-secondary uppercase tracking-wide">
          {label}
        </div>
        <div className="text-2xl font-semibold text-gray-300 mt-1">--</div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 min-w-[160px] rounded-xl p-5 transition-[box-shadow,transform] duration-150 ease
        ${
          isHighlight
            ? "bg-accent-surface hover:shadow-[0_4px_12px_rgba(254,92,0,0.12)]"
            : "bg-white border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]"
        }
        hover:-translate-y-px
      `}
    >
      {icon && (
        <div className={`w-8 h-8 mb-2 ${isHighlight ? "text-accent-dark" : "text-accent"}`}>
          {icon}
        </div>
      )}
      <div
        className={`text-xs font-normal uppercase tracking-wide ${
          isHighlight ? "text-accent-dark" : "text-text-secondary"
        }`}
      >
        {label}
      </div>
      <div className="flex items-baseline mt-0.5">
        <span className="kpi-value text-text-primary">
          {formatNumber(value)}
        </span>
        {unit && (
          <span className="text-sm font-normal text-gray-600 ml-1 self-end pb-1">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-1">
        <TrendBadge trend={trend} />
      </div>
    </div>
  );
}
