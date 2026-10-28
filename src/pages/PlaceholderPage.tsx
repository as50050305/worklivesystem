import { PageHeader } from '@/components/PageHeader'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Badge, Card, EmptyState } from '@/components/ui'

export function PlaceholderPage({ title, phase }: { title: string; phase?: string }) {
  return (
    <>
      <PageHeader title={title} eyebrow={phase && <Badge tone="lavender">{phase}</Badge>} />
      <Card>
        <EmptyState illustration={<BoxIllustration />} title="這一頁尚未實作">
          將在 {phase ?? '後續階段'} 完成。
        </EmptyState>
      </Card>
    </>
  )
}
