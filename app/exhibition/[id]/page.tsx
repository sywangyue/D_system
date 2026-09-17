import { Suspense } from 'react'
import ExhibitionContent from './exhibition-content'

export default async function ExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // 颜色走令牌层，不写死 —— 这是反置前遗留的两处硬编码浅色（#F7F7F8 / #AEAEB2），
  // 当时看着是对的，但主题再变就跟不上了。
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-canvas)', padding: '32px' }}>
      <Suspense
        fallback={
          <div style={{ color: 'var(--color-fg-subtle)', fontSize: '14px', padding: '40px 0' }}>
            加载中...
          </div>
        }
      >
        <ExhibitionContent id={id} />
      </Suspense>
    </div>
  )
}
