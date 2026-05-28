import { Suspense } from 'react'
import ExhibitionContent from './exhibition-content'

export default async function ExhibitionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F8', padding: '32px' }}>
      <Suspense
        fallback={
          <div style={{ color: '#AEAEB2', fontSize: '14px', padding: '40px 0' }}>
            加载中...
          </div>
        }
      >
        <ExhibitionContent id={id} />
      </Suspense>
    </div>
  )
}
