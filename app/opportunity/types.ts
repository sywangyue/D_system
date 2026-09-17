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

/**
 * 业务线。**只留键与拉丁缩写，不留中文标签** ——
 * 标签只有一处来源：字典的 enum.bizLine（经 lib/enums.ts 的 bizLineLabel 取）。
 * 原先这里各带一份中文 label，接 i18n 时那份就成了第二来源，早晚与字典对不上。
 * 拉丁（lat）保留：中文版界面在标签右侧跟一个拉丁小字，英文版不显示（会重复）。
 */
export const BIZ_LINES: { key: BizLine; lat: string }[] = [
  { key: "ma",              lat: "M&A" },
  { key: "greenfield",      lat: "Greenfield" },
  { key: "project_support", lat: "Support" },
]

/** 五档阶段，顺序即进度。索引用于表格里的 5 段进度指示。标签同上走字典 enum.stage。 */
export const STAGES: { key: Stage }[] = [
  { key: "contact" },
  { key: "intent" },
  { key: "dd" },
  { key: "audit" },
  { key: "closing" },
]

/**
 * 交易形式，只对 type=ma 有意义 —— 与业务线是两个维度，不可合并。
 * 取值是中文原文（库里 opportunity.deal_type 存的就是它，也是发给接口的合法值），
 * 所以这份列表属于「数据」；显示标签走字典 enum.dealType。
 */
export const DEAL_TYPES: DealType[] = ["收购", "并购", "参股", "承办", "孵化"]

export const stageIndex = (s: Stage) => STAGES.findIndex(x => x.key === s)
