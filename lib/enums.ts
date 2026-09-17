import type { Dict } from "@/lib/i18n-shared"

/**
 * 闭集枚举：**数据库里存的值** → 字典里的 slug。
 *
 * 为什么这些中文值放 .ts 而不是 .tsx：
 * 它们是**数据**，不是界面文案。筛选要把原值发给接口（`?company_status=存续`），
 * 所以值必须保持中文原文；界面显示时才按 locale 取标签。
 * 与 app/api/company/route.ts 里的 CONTACT_STATUS 同一路子。
 *
 * 为什么翻它们：界面上这些是**闭集**（六七种取值），不是用户录入的自由文本。
 * 自由文本（公司名 / 报告标题 / 机会名称）一律原样显示，不查字典 —— 见 TASK-E §4.1。
 */

export interface EnumOption {
  /** 数据库里的真实取值，原样发给接口 */
  value: string
  /** 字典 enum.* 下的键 */
  slug: string
}

/** 字典里任一张 slug → 标签 的表 */
type LabelMap = Record<string, string>

/**
 * 按 locale 取标签；查不到 slug 就回退原值（新枚举值不会显示成空白），
 * 空值给破折号。
 */
export function enumLabel(
  options: EnumOption[], map: LabelMap, value: string | null | undefined, dash = "—",
): string {
  if (value === null || value === undefined || value === "") return dash
  const slug = options.find(o => o.value === value)?.slug
  return (slug && map[slug]) || value
}

/** 直接用 slug（闭集取值本身既是键又是值的那几类，如 report_type / status / kind） */
export function slugLabel(map: LabelMap, slug: string | null | undefined, dash = "—"): string {
  if (!slug) return dash
  return map[slug] || slug
}

export const COMPANY_STATUS: EnumOption[] = [
  { value: "存续", slug: "inForce" },
  { value: "在业", slug: "operating" },
  { value: "存续（在营、开业、在册）", slug: "inForceFull" },
  { value: "仍注册", slug: "registered" },
  { value: "正常", slug: "normal" },
  { value: "注销", slug: "deregistered" },
  // 库里实际存的是带日期后缀的写法（company.company_status，1 行）。筛选是精确 = 匹配，
  // 只留不带后缀的那条会导致这颗药丸永远 0 条，且这一行在列表里显示成「注销」却筛不出来。
  { value: "注销（2023-01-04）", slug: "deregistered" },
]

export const COMPANY_TYPE: EnumOption[] = [
  { value: "organizer", slug: "organizer" },
  { value: "exhibitor", slug: "exhibitor" },
  { value: "service", slug: "service" },
  { value: "target", slug: "target" },
  { value: "partner", slug: "partner" },
]

/** API 端 SOURCE_TYPES 同一份取值（app/api/company/route.ts） */
export const SOURCE_TYPE: EnumOption[] = [
  { value: "qcc_search", slug: "qcc_search" },
  { value: "manual", slug: "manual" },
  { value: "db_match", slug: "db_match" },
]

/** 与 intel_report.report_type 的 CHECK 约束一致（006 建表 + 017 拓宽） */
/** company.contact_status 的合法取值（空串 = 未填）。界面暂不展示，只供接口校验。 */
export const CONTACT_STATUS = ["未接触", "已接触", "谈判中", "合作中", "放弃", ""]

export const REPORT_TYPE: EnumOption[] = [
  { value: "batch_prospect", slug: "batch_prospect" },
  { value: "industry_research", slug: "industry_research" },
  { value: "company_research", slug: "company_research" },
  { value: "brand_research", slug: "brand_research" },
  { value: "single_prospect", slug: "single_prospect" },
]

export const REPORT_STATUS: EnumOption[] = [
  { value: "draft", slug: "draft" },
  { value: "published", slug: "published" },
  { value: "archived", slug: "archived" },
]

export const RESOURCE_KIND: EnumOption[] = [
  { value: "report", slug: "report" },
  { value: "raw", slug: "raw" },
  { value: "export", slug: "export" },
  { value: "roster", slug: "roster" },
  { value: "note", slug: "note" },
]

export const USER_ROLE: EnumOption[] = [
  { value: "admin", slug: "admin" },
  { value: "manager", slug: "manager" },
  { value: "readonly", slug: "readonly" },
]

export const USER_STATE: EnumOption[] = [
  { value: "active", slug: "active" },
  { value: "inactive", slug: "inactive" },
  { value: "disabled", slug: "disabled" },
]

export const CRAWL_STATUS: EnumOption[] = [
  { value: "success", slug: "success" },
  { value: "running", slug: "running" },
  { value: "failed", slug: "failed" },
  { value: "partial", slug: "partial" },
  { value: "none", slug: "none" },
]

/* ── 阶段 / 业务线 / 交易形式 ─────────────────────────────
   阶段与业务线的**取值**定义在 app/opportunity/types.ts（与 /api/opportunity
   的契约同处），这里只把「键 → 字典标签」接起来，避免标签出现第二份。 */

export const stageLabel = (t: Dict, key: string | null | undefined): string =>
  (key && (t.enum.stage as LabelMap)[key]) || (key || "—")

export const bizLineLabel = (t: Dict, key: string | null | undefined): string =>
  (key && (t.enum.bizLine as LabelMap)[key]) || (key || "—")

/** 交易形式在库里存的就是中文原值（见 types.ts 的 DealType），所以按值查 */
export const DEAL_TYPE_OPTIONS: EnumOption[] = [
  { value: "收购", slug: "acquisition" },
  { value: "并购", slug: "control" },
  { value: "参股", slug: "minority" },
  { value: "承办", slug: "hosting" },
  { value: "孵化", slug: "incubation" },
]

export const dealTypeLabel = (t: Dict, value: string | null | undefined): string =>
  enumLabel(DEAL_TYPE_OPTIONS, t.enum.dealType as LabelMap, value)

/* ── 行业一级分类（industry_l1）─────────────────────────────
   scripts/classify_all_brands.py 派生的**闭集**，全库只有这 8 个取值 ——
   与 company_status 完全同性质，所以照同一形态处理：
   value 保持库里的中文原值（/api/user/preferences 存的就是它，改了会存错），
   标签按 locale 取。原先当自由文本原样显示，英文界面于是漏出 8 个中文复选框。

   「科技+」的 `+` 是取值的一部分（分类脚本就这么写的），slug 用 techPlus 避开
   特殊字符，value 原样保留。 */

export const INDUSTRY_L1: EnumOption[] = [
  { value: "机械和设备",     slug: "machinery" },
  { value: "生活方式",       slug: "lifestyle" },
  { value: "休闲",           slug: "leisure" },
  { value: "化工与能源",     slug: "chemicalsEnergy" },
  { value: "科技+",          slug: "techPlus" },
  { value: "医疗和健康",     slug: "healthcare" },
  { value: "零售贸易和服务", slug: "retailServices" },
  { value: "农业与畜牧",     slug: "agriculture" },
]

/* ── exhibition_brand 上两个人工打标字段的取值 ────────────────
   competition_relation / mds_related 是人工在打标工具里填的**中文取值**，
   界面只拿它们做相等比较，不显示它们本身。放 .ts 的理由与上面那几个枚举一样：
   它们是库里的数据，不是界面文案（比较用的字面量不该混在 .tsx 里，
   否则「界面零硬编码中文」的扫描会把它当成漏翻的文案）。 */

export const COMPETITION_YES = "是"
export const MDS_NONE = "无"
