"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, SearchX } from "lucide-react";
import SlicerBar from "@/components/dashboard/SlicerBar";
import KpiCardRow from "@/components/dashboard/KpiCardRow";
import TrendChart from "@/components/dashboard/TrendChart";
import IndustryPieChart from "@/components/charts/IndustryPieChart";
import BrandTable from "@/components/dashboard/BrandTable";
import EmptyState from "@/components/ui/EmptyState";
import type { DashboardResponse } from "@/lib/types";

const COMPETITION_RELATION_OPTIONS = ["竞争对手", "潜在伙伴", "新进入者"];

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mountedRef = useRef(false);

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

  // Brand table collapse state
  const [brandsExpanded, setBrandsExpanded] = useState(true);

  // Filter options
  const [l1Options, setL1Options] = useState<string[]>([]);
  const [l2ByL1, setL2ByL1] = useState<Map<string, string[]>>(new Map());
  const [allL2Options, setAllL2Options] = useState<string[]>([]);
  const [mdsOptions, setMdsOptions] = useState<string[]>([]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedL1) params.set("industry_l1", selectedL1);
    if (selectedL2) params.set("industry_l2", selectedL2);
    if (selectedRelations.length > 0)
      params.set("competition_relation", selectedRelations.join(","));
    if (selectedMds) params.set("mds_related", selectedMds);
    return params.toString();
  }, [selectedL1, selectedL2, selectedRelations, selectedMds]);

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

  // Initial mount
  useEffect(() => {
    const qs = buildQueryString();
    Promise.allSettled([
      fetch("/api/filter-options").then((r) => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/dashboard${qs ? `?${qs}` : ""}`).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "无法加载数据");
        }
        return r.json() as Promise<DashboardResponse>;
      }),
    ]).then(([optResult, dataResult]) => {
      if (optResult.status === "fulfilled") {
        const opt = optResult.value;
        setL1Options(opt.industry_l1 ?? []);
        setAllL2Options(opt.industry_l2 ?? []);
        setL2ByL1(new Map(Object.entries(opt.industry_l2_by_l1 ?? {})));
        setMdsOptions(opt.mds_related ?? []);
      }
      if (dataResult.status === "fulfilled") {
        setData(dataResult.value);
      } else {
        setError(dataResult.reason instanceof Error ? dataResult.reason.message : "网络异常，请稍后重试");
      }
      setIsLoading(false);
      mountedRef.current = true;
    });
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
  }, [selectedL1, selectedL2, selectedRelations, selectedMds]);

  const l2Options = selectedL1
    ? l2ByL1.get(selectedL1) || []
    : allL2Options;

  const handleClearFilters = () => {
    setSelectedL1(null);
    setSelectedL2(null);
    setSelectedRelations([]);
    setSelectedMds(null);
  };

  const brandsCount = data?.brands?.length ?? 0;

  // ─── 四态派生 ─────────────────────────────────────────────────────
  const isInitialLoading = isLoading && !data;
  const hasError         = !data && !!error;
  const isEmpty          = !!data && brandsCount === 0;
  const hasData          = !!data && brandsCount > 0;

  return (
    <div className="space-y-6">

      {/* SlicerBar — 永远挂载，不参与内容区状态切换 */}
      <SlicerBar
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
        mdsRelatedOptions={mdsOptions}
        selectedMds={selectedMds}
        onMdsChange={setSelectedMds}
        isLoading={isLoading}
      />

      {/* 内容区：四态互斥 */}

      {isInitialLoading && (
        <div className="space-y-6">
          <KpiCardRow data={null} isLoading />
          <div className="lg:grid lg:grid-cols-2 gap-6">
            <TrendChart data={[]} isLoading />
            <IndustryPieChart data={[]} isLoading />
          </div>
        </div>
      )}

      {hasError && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-sm text-destructive mb-3">{error}</div>
          <button
            onClick={() => fetchData(buildQueryString())}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark transition-colors"
          >
            点击重试
          </button>
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={<SearchX size={48} className="text-gray-300" />}
          message="当前筛选条件下没有匹配的展会数据"
          action={{ label: "清除筛选条件", onClick: handleClearFilters }}
        />
      )}

      {hasData && (
        <div className="space-y-6">
          {/* 刷新出错时的内联告警（data 仍然存在，保持内容可见） */}
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

          <KpiCardRow data={data.kpis} isLoading={isLoading} />

          <div className="lg:grid lg:grid-cols-2 gap-6">
            <TrendChart data={data.yearTrend} isLoading={isLoading} />
            <IndustryPieChart
              data={data.industryDistribution}
              isLoading={isLoading}
              error={error}
              onRetry={() => fetchData(buildQueryString())}
              l2ByL1={l2ByL1}
              selectedL2={selectedL2}
              onIndustrySelect={setSelectedL2}
            />
          </div>

          <div>
            <button
              onClick={() => setBrandsExpanded(!brandsExpanded)}
              className="flex items-center gap-2 mb-3 text-sm font-medium text-text-primary hover:text-accent transition-colors"
            >
              {brandsExpanded ? (
                <ChevronDown size={16} className="text-text-secondary" />
              ) : (
                <ChevronRight size={16} className="text-text-secondary" />
              )}
              品牌列表 ({brandsCount})
            </button>
            {brandsExpanded && (
              <BrandTable brands={data.brands} isLoading={isLoading} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
