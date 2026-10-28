import { Badge, type BadgeTone } from '@/components/ui'
import type { OptionItem } from '@/data/types'
import { MAX_FOLLOWUPS } from '@/lib/followup'
import { cn } from '@/lib/cn'

export function followupTone(o: OptionItem | undefined): BadgeTone {
  switch (o?.key) {
    case 'following':
      return 'steel'
    case 'cooling':
      return 'warning'
    case 'recontact':
      return 'primary'
    case 'won':
      return 'primary'
    case 'rejected':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function coopTone(o: OptionItem | undefined): BadgeTone {
  switch (o?.key) {
    case 'aligned':
      return 'primary'
    case 'cold':
      return 'steel'
    case 'mismatch':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function StatusBadge({ option, tone }: { option: OptionItem | undefined; tone: BadgeTone }) {
  return <Badge tone={tone}>{option?.label ?? '未設定'}</Badge>
}

/** 本輪追蹤次數：5 個點 */
export function CountDots({ count, size = 'sm' }: { count: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`本輪追蹤 ${count} ／ ${MAX_FOLLOWUPS} 次`}>
      {Array.from({ length: MAX_FOLLOWUPS }, (_, i) => (
        <span
          key={i}
          className={cn('rounded-full border', size === 'lg' ? 'size-3.5' : 'size-2', i < count ? 'border-primary bg-primary' : 'border-line-soft')}
        />
      ))}
    </span>
  )
}
