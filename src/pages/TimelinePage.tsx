import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Alert, Button, Spinner, Tabs } from '@/components/ui'
import { useChecklist, useColorTags, useTimelineMutations, useTimelineRange } from '@/data/hooks'
import type { ChecklistItem, TimelineItem } from '@/data/types'
import { useTimelineEditor } from '@/features/timeline/EditorContext'
import { ItemCard } from '@/features/timeline/ItemCard'
import { DayView, MonthView, WeekView } from '@/features/timeline/TimelineViews'
import { groupByDate, parseDateInput, shiftAnchor, viewRange, viewTitle, type TimelineView } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

const FILTER_KEY = 'wls.timeline.hiddenTags'

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function TimelinePage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const view = (['day', 'week', 'month'].includes(params.get('view') ?? '') ? params.get('view') : 'week') as TimelineView
  const anchor = parseDateInput(params.get('date') ?? '') ?? today
  const setNav = (v: TimelineView, d: string) => setParams({ view: v, date: d }, { replace: true })

  const { from, to } = viewRange(view, anchor)
  const range = useTimelineRange(from, to)
  const { data: tags = [] } = useColorTags()
  const defaultTagId = tags.find((t) => t.is_default)?.id
  const [hidden, setHidden] = useState<string[]>(readHidden)
  const toggleTag = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    setHidden(next)
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const items = useMemo(
    () => (range.data ?? []).filter((it) => !hidden.includes(it.color_tag_id ?? defaultTagId ?? '')),
    [range.data, hidden, defaultTagId],
  )
  const byDate = useMemo(() => groupByDate(items), [items])
  const checklistIds = items.filter((i) => i.kind === 'checklist').map((i) => i.id)
  const checklistQ = useChecklist(checklistIds)
  const checklists = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>()
    for (const c of checklistQ.data ?? []) m.set(c.timeline_item_id, [...(m.get(c.timeline_item_id) ?? []), c])
    return m
  }, [checklistQ.data])

  const { openCreate, openEdit } = useTimelineEditor()
  // 從全域搜尋開啟某個項目：跳到該日並打開編輯抽屜
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const it = (location.state as { openItem?: TimelineItem } | null)?.openItem
    if (!it) return
    openEdit(it)
    navigate(location.pathname + location.search, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])
  const online = useOnline()
  const mut = useTimelineMutations()
  const [dragging, setDragging] = useState<TimelineItem | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.item as TimelineItem) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const item = e.active.data.current?.item as TimelineItem | undefined
    const date = e.over?.id as string | undefined
    if (item && date && date !== item.item_date) mut.move.mutate({ id: item.id, date })
  }

  const viewProps = { anchor, today, byDate, checklists, onPickDay: (d: string) => setNav('day', d) }

  return (
    <>
      <PageHeader
        title="時間軸"
        eyebrow="Timeline"
        actions={
          <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => openCreate({ item_date: view === 'day' ? anchor : today })}>
            新增項目
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <Tabs
          ariaLabel="檢視"
          items={[
            { value: 'day', label: '日' },
            { value: 'week', label: '週' },
            { value: 'month', label: '月' },
          ]}
          value={view}
          onChange={(v) => setNav(v, anchor)}
          className="min-w-[180px]"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" iconOnly aria-label="上一頁" onClick={() => setNav(view, shiftAnchor(view, anchor, -1))} icon={<ChevronLeft size={18} />} />
          <Button variant="secondary" size="sm" onClick={() => setNav(view, today)}>
            今天
          </Button>
          <Button variant="ghost" size="sm" iconOnly aria-label="下一頁" onClick={() => setNav(view, shiftAnchor(view, anchor, 1))} icon={<ChevronRight size={18} />} />
          <h2 className="tabular ml-2 font-mono text-base font-semibold sm:text-lg" aria-live="polite">
            {viewTitle(view, anchor)}
          </h2>
          {range.isFetching && <Spinner size={14} />}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="依顏色標籤篩選">
        <span className="label-caps mr-1 text-[11px] text-text-3">篩選</span>
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={!hidden.includes(t.id)}
            onClick={() => toggleTag(t.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors',
              hidden.includes(t.id) ? 'border-dashed border-line-soft text-text-3 line-through' : 'border-line bg-surface-2 text-text',
            )}
          >
            <span
              className="size-2 rounded-full border"
              style={hidden.includes(t.id) ? { borderColor: t.color } : { background: t.color, borderColor: t.color }}
            />
            {t.name}
          </button>
        ))}
        {hidden.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setHidden([]); try { localStorage.removeItem(FILTER_KEY) } catch { /* ignore */ } }}>
            顯示全部
          </Button>
        )}
      </div>

      {range.error && <Alert tone="danger" className="mb-4">讀取失敗：{(range.error as Error).message}</Alert>}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        {view === 'week' && <WeekView {...viewProps} />}
        {view === 'month' && <MonthView {...viewProps} />}
        {view === 'day' && <DayView {...viewProps} />}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="w-56 rotate-2">
              <ItemCard item={dragging} checklist={checklists.get(dragging.id)} overlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {view !== 'day' && <p className="mt-4 text-xs text-text-3">拖移項目可改日期（手機請長按後拖移）；拖移過的模板任務之後不會被錨點重算覆蓋。</p>}
    </>
  )
}
