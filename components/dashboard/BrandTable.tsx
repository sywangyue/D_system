import type { Brand } from "@/lib/types"

interface BrandTableProps {
  brands: Brand[]
  isLoading?: boolean
}

function relationStyle(relation: string): { bg: string; text: string } {
  switch (relation) {
    case "竞争对手":
      return { bg: "bg-red-50", text: "text-red-700" }
    case "潜在伙伴":
      return { bg: "bg-accent-surface", text: "text-accent-dark" }
    case "新进入者":
      return { bg: "bg-blue-50", text: "text-blue-700" }
    default:
      return { bg: "bg-gray-50", text: "text-gray-600" }
  }
}

export default function BrandTable({ brands, isLoading = false }: BrandTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl overflow-hidden animate-pulse">
        <div className="h-10 bg-gray-100 mx-6 mt-5 rounded w-28" />
        <div className="px-6 py-3 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-5 w-40 bg-gray-100 rounded" />
              <div className="h-5 w-24 bg-gray-100 rounded" />
              <div className="h-5 w-20 bg-gray-100 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-5 w-12 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-6 text-center text-sm text-text-secondary">
        当前筛选条件下无展会数据
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                品牌名称
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                所属行业
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                主办方
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                竞争关系
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-text-secondary uppercase">
                MDS 相关
              </th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => {
              const rel = relationStyle(brand.competition_relation)
              return (
                <tr
                  key={brand.brand_id}
                  className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-3 font-medium text-text-primary">
                    {brand.name_cn || brand.name_en || "--"}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {brand.industry_l2 || brand.industry_l1 || "--"}
                  </td>
                  <td className="px-6 py-3 text-text-secondary max-w-[200px] truncate">
                    {brand.organizer || "--"}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${rel.bg} ${rel.text}`}>
                      {brand.competition_relation || "--"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      brand.mds_related && brand.mds_related !== "无"
                        ? "bg-accent-surface text-accent-dark"
                        : "bg-gray-50 text-gray-600"
                    }`}>
                      {brand.mds_related || "--"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
