"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface TrendChartProps {
  data: { year: number; area_sqm: number }[]
  isLoading: boolean
}

function formatArea(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万㎡`
  return `${value.toLocaleString("en-US")} ㎡`
}

export default function TrendChart({ data, isLoading }: TrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h3 className="text-base font-semibold text-text-primary mb-4">年比趋势</h3>
        <div className="h-[300px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h3 className="text-base font-semibold text-text-primary mb-4">年比趋势</h3>
        <div className="flex items-center justify-center h-[300px] text-sm text-text-secondary">
          暂无趋势数据
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
      <h3 className="text-base font-semibold text-text-primary mb-4">年比趋势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6B7280" }} />
          <YAxis
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickFormatter={(v: number) => formatArea(v)}
          />
          <Tooltip
            formatter={(value: number) => [formatArea(value), "展览面积"]}
            labelFormatter={(label: number) => `${label} 年`}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
          <Bar dataKey="area_sqm" fill="#fe5c00" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
