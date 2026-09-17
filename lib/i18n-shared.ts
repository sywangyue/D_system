import zh from '@/locales/zh.json'
import en from '@/locales/en.json'

/**
 * 客户端也要用的部分：字典本体、类型、语言标签、格式化助手。
 * cookie 读取在 lib/i18n.ts（服务端专用，引了 next/headers，不能进客户端包）。
 *
 * DE 尚未提供翻译：读者是德方总部，机器翻译的界面比英文界面更糟，
 * 待人工出 locales/de.json 后再加进 LOCALES。
 */
export const LOCALES = { zh, en } as const
export type Locale = keyof typeof LOCALES
export type Dict = typeof zh
/** 标签一律用拉丁字形：英文版要求不出现任何中文字体，
 *  若写成「中文」，光渲染这两个字就得加载 CJK 字体。 */
export const LOCALE_LABELS: Record<Locale, string> = { zh: 'ZH', en: 'EN' }
export const LOCALE_COOKIE = 'mwlab_locale'

/** 交给 Intl 的 BCP-47 标签。'zh' / 'en' 也合法，但显式给区域更稳。 */
export const LOCALE_TAG: Record<Locale, string> = { zh: 'zh-CN', en: 'en-US' }

/**
 * 库里所有时间列的格式都是 'YYYY-MM-DD HH:MM:SS' 的**本地时间**，不带时区。
 * `new Date("2026-08-04 10:26:57")` 是引擎各自为政的解析（有的当本地、有的当 UTC），
 * 统一换成 ISO 的 T 分隔符 —— 不带 Z 即按本地时间解析，正是库里的语义。
 * 解析这个坑只有这一处，别在各页面里重复。
 */
export function parseLocal(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s.trim().replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 日期（不含时间）：中文 2026年8月4日 · 英文 Aug 4, 2026 */
export function fmtDate(locale: Locale, s: string | null | undefined, dash = '—'): string {
  const d = parseLocal(s)
  if (!d) return dash
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(d)
}

/** 只要月日、不要年份：中文 9月17日 · 英文 Sep 17。
 *  盘面的待办排期与研报角落只有这么宽（原先代码是 s.slice(5) 那种硬切）。 */
export function fmtMonthDay(locale: Locale, s: string | null | undefined, dash = '—'): string {
  const d = parseLocal(s)
  if (!d) return dash
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    month: 'short', day: 'numeric',
  }).format(d)
}

/** 日期 + 时分：用于详情页的「更新 …」 */
export function fmtDateTime(locale: Locale, s: string | null | undefined, dash = '—'): string {
  const d = parseLocal(s)
  if (!d) return dash
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

/** 千分位。数字不手拼（I18N-SPEC §4）。 */
export function fmtNum(locale: Locale, n: number | null | undefined, dash = '—'): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return dash
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(n)
}

/** 字典没有插值引擎：{count} 这种占位统一用它替换，别用 + 拼（中英语序不同）。 */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), tpl,
  )
}

/**
 * 内容字段的中英双份取一。
 *
 * 知识库的 title/summary 有 `_en` 变体，是 Max 自己写了两份，不是翻译层的事
 * （TASK-K §5.5）。英文界面优先取英文，**缺了回退中文** —— 显示中文标题好过显示空白。
 * 中文界面一律取中文那一份（不会去拿英文的来充数）。
 */
export function pickContent(locale: Locale, zh: string | null, en: string | null): string {
  if (locale === "en") return (en && en.trim()) || (zh ?? "")
  return zh ?? ""
}

/**
 * 接口错误码 → 可显示的句子。
 *
 * 接口只回 slug，不回中文句子（返工单 E-2）：句子写死在路由里，英文界面会把中文
 * 原样显示出来，而规格 §5 的两条 grep 只扫 *.tsx，抓不到 .ts 里的文案。
 *
 * 查不到的码一律回退通用文案 —— **绝不把 slug 裸露给用户**。
 * netFallback 用在「压根没拿到 error 字段」的情形（网络断、响应不是 JSON），
 * 此时给调用方一个更贴合场景的说法，比通用文案有用。
 */
export function errorText(
  t: Dict,
  code: string | null | undefined,
  values?: string,
  netFallback?: string,
): string {
  if (!code) return netFallback ?? t.error.generic
  const msg = (t.error as Record<string, string>)[code]
  if (!msg) return t.error.generic
  return values ? fill(msg, { values }) : msg
}
