"use client";

import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface PieData {
  name: string;
  value: number;
}

interface IndustryPieChartProps {
  data: PieData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const CHART_COLORS = [
  "#22C55E", // green-500
  "#3B82F6", // blue-500
  "#F59E0B", // amber-500
  "#8B5CF6", // violet-500
  "#EF4444", // red-500
  "#06B6D4", // cyan-500
  "#F97316", // orange-500
  "#6B7280", // gray-500 catch-all
];

interface CustomTooltipPayload {
  name: string;
  value: number;
  payload: PieData;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;

  const { name, value } = payload[0];
  const total = payload[0].payload.value;
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
}: IndustryPieChartProps) {
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

  return (
    <div className="bg-white border border-border rounded-xl p-5 w-full">
      <h3 className="text-base font-semibold text-text-primary mb-4">
        行业细分分布
      </h3>
      <PieChart width={400} height={280} className="mx-auto">
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
          {data.map((entry, index) => (
            <Cell
              key={`cell-${entry.name}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="horizontal"
          align="center"
          verticalAlign="bottom"
          formatter={(_value: string, entry: { payload?: { value?: number } }) =>
            entry.payload?.value != null
              ? `${_value} (${entry.payload.value.toLocaleString("en-US")})`
              : _value
          }
          wrapperStyle={{ fontSize: "12px" }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </div>
  );
}
