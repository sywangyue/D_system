"use client"

export interface SubTab {
  id: string
  label: string
}

interface SubTabsProps {
  tabs: SubTab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export default function SubTabs({ tabs, activeTab, onChange }: SubTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 rounded-full text-sm transition-all duration-100
            ${activeTab === tab.id
              ? "bg-accent-surface text-accent-dark font-semibold border border-accent/30"
              : "bg-white text-text-secondary hover:bg-surface border border-border"
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export const OVERVIEW_SUBTABS: SubTab[] = [
  { id: "summary", label: "总览" },
  { id: "trend", label: "趋势" },
  { id: "organizer", label: "集团" },
  { id: "snapshot", label: "快照" },
]

export const ANALYSIS_SUBTABS: SubTab[] = [
  { id: "industry", label: "行业分布" },
  { id: "relation", label: "竞争关系" },
  { id: "mds", label: "MDS 相关" },
  { id: "heat", label: "热力矩阵" },
  { id: "tags", label: "标签摘要" },
]

export const GEO_SUBTABS: SubTab[] = [
  { id: "cities", label: "城市分布" },
  { id: "venues", label: "场馆列表" },
  { id: "compare", label: "国内外对比" },
  { id: "city-rank", label: "城市排名" },
  { id: "venue-rank", label: "场馆排名" },
]

export const DETAIL_SUBTABS: SubTab[] = [
  { id: "brands", label: "品牌列表" },
  { id: "editions", label: "届次列表" },
  { id: "search", label: "搜索" },
  { id: "export", label: "导出" },
]
