"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import FilterTabs from "@/components/ui/FilterTabs";
import LayerTabs, { type LayerId } from "@/components/dashboard/LayerTabs";
import SubTabs, {
  OVERVIEW_SUBTABS,
  ANALYSIS_SUBTABS,
  GEO_SUBTABS,
  DETAIL_SUBTABS,
  type SubTab,
} from "@/components/dashboard/SubTabs";
import KpiCardRow from "@/components/dashboard/KpiCardRow";
import TrendChart from "@/components/dashboard/TrendChart";
import BrandTable from "@/components/dashboard/BrandTable";
import IndustryPieChart from "@/components/charts/IndustryPieChart";
import type { DashboardResponse, Brand } from "@/lib/types";
import type { CityMarker } from "@/app/map/map-view";

const MapView = dynamic(() => import("@/app/map/map-view"), { ssr: false });

const COMPETITION_RELATION_OPTIONS = ["竞争对手", "潜在伙伴", "新进入者"];
const MDS_RELATED_OPTIONS = ["MFC", "Reha China", "无"];

function deriveIndustryOptions(brands: Brand[]) {
  const l1Set = new Set<string>();
  const l2ByL1 = new Map<string, Set<string>>();
  const allL2Set = new Set<string>();

  for (const b of brands) {
    if (b.industry_l1) {
      l1Set.add(b.industry_l1);
      if (!l2ByL1.has(b.industry_l1)) l2ByL1.set(b.industry_l1, new Set());
      if (b.industry_l2) {
        l2ByL1.get(b.industry_l1)!.add(b.industry_l2);
        allL2Set.add(b.industry_l2);
      }
    }
  }

  return {
    l1: Array.from(l1Set).sort(),
    l2ByL1: new Map([...l2ByL1].map(([k, v]) => [k, Array.from(v).sort()])),
    allL2: Array.from(allL2Set).sort(),
  };
}

function getDefaultSub(layer: LayerId): string {
  switch (layer) {
    case "overview": return OVERVIEW_SUBTABS[0].id;
    case "analysis": return ANALYSIS_SUBTABS[0].id;
    case "geo": return GEO_SUBTABS[0].id;
    case "detail": return DETAIL_SUBTABS[0].id;
  }
}

function getSubtabs(layer: LayerId): SubTab[] {
  switch (layer) {
    case "overview": return OVERVIEW_SUBTABS;
    case "analysis": return ANALYSIS_SUBTABS;
    case "geo": return GEO_SUBTABS;
    case "detail": return DETAIL_SUBTABS;
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-text-secondary">
      {message}
    </div>
  )
}

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mountedRef = useRef(false);

  // Layer + SubTab state
  const [activeLayer, setActiveLayer] = useState<LayerId>("overview");
  const [activeSub, setActiveSub] = useState<string>(() => getDefaultSub("overview"));

  // Filter state
  const [selectedL2, setSelectedL2] = useState<string | null>(
    () => searchParams.get("industry_l2")
  );
  const [selectedRelations, setSelectedRelations] = useState<string[]>(
    () =>
      searchParams.get("competition_relation")?.split(",").filter(Boolean) || []
  );
  const [selectedMds, setSelectedMds] = useState<string | null>(
    () => searchParams.get("mds_related")
  );
  const [selectedL1, setSelectedL1] = useState<string | null>(null);

  // Data state
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map markers (lazy-fetched when geo layer is active)
  const [mapMarkers, setMapMarkers] = useState<CityMarker[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  // Filter options
  const [l1Options, setL1Options] = useState<string[]>([]);
  const [l2ByL1, setL2ByL1] = useState<Map<string, string[]>>(new Map());
  const [allL2Options, setAllL2Options] = useState<string[]>([]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedL2) params.set("industry_l2", selectedL2);
    if (selectedRelations.length > 0)
      params.set("competition_relation", selectedRelations.join(","));
    if (selectedMds) params.set("mds_related", selectedMds);
    return params.toString();
  }, [selectedL2, selectedRelations, selectedMds]);

  const fetchData = useCallback(async (qs: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "无法加载数据");
      }
      const json: DashboardResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch map markers when geo layer becomes active
  useEffect(() => {
    if (activeLayer !== "geo" || mapMarkers.length > 0) return;
    setMapLoading(true);
    fetch("/api/map/markers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((json) => setMapMarkers(json.markers || []))
      .catch(() => {})
      .finally(() => setMapLoading(false));
  }, [activeLayer, mapMarkers.length]);

  // Initial mount
  useEffect(() => {
    async function init() {
      try {
        const allRes = await fetch("/api/dashboard");
        if (allRes.ok) {
          const allData: DashboardResponse = await allRes.json();
          const options = deriveIndustryOptions(allData.brands);
          setL1Options(options.l1);
          setL2ByL1(options.l2ByL1);
          setAllL2Options(options.allL2);

          const qs = buildQueryString();
          if (!qs) {
            setData(allData);
            setIsLoading(false);
            mountedRef.current = true;
            return;
          }
        }
      } catch { /* silent */ }

      await fetchData(buildQueryString());
      mountedRef.current = true;
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter change → sync URL + refetch
  useEffect(() => {
    if (!mountedRef.current) return;
    const raw = buildQueryString();
    const nextUrl = `/dashboard${raw ? `?${raw}` : ""}`;
    router.replace(nextUrl, { scroll: false });
    fetchData(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedL2, selectedRelations, selectedMds]);

  // Layer change → reset sub tab
  const handleLayerChange = (layer: LayerId) => {
    setActiveLayer(layer);
    setActiveSub(getDefaultSub(layer));
  };

  const l2Options = selectedL1
    ? l2ByL1.get(selectedL1) || []
    : allL2Options;

  // ─── Render: Initial loading ──────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <FilterTabs
          industryL1Options={[]}
          selectedL1={null}
          onL1Change={() => {}}
          industryL2Options={[]}
          selectedL2={null}
          onL2Change={() => {}}
          competitionRelationOptions={COMPETITION_RELATION_OPTIONS}
          selectedRelations={[]}
          onRelationsChange={() => {}}
          mdsRelatedOptions={MDS_RELATED_OPTIONS}
          selectedMds={null}
          onMdsChange={() => {}}
          isLoading
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCardRow data={null} isLoading />
        </div>
        <IndustryPieChart data={[]} isLoading />
      </div>
    );
  }

  // ─── Render: Error ────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-sm text-destructive mb-3">{error}</div>
        <button
          onClick={() => fetchData(buildQueryString())}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark transition-colors"
        >
          点击重试
        </button>
      </div>
    );
  }

  // ─── Render: Empty ────────────────────────────────────────────────
  if (data && data.brands.length === 0) {
    return (
      <div className="space-y-6">
        <FilterTabs
          industryL1Options={l1Options}
          selectedL1={selectedL1}
          onL1Change={setSelectedL1}
          industryL2Options={l2Options}
          selectedL2={selectedL2}
          onL2Change={setSelectedL2}
          competitionRelationOptions={COMPETITION_RELATION_OPTIONS}
          selectedRelations={selectedRelations}
          onRelationsChange={setSelectedRelations}
          mdsRelatedOptions={MDS_RELATED_OPTIONS}
          selectedMds={selectedMds}
          onMdsChange={setSelectedMds}
          isLoading={isLoading}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-sm text-text-secondary mb-2">
            没有匹配的展会数据
          </div>
          <button
            onClick={() => {
              setSelectedL1(null);
              setSelectedL2(null);
              setSelectedRelations([]);
              setSelectedMds(null);
            }}
            className="text-xs text-accent hover:text-accent-dark underline"
          >
            清除筛选条件
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Populated ────────────────────────────────────────────
  const subtabs = getSubtabs(activeLayer);

  const renderContent = () => {
    switch (activeLayer) {
      // ── 概览层 ────────────────────────────────────────────────
      case "overview":
        switch (activeSub) {
          case "summary":
            return (
              <>
                <KpiCardRow data={data?.kpis ?? null} isLoading={isLoading} />
                <IndustryPieChart
                  data={data?.industryDistribution ?? []}
                  isLoading={isLoading}
                  error={error}
                  onRetry={() => fetchData(buildQueryString())}
                />
              </>
            )
          case "trend":
            return (
              <TrendChart
                data={data?.yearTrend ?? []}
                isLoading={isLoading}
              />
            )
          case "organizer":
            return <EmptyState message="集团分析功能开发中" />
          case "snapshot":
            return <EmptyState message="快照功能开发中" />
          default:
            return null
        }

      // ── 分析层 ────────────────────────────────────────────────
      case "analysis":
        switch (activeSub) {
          case "industry":
            return (
              <IndustryPieChart
                data={data?.industryDistribution ?? []}
                isLoading={isLoading}
                error={error}
                onRetry={() => fetchData(buildQueryString())}
              />
            )
          case "relation":
            return <EmptyState message="竞争关系分析开发中" />
          case "mds":
            return <EmptyState message="MDS 相关分析开发中" />
          case "heat":
            return <EmptyState message="热力矩阵开发中" />
          case "tags":
            return <EmptyState message="标签摘要开发中" />
          default:
            return null
        }

      // ── 地理层 ────────────────────────────────────────────────
      case "geo":
        switch (activeSub) {
          case "cities":
            if (mapLoading) {
              return (
                <div className="bg-white border border-border rounded-xl p-4">
                  <div className="h-[500px] bg-gray-100 animate-pulse rounded-lg" />
                </div>
              )
            }
            if (mapMarkers.length === 0) {
              return <EmptyState message="暂无地理数据" />
            }
            return (
              <div className="bg-white border border-border rounded-xl p-4">
                <div style={{ height: 500 }}>
                  <MapView markers={mapMarkers} />
                </div>
              </div>
            )
          case "venues":
            return <EmptyState message="场馆列表开发中" />
          case "compare":
            return <EmptyState message="国内外对比开发中" />
          case "city-rank":
            return <EmptyState message="城市排名开发中" />
          case "venue-rank":
            return <EmptyState message="场馆排名开发中" />
          default:
            return null
        }

      // ── 明细层 ────────────────────────────────────────────────
      case "detail":
        switch (activeSub) {
          case "brands":
            return <BrandTable brands={data?.brands ?? []} isLoading={isLoading} />
          case "editions":
            return <EmptyState message="届次列表开发中" />
          case "search":
            return <EmptyState message="搜索功能开发中" />
          case "export":
            return <EmptyState message="导出功能开发中" />
          default:
            return null
        }

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3"
        >
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => fetchData(buildQueryString())}
            className="text-xs text-red-700 hover:text-red-800 underline ml-4"
          >
            重试
          </button>
        </div>
      )}

      <FilterTabs
        industryL1Options={l1Options}
        selectedL1={selectedL1}
        onL1Change={(v) => {
          setSelectedL1(v);
          setSelectedL2(null);
        }}
        industryL2Options={l2Options}
        selectedL2={selectedL2}
        onL2Change={setSelectedL2}
        competitionRelationOptions={COMPETITION_RELATION_OPTIONS}
        selectedRelations={selectedRelations}
        onRelationsChange={setSelectedRelations}
        mdsRelatedOptions={MDS_RELATED_OPTIONS}
        selectedMds={selectedMds}
        onMdsChange={setSelectedMds}
        isLoading={isLoading}
      />

      <LayerTabs activeLayer={activeLayer} onChange={handleLayerChange} />

      <SubTabs tabs={subtabs} activeTab={activeSub} onChange={setActiveSub} />

      {renderContent()}
    </div>
  );
}
