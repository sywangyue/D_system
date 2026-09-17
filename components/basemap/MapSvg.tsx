"use client"

import { useEffect, useMemo, useState } from "react"
import { geoNaturalEarth1, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import { fmtNum, type Locale } from "@/lib/i18n-shared"

/**
 * 地图本体（不含标题、边框、筛选条）。
 *
 * 抽出来的原因：**落地页要复用它**（V2-14 §4.4 第 1 块「复用 H 的地图组件，关掉交互」）。
 * 照着重画一份的话，两处的投影、半径标度、点位口径早晚会不一致。
 *
 * `onPick` 不传 = 只读（落地页）；传了 = 可点选（/expo）。
 */

export const MAP_W = 760
export const MAP_H = 400

type Topo = { objects: { countries: unknown } }

export interface MapPoint {
  name: string
  lon: number
  lat: number
  count: number
}

export default function MapSvg({
  points, locale, active = null, onPick,
}: {
  points: MapPoint[]
  locale: Locale
  active?: string | null
  onPick?: (name: string) => void
}) {
  const [topo, setTopo] = useState<Topo | null>(null)

  // 107KB 的地形只在客户端取，不进 JS 包（§6.4）
  useEffect(() => {
    let cancelled = false
    fetch("/countries-110m.json")
      .then(r => r.json())
      .then(json => { if (!cancelled) setTopo(json as Topo) })
      .catch(() => { /* 底图取不到就只剩点位，不阻断页面 */ })
    return () => { cancelled = true }
  }, [])

  const { landPath, project } = useMemo(() => {
    if (!topo) return { landPath: null as string | null, project: null as null | ((p: [number, number]) => [number, number]) }
    // topojson-client 的入参类型很宽（GeoJSON 联合），这里按它自己的契约调用
    const land = feature(topo as never, topo.objects.countries as never)
    // 等距矩形在高低纬变形太大，用 Natural Earth（§4.1）
    const projection = geoNaturalEarth1().fitSize([MAP_W, MAP_H], land as never)
    const path = geoPath(projection)
    return {
      landPath: path(land as never) ?? "",
      project: (p: [number, number]) => projection(p) as [number, number],
    }
  }, [topo])

  const max = points.reduce((m, p) => Math.max(m, p.count), 1)
  // 圆半径 ~ sqrt(品牌数)，上限固定，保证最大点也放得下
  const radius = (c: number) => 2.5 + Math.sqrt(c / max) * 20

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block w-full h-auto">
      {/* 海面与陆地都用令牌，不写死色值（§6.5） */}
      <rect width={MAP_W} height={MAP_H} fill="var(--color-surface)" />
      {landPath && (
        <path d={landPath} fill="var(--color-surface-elevated)"
              stroke="var(--color-hairline-active)" strokeWidth={0.4} />
      )}
      {project && points.map(p => {
        const [x, y] = project([p.lon, p.lat])
        const isActive = active === p.name
        return (
          <circle key={p.name} cx={x} cy={y} r={radius(p.count)}
                  fill={isActive ? "var(--color-fg)" : "none"}
                  stroke="var(--color-fg)" strokeWidth={isActive ? 1.8 : 1}
                  className={onPick ? "cursor-pointer" : undefined}
                  // ⚠️ 必须显式放开 pointer-events：空心圆是 fill="none"，
                  //    而 SVG 里 none 的区域不参与命中测试 —— 只有那 1px 描边能点中，
                  //    圆心会穿透到底图（浏览器实测：点击被 <path> 吃掉）。
                  style={onPick ? { pointerEvents: "all" } : undefined}
                  onClick={onPick ? () => onPick(isActive ? "" : p.name) : undefined}>
            {/* 悬停显示地名 + 品牌数 */}
            <title>{`${p.name} · ${fmtNum(locale, p.count)}`}</title>
          </circle>
        )
      })}
    </svg>
  )
}
