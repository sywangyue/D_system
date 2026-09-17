import { cookies } from 'next/headers'
import { LOCALES, LOCALE_COOKIE, type Locale, type Dict } from '@/lib/i18n-shared'

/**
 * 服务端专用。语言状态只有一处来源：cookie `mwlab_locale`。
 * 不放 localStorage —— 登录态的两套并存已经吃过一次亏，不再重蹈。
 */
export async function getLocale(): Promise<Locale> {
  return (await cookies()).get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'zh'
}

export async function getDict(): Promise<Dict> {
  return LOCALES[await getLocale()] as Dict
}
