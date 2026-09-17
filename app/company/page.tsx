import Placeholder from "@/components/layout/Placeholder"
export default function Page() {
  return <Placeholder title="公司库" lat="Entities" phase="阶段 5.6"
    items={[
      "501 家公司的一阶列表：公司名 / 类型 / 经营状态 / 城市 / 更新时间",
      "详情页带出该公司名下的全部资源与关联机会",
      "接口 /api/company 与 /api/company/[id] 已就绪",
    ]} />
}
