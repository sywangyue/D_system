"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Label } from "recharts";

interface PieData {
  name: string;
  value: number;
}

interface IndustryPieChartProps {
  data: PieData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  l2ByL1?: Map<string, string[]>;
  selectedL2?: string | null;
  onIndustrySelect?: (l2: string | null) => void;
}

const CHART_COLORS = [
  "#fe5c00",  // MD Orange (主色)
  "#e60070",  // MD Magenta
  "#ff8c00",  // MD Light Orange
  "#FF3400",  // MD Red
  "#9c9c9c",  // MD Grey
  "#ffc500",  // MD Yellow
  "#e55300",  // MD Orange Dark
  "#6B7280",  // grey-500 fallback
];

interface CustomTooltipPayload {
  name: string;
  value: number;
  payload: PieData;
}

function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: CustomTooltipPayload[];
  total: number;
}) {
  if (!active || !payload?.length) return null;

  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-text-primary">{name}</div>
      <div className="text-text-secondary">
        {value.toLocaleString("en-US")} （{pct}%）
      </div>
    </div>
  );
}

function renderLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  name: string;
  percent: number;
}) {
  if (percent < 0.05) return;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#6B7280"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-[11px]"
    >
      {name}
    </text>
  );
}

export default function IndustryPieChart({
  data,
  isLoading = false,
  error = null,
  onRetry,
  l2ByL1,
  selectedL2,
  onIndustrySelect,
}: IndustryPieChartProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (l1: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(l1)) next.delete(l1);
      else next.add(l1);
      return next;
    });
  };

  const dataTotal = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="flex justify-center">
          <div className="w-[200px] h-[200px] rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-border rounded-xl p-5" role="alert">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          行业细分分布
        </h3>
        <div className="flex flex-col items-center justify-center h-[250px] text-center">
          <div className="text-sm text-destructive mb-2">{error}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-accent hover:text-accent-dark underline"
            >
              点击重试
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-white border border-border rounded-xl p-5">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          行业细分分布
        </h3>
        <div className="flex items-center justify-center h-[250px] text-sm text-text-secondary">
          暂无数据
        </div>
      </div>
    );
  }

  // Color lookup: map each L2 name → its pie slice color
  const nameToColor = new Map<string, string>();
  data.forEach((entry, i) => {
    nameToColor.set(entry.name, CHART_COLORS[i % CHART_COLORS.length]);
  });

  return (
    <div className="bg-white border border-border rounded-xl p-5 w-full">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        行业细分分布
      </h3>
      <div className="flex flex-col lg:flex-row lg:gap-6">
        {/* Pie chart */}
        <div className="shrink-0 flex justify-center">
          <PieChart width={400} height={280}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              dataKey="value"
              nameKey="name"
              label={renderLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !data.length) return null;
                  const total = data.reduce((sum, d) => sum + d.value, 0);
                  const { cx = 0, cy = 0 } = viewBox as { cx?: number; cy?: number };
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                      <tspan
                        x={cx}
                        dy="-0.3em"
                        fontSize="26"
                        fontWeight="700"
                        fill="#111827"
                      >
                        {total.toLocaleString("en-US")}
                      </tspan>
                      <tspan
                        x={cx}
                        dy="1.5em"
                        fontSize="12"
                        fontWeight="400"
                        fill="#6B7280"
                      >
                        品牌
                      </tspan>
                    </text>
                  );
                }}
              />
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={dataTotal} />} />
          </PieChart>
        </div>

        {/* Grouped two-level legend */}
        {l2ByL1 && l2ByL1.size > 0 && (
          <div className="flex-1 max-h-[300px] overflow-y-auto border border-border rounded-lg">
            {Array.from(l2ByL1.entries()).map(([l1, l2Items]) => {
              const isCollapsed = collapsedGroups.has(l1);
              return (
                <div key={l1} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => toggleGroup(l1)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 transition-colors sticky top-0"
                  >
                    <svg
                      className={`w-3 h-3 text-text-secondary transition-transform shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span className="text-text-primary">{l1}</span>
                    <span className="text-text-secondary ml-auto">
                      {l2Items.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="py-0.5">
                      {l2Items.map((l2) => {
                        const color = nameToColor.get(l2) || "#D1D5DB";
                        const isSelected = selectedL2 === l2;
                        const count = data.find((d) => d.name === l2)?.value;
                        return (
                          <button
                            key={l2}
                            onClick={() =>
                              onIndustrySelect?.(l2 === selectedL2 ? null : l2)
                            }
                            className={`w-full flex items-center gap-2 px-3 py-1 text-xs transition-colors ${
                              isSelected
                                ? "bg-[#fff3ec] text-[#e55300] font-medium"
                                : "text-text-secondary hover:bg-gray-50"
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="flex-1 text-left truncate">{l2}</span>
                            {count != null && (
                              <span className="tabular-nums text-text-secondary">
                                {count.toLocaleString("en-US")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
