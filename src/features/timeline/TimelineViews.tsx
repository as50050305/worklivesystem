import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui'
import { LampIllustration } from '@/components/illustrations/Illustrations'
import type { ChecklistItem, TimelineItem } from '@/data/types'
import { isSameMonth, monthGrid, WEEKDAY_HEADERS, weekDays } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { formatDate, weekdayZh, type PlainDate } from '@/lib/dates'
import { useOnline } from '@/pwa/useOnline'
import { useTimelineEditor } from './EditorContext'
import { ItemCard } from './ItemCard'

export interface ViewProps {
  anchor: PlainDate
  today: PlainDate
  byDate: Map<PlainDate, TimelineItem[]>
  checklists: Map<string, ChecklistItem[]>
  onPickDay: (d: PlainDate) => void
}

function DropZone({ date, className, children }: { date: PlainDate; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div ref={setNodeRef} data-date={date} className={cn(className, isOver && 'outline-2 outline-dashed outline-offset-[-2px] outline-[var(--c-primary-ink)] bg-primary-soft')}>
      {children}
    </div>
  )
}

function AddButton({ date, compact }: { date: PlainDate; compact?: boolean }) {
  const { openCreate } = useTimelineEditor()
  const online = useOnline()
  return (
    <button
      type="button"
      disabled={!online}
      onClick={() => openCreate({ item_date: date })}
      aria-label={`在 ${formatDate(date)} 新增`}
      className={cn(
        'flex items-center gap-1.5 rounded-lg text-text-3 hover:bg-surface-2 hover:text-text disabled:pointer-events-none',
        compact ? 'size-6 justify-center' : 'w-full px-2 py-1.5 text-xs',
      )}
    >
      <Plus size={compact ? 13 : 14} />
      {!compact && '新增'}
    </button>
  )
}

/* ---------------- 週 ---------------- */
export function WeekView({ anchor, today, byDate, checklists, onPickDay }: ViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-7 md:gap-0 md:divide-x md:divide-dashed md:divide-line-soft md:rounded-[var(--r-2xl)] md:border md:border-line md:bg-surface">
      {weekDays(anchor).map((d) => {
        const items = byDate.get(d) ?? []
        const isToday = d === today
        return (
          <DropZone key={d} date={d} className={cn('flex min-h-24 flex-col rounded-2xl border border-line-soft bg-surface md:min-h-[480px] md:rounded-none md:border-0 md:bg-transparent', d < today && 'md:[&>header]:opacity-60')}>
            <header className="flex items-baseline justify-between gap-2 border-b border-dashed border-line-soft px-3 py-2.5">
              <button type="button" onClick={() => onPickDay(d)} className="flex items-baseline gap-2 hover:underline">
                <span className={cn('label-caps text-[11px]', isToday ? 'text-primary-ink' : 'text-text-2')}>{weekdayZh(d)}</span>
                <span className={cn('tabular font-mono text-lg font-medium', isToday && 'grid min-w-8 place-items-center rounded-full bg-primary px-1.5 text-on-primary')}>
                  {Number(d.slice(8))}
                </span>
              </button>
              <AddButton date={d} compact />
            </header>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {items.map((it) => (
                <ItemCard key={it.id} item={it} checklist={checklists.get(it.id)} draggable />
              ))}
            </div>
          </DropZone>
        )
      })}
    </div>
  )
}

/* ---------------- 月 ---------------- */
const MAX_PILLS = 3

export function MonthView({ anchor, today, byDate, onPickDay }: ViewProps) {
  const weeks = monthGrid(anchor)
  return (
    <div className="overflow-hidden rounded-[var(--r-2xl)] border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_HEADERS.map((w) => (
          <span key={w} className="label-caps py-2 text-center text-[11px] text-text-2">
            {w}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-dashed border-line-soft last:border-b-0">
          {week.map((d) => {
            const items = byDate.get(d) ?? []
            const inMonth = isSameMonth(d, anchor)
            const isToday = d === today
            return (
              <DropZone key={d} date={d} className={cn('group min-h-[72px] min-w-0 border-r border-dashed border-line-soft p-1 last:border-r-0 sm:min-h-[112px] sm:p-1.5', !inMonth && 'hatch opacity-60')}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onPickDay(d)}
                    aria-label={`查看 ${formatDate(d)}`}
                    className={cn(
                      'tabular grid size-7 place-items-center rounded-full font-mono text-[13px] hover:bg-surface-2',
                      isToday && 'bg-primary text-on-primary hover:bg-primary',
                      !inMonth && 'text-text-3',
                    )}
                  >
                    {Number(d.slice(8))}
                  </button>
                  <span className="hidden sm:group-hover:block">
                    <AddButton date={d} compact />
                  </span>
                </div>
                {/* 手機：只顯示圓點 */}
                <div className="mt-1 flex flex-wrap gap-1 px-1 sm:hidden">
                  {items.slice(0, 6).map((it) => (
                    <span key={it.id} className={cn('size-1.5 rounded-full bg-text-2', it.is_done && 'opacity-40')} />
                  ))}
                </div>
                <div className="mt-0.5 hidden space-y-0.5 sm:block">
                  {items.slice(0, MAX_PILLS).map((it) => (
                    <ItemCard key={it.id} item={it} variant="pill" draggable />
                  ))}
                  {items.length > MAX_PILLS && (
                    <button type="button" onClick={() => onPickDay(d)} className="px-1.5 text-[11px] text-text-2 hover:text-text hover:underline">
                      還有 {items.length - MAX_PILLS} 筆
                    </button>
                  )}
                </div>
              </DropZone>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ---------------- 日 ---------------- */
export function DayView({ anchor, byDate, checklists }: ViewProps) {
  const items = byDate.get(anchor) ?? []
  const allDay = items.filter((i) => !i.item_time)
  const timed = items.filter((i) => i.item_time)
  if (!items.length) {
    return (
      <div className="card">
        <EmptyState illustration={<LampIllustration size={100} />} title="這一天沒有項目" action={<AddButton date={anchor} />} />
      </div>
    )
  }
  return (
    <div className="card grid gap-8 p-5 sm:p-6 lg:grid-cols-[1fr_1.4fr]">
      <section>
        <h3 className="label-caps mb-3 text-[12px] text-text-2">整天 · {allDay.length}</h3>
        <div className="space-y-2">
          {allDay.map((it) => (
            <ItemCard key={it.id} item={it} checklist={checklists.get(it.id)} showChecklist />
          ))}
          {!allDay.length && <p className="text-sm text-text-3">沒有整天項目</p>}
        </div>
      </section>
      <section>
        <h3 className="label-caps mb-3 text-[12px] text-text-2">時段 · {timed.length}</h3>
        <ol className="relative space-y-2 border-l border-dashed border-line-soft pl-5">
          {timed.map((it) => (
            <li key={it.id} className="relative">
              <span aria-hidden className="absolute -left-[25px] top-3 size-2 rounded-full border border-line bg-surface" />
              <ItemCard item={it} checklist={checklists.get(it.id)} showChecklist />
            </li>
          ))}
          {!timed.length && <li className="text-sm text-text-3">沒有指定時間的項目</li>}
        </ol>
        <div className="mt-4">
          <AddButton date={anchor} />
        </div>
      </section>
    </div>
  )
}
