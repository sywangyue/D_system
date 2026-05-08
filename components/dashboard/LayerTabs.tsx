"use client"

import { Layers, BarChart3, MapPin, Table2 } from "lucide-react"

export type LayerId = "overview" | "analysis" | "geo" | "detail"

const LAYERS: { id: LayerId; label: string; icon: typeof Layers }[] = [
  { id: "overview", label: "概览", icon: Layers },
  { id: "analysis", label: "分析", icon: BarChart3 },
  { id: "geo", label: "地理", icon: MapPin },
  { id: "detail", label: "明细", icon: Table2 },
]

interface LayerTabsProps {
  activeLayer: LayerId
  onChange: (layer: LayerId) => void
}

export default function LayerTabs({ activeLayer, onChange }: LayerTabsProps) {
  return (
    <div className="flex gap-1 bg-surface rounded-lg p-1">
      {LAYERS.map((layer) => {
        const isActive = activeLayer === layer.id
        const Icon = layer.icon
        return (
          <button
            key={layer.id}
            onClick={() => onChange(layer.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150
              ${isActive
                ? "bg-white text-accent shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-white/50"
              }`}
          >
            <Icon size={16} />
            {layer.label}
          </button>
        )
      })}
    </div>
  )
}
