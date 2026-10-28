import { useDraggable } from '@dnd-kit/core'
import { ListChecks, Repeat } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { useTagLookup, useTimelineMutations } from '@/data/hooks'
import type { ChecklistItem, TimelineItem } from '@/data/types'
import { formatTime } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { useOnline } from '@/pwa/useOnline'
import { useTimelineEditor } from './EditorContext'

export interface ItemCardProps {
  item: TimelineItem
  checklist?: ChecklistItem[]
  variant?: 'card' | 'pill' | 'row'
  draggable?: boolean
  /** 列表中顯示的額外說明（例如「逾期 3 天」） */
  note?: React.ReactNode
  showChecklist?: boolean
  /** 拖移時跟著游標的複本 */
  overlay?: boolean
}

/** 時間軸項目：勾選、顏色、標題、時間、重複與清單進度；點擊開啟編輯 */
export function ItemCard({ item, checklist = [], variant = 'card', draggable = false, note, showChecklist = false, overlay = false }: ItemCardProps) {
  const tag = useTagLookup()(item.color_tag_id)
  const { openEdit } = useTimelineEditor()
  const m = useTimelineMutations()
  const online = useOnline()
  const drag = useDraggable({ id: overlay ? `${item.id}:overlay` : item.id, data: { item }, disabled: overlay || !draggable || !online })
  // 勾選時立即反映（不等網路），資料回來後以伺服器為準
  const [pendingDone, setPendingDone] = useState<boolean | null>(null)
  useEffect(() => setPendingDone(null), [item.is_done, item.updated_at])
  const isDone = pendingDone ?? item.is_done
  const toggle = () => {
    setPendingDone(!isDone)
    m.toggleDone.mutate({ ...item, is_done: isDone }, { onError: () => setPendingDone(null) })
  }
  const color = tag?.color ?? 'var(--c-line-soft)'
  const done = checklist.filter((c) => c.is_done).length
  const style: CSSProperties = drag.isDragging ? { opacity: 0.35 } : {}
  const canDrag = draggable && !overlay && online
  // 不可拖移時不掛上 dnd-kit 的屬性（避免 aria-disabled 影響裡面的勾選框）
  const { 'aria-disabled': _ariaDisabled, role: _role, ...dragAttrs } = drag.attributes
  const dragProps = canDrag ? { ...drag.listeners, ...dragAttrs } : {}

  if (variant === 'pill') {
    return (
      <button
        ref={drag.setNodeRef}
        {...dragProps}
        type="button"
        style={style}
        onClick={() => openEdit(item)}
        className={cn('flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[12px] hover:bg-surface-2', item.is_done && 'text-text-3 line-through')}
        title={item.title}
      >
        <span className="chip-dot size-1.5" style={{ background: color }} />
        {item.item_time && <span className="tabular flex-none font-mono text-[11px] text-text-2">{formatTime(item.item_time)}</span>}
        <span className="truncate">{item.title}</span>
      </button>
    )
  }

  return (
    <div
      ref={drag.setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-start gap-2.5 text-sm',
        variant === 'card' && 'rounded-xl border border-line-soft bg-surface px-2.5 py-2 hover:border-line',
        variant === 'row' && 'rounded-xl px-2 py-1.5 hover:bg-surface-2',
        canDrag && 'cursor-grab touch-manipulation active:cursor-grabbing',
        showChecklist && 'flex-wrap',
      )}
      {...dragProps}
      role="group"
      aria-roledescription={draggable ? '可拖移的項目' : undefined}
      aria-label={item.title}
    >
      {variant === 'card' && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: color }} />}
      <input
        type="checkbox"
        className="check mt-0.5"
        checked={isDone}
        disabled={!online}
        aria-label={`完成：${item.title}`}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={toggle}
      />
      {variant === 'row' && <span className="chip-dot mt-1.5" style={{ background: color }} aria-hidden />}
      <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left" onPointerDown={(e) => draggable || e.stopPropagation()}>
        <span className={cn('block break-words leading-snug', isDone && 'text-text-3 line-through')}>{item.title}</span>
        {(item.recurrence !== 'none' || item.kind === 'checklist' || note) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-2">
            {item.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-0.5" title="重複">
                <Repeat size={11} />
              </span>
            )}
            {item.kind === 'checklist' && (
              <span className="tabular inline-flex items-center gap-0.5 font-mono">
                <ListChecks size={11} /> {done}/{checklist.length}
              </span>
            )}
            {note}
          </span>
        )}
      </button>
      {item.item_time && <span className="tabular mt-0.5 flex-none font-mono text-[11px] text-text-2">{formatTime(item.item_time)}</span>}
      {showChecklist && item.kind === 'checklist' && checklist.length > 0 && (
        <ul className="basis-full space-y-1 pl-7">
          {checklist.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-[13px]" onPointerDown={(e) => e.stopPropagation()}>
                <input type="checkbox" className="check" checked={c.is_done} disabled={!online} onChange={(e) => m.toggleChecklist.mutate({ id: c.id, isDone: e.target.checked })} />
                <span className={cn(c.is_done && 'text-text-3 line-through')}>{c.content}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
