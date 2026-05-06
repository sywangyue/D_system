"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import FilterTabs from "@/components/ui/FilterTabs";
import KpiCard from "@/components/ui/KpiCard";
import IndustryPieChart from "@/components/charts/IndustryPieChart";
import type { DashboardResponse, Brand } from "@/lib/types";

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

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mountedRef = useRef(false);

  // Filter state — initialized from URL search params
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

  // UI-only filter (not sent to API or synced to URL)
  const [selectedL1, setSelectedL1] = useState<string | null>(null);

  // Data state
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options — derived from initial full-dataset fetch
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

  // ─── Initial mount — fetch options + display data ────────────────────
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
      } catch {
        // Options fetch failed silently — display fetch will surface errors
      }

      await fetchData(buildQueryString());
      mountedRef.current = true;
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filter change → sync URL + refetch ──────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;

    const raw = buildQueryString();
    const nextUrl = `/dashboard${raw ? `?${raw}` : ""}`;
    router.replace(nextUrl, { scroll: false });

    fetchData(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedL2, selectedRelations, selectedMds]);

  // Derived L2 options — filtered by selected L1
  const l2Options = selectedL1
    ? l2ByL1.get(selectedL1) || []
    : allL2Options;

  // ─── Render: Initial loading (no data at all) ────────────────────────
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
          <KpiCard label="展览面积" value={null} unit="㎡" variant="highlight" isLoading />
          <KpiCard label="展商数量" value={null} isLoading />
          <KpiCard label="观众数量" value={null} isLoading />
          <KpiCard label="展览集团" value={null} isLoading />
        </div>
        <IndustryPieChart data={[]} isLoading />
      </div>
    );
  }

  // ─── Render: Error (no data at all) ──────────────────────────────────
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

  // ─── Render: Empty (no matching brands) ──────────────────────────────
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

  // ─── Render: Populated ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Error banner — shown above existing data on refetch failure */}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="展览面积"
          value={data?.kpis.total_area ?? null}
          unit="㎡"
          variant="highlight"
          isLoading={isLoading}
        />
        <KpiCard
          label="展商数量"
          value={data?.kpis.total_exhibitors ?? null}
          isLoading={isLoading}
        />
        <KpiCard
          label="观众数量"
          value={data?.kpis.total_visitors ?? null}
          isLoading={isLoading}
        />
        <KpiCard
          label="展览集团"
          value={data?.kpis.total_organizers ?? null}
          isLoading={isLoading}
        />
      </div>

      <IndustryPieChart
        data={data?.industryDistribution ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => fetchData(buildQueryString())}
      />
    </div>
  );
}
