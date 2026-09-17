import Placeholder from "@/components/layout/Placeholder"
export default function Page() {
  return <Placeholder title="调研库" lat="Reports" phase="阶段 5.6"
    items={[
      "intel_report 列表，一阶只给标题 / 类型 / 状态 / 摘要，不吐报告全文",
      "详情页渲染 report_md，并列出可下载的原始文件",
      "reports/ 下 11 份 docx 历史报告待回填入库",
      "接口 /api/research 与 /api/research/[id] 已就绪",
    ]} />
}
