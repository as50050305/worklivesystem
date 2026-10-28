import { Badge, type BadgeTone } from '@/components/ui'
import { useTagLookup } from '@/data/hooks'
import type { OptionItem, Project } from '@/data/types'
import { cn } from '@/lib/cn'
import { countdown, formatDate, type PlainDate } from '@/lib/dates'

/** 專案狀態徽章（依系統鍵決定色調；使用者自訂的狀態用中性色） */
export function StatusBadge({ status }: { status: OptionItem | undefined }) {
  if (!status) return <Badge>未設定</Badge>
  const tone: BadgeTone = status.key === 'active' ? 'primary' : status.key === 'done' ? 'steel' : status.key === 'paused' ? 'warning' : status.key === 'cancelled' ? 'neutral' : 'lavender'
  return <Badge tone={tone}>{status.label}</Badge>
}

export function TagDot({ tagId, className }: { tagId: string | null; className?: string }) {
  const tag = useTagLookup()(tagId)
  return <span className={cn('chip-dot', className)} style={{ background: tag?.color ?? 'var(--c-line-soft)' }} aria-hidden />
}

/** 專案最近的倒數（申請截止或活動開始，取最接近且未過的；都過了就顯示最近一個） */
export function nextMilestone(p: Pick<Project, 'apply_deadline_on' | 'event_start_on'>, today: PlainDate) {
  const list = [
    p.apply_deadline_on && { label: '申請截止', date: p.apply_deadline_on },
    p.event_start_on && { label: '活動開始', date: p.event_start_on },
  ].filter(Boolean) as { label: string; date: PlainDate }[]
  if (!list.length) return null
  const upcoming = list.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))
  const pick = upcoming[0] ?? list.sort((a, b) => (a.date > b.date ? -1 : 1))[0]!
  return { ...pick, countdown: countdown(pick.date, today) }
}

export function MilestoneText({ project, today, className }: { project: Project; today: PlainDate; className?: string }) {
  const m = nextMilestone(project, today)
  if (!m) return <span className={cn('text-text-3', className)}>—</span>
  return (
    <span className={cn('tabular font-mono text-[12px]', m.countdown.kind === 'past' ? 'text-text-3' : m.countdown.kind === 'today' ? 'text-primary-ink' : 'text-text', className)} title={`${m.label} ${formatDate(m.date)}`}>
      {m.label} · {m.countdown.label}
    </span>
  )
}

/** 細進度條 */
export function ProgressLine({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-line-soft">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="tabular w-11 text-right font-mono text-[11px] text-text-2">{Number(value).toFixed(0)}%</span>
    </div>
  )
}
