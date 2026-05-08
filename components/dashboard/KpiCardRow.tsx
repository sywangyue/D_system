import KpiCard from "@/components/ui/KpiCard"
import type { KpiData } from "@/lib/types"

interface KpiCardRowProps {
  data: KpiData | null
  isLoading: boolean
}

export default function KpiCardRow({ data, isLoading }: KpiCardRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="展览面积" value={data?.total_area ?? null} unit="㎡" variant="highlight" isLoading={isLoading} />
      <KpiCard label="展商数量" value={data?.total_exhibitors ?? null} isLoading={isLoading} />
      <KpiCard label="观众数量" value={data?.total_visitors ?? null} isLoading={isLoading} />
      <KpiCard label="展览集团" value={data?.total_organizers ?? null} isLoading={isLoading} />
    </div>
  )
}
