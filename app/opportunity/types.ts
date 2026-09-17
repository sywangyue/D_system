/** 与 /api/opportunity 的契约保持一致。一阶只有这 6 个字段。 */
export interface OppRow {
  opp_id: number
  title: string
  type: BizLine
  stage: Stage
  owner: string | null
  updated_at: string
}

export type BizLine = "ma" | "greenfield" | "project_support"
export type Stage = "contact" | "intent" | "dd" | "audit" | "closing"
export type DealType = "收购" | "并购" | "参股" | "承办" | "孵化"

export const BIZ_LINES: { key: BizLine; label: string; lat: string }[] = [
  { key: "ma",              label: "并购标的",   lat: "M&A" },
  { key: "greenfield",      label: "全新品类",   lat: "Greenfield" },
  { key: "project_support", label: "项目组支持", lat: "Support" },
]

/** 五档阶段，顺序即进度。索引用于表格里的 5 段进度指示。 */
export const STAGES: { key: Stage; label: string }[] = [
  { key: "contact", label: "接洽" },
  { key: "intent",  label: "意向" },
  { key: "dd",      label: "尽调" },
  { key: "audit",   label: "审计" },
  { key: "closing", label: "交割" },
]

/** 交易形式，只对 type=ma 有意义 —— 与业务线是两个维度，不可合并。 */
export const DEAL_TYPES: DealType[] = ["收购", "并购", "参股", "承办", "孵化"]

export const stageIndex = (s: Stage) => STAGES.findIndex(x => x.key === s)
export const stageLabel = (s: Stage) => STAGES.find(x => x.key === s)?.label ?? s
