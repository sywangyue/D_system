import Placeholder from "@/components/layout/Placeholder"
export default function Page() {
  return <Placeholder title="机会详情" lat="Opportunity" phase="阶段 5.5"
    back={{ href: "/opportunity", label: "返回机会台" }}
    items={[
      "概览 / 深度调研 / 时间线 / 关联展会 四个 tab",
      "右栏：关联公司工商信息、对标 MD 品牌、对价区间、下一步",
      "该机会及其关联公司名下的全部资源，可直接下载",
      "接口 /api/opportunity/[id] 已就绪，六块数据一次取齐",
    ]} />
}
