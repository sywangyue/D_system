import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface TrendBadgeProps {
  trend?: "上升" | "平稳" | "下降" | null;
}

const TREND_CONFIG = {
  "上升": {
    icon: ArrowUp,
    text: "↑ 上升",
    className: "text-green-600 bg-accent-surface",
  },
  "平稳": {
    icon: Minus,
    text: "→ 平稳",
    className: "text-gray-500 bg-gray-100",
  },
  "下降": {
    icon: ArrowDown,
    text: "↓ 下降",
    className: "text-red-600 bg-red-100",
  },
} as const;

export default function TrendBadge({ trend }: TrendBadgeProps) {
  if (!trend) return null;

  const config = TREND_CONFIG[trend];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal ${config.className}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.text}
    </span>
  );
}
