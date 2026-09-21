import { Suspense } from 'react'
import { getDict, getLocale } from '@/lib/i18n'
import ExhibitionContent from './exhibition-content'

export default async function ExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [{ id }, locale, t] = await Promise.all([params, getLocale(), getDict()])
  // 颜色走令牌层，不写死 —— 这是反置前遗留的两处硬编码浅色（#F7F7F8 / #AEAEB2），
  // 当时看着是对的，但主题再变就跟不上了。
  return (
    <div className="min-h-screen bg-canvas px-4 py-6 md:p-8">
      <Suspense
        fallback={
          <div style={{ color: 'var(--color-fg-subtle)', fontSize: '14px', padding: '40px 0' }}>
            {t.common.loading}
          </div>
        }
      >
        <ExhibitionContent id={id} t={t} locale={locale} />
      </Suspense>
    </div>
  )
}
