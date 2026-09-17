import zh from '@/locales/zh.json'
import en from '@/locales/en.json'

/**
 * 客户端也要用的部分：字典本体、类型、语言标签。
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
