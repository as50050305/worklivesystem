import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { useOptionSet } from '@/data/projectHooks'
import type { Client } from '@/data/types'
import { cn } from '@/lib/cn'
import { diffDays, formatDate } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'
import { useSalesStageChange } from '../quotes/WonQuoteDialog'
import { CountDots, StatusBadge, followupTone } from './shared'

const NO_STAGE = '__none__'

export function ClientCard({ client, overlay = false }: { client: Client; overlay?: boolean }) {
  const today = useToday()
  const online = useOnline()
  const followups = useOptionSet('followup_status')
  const drag = useDraggable({ id: overlay ? `${client.id}:overlay` : client.id, data: { client }, disabled: overlay || !online })
  const { 'aria-disabled': _a, role: _r, ...attrs } = drag.attributes
  const late = client.next_followup_on && client.next_followup_on <= today ? diffDays(client.next_followup_on, today) : null
  return (
    <article
      ref={drag.setNodeRef}
      {...(overlay ? {} : { ...drag.listeners, ...attrs })}
      aria-label={`${client.code} ${client.name}`}
      className={cn('rounded-2xl border border-line bg-surface p-3 text-sm', online && !overlay && 'cursor-grab touch-manipulation', drag.isDragging && 'opacity-30', overlay && 'elev-1 rotate-2')}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/clients/${client.id}`} className="min-w-0 hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          <span className="tabular block font-mono text-[11px] text-text-2">{client.code}</span>
          <span className="block break-words font-medium">{client.name}</span>
        </Link>
        {client.decline_next && <Badge tone="danger">下次婉拒</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge option={followups.byId(client.followup_status_id)} tone={followupTone(followups.byId(client.followup_status_id))} />
        <CountDots count={client.followup_count} />
      </div>
      {client.next_followup_on && (
        <p className={cn('tabular mt-2 font-mono text-[11px]', late !== null ? 'font-semibold text-danger' : 'text-text-2')}>
          下次追蹤 {formatDate(client.next_followup_on)}
          {late !== null && (late === 0 ? '（今天）' : `（逾期 ${late} 天）`)}
        </p>
      )}
      {client.no_show_pending && <p className="mt-1 text-[11px] font-semibold text-warning">No show：待寄追蹤信</p>}
    </article>
  )
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section ref={setNodeRef} aria-label={title} className={cn('flex w-60 flex-none flex-col rounded-[var(--r-xl)] border border-dashed border-line-soft bg-surface-3/40', isOver && 'border-primary-ink bg-primary-soft')}>
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <h3 className="label-caps text-[11px] text-text-2">{title}</h3>
        <span className="tabular font-mono text-[11px] text-text-3">{count}</span>
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  )
}

/** 看板：依銷售流程分欄，拖移即改流程（No show、成交會觸發規則 A） */
export function ClientBoard({ clients, onRuleMessage }: { clients: Client[]; onRuleMessage: (m: string) => void }) {
  const today = useToday()
  const stages = useOptionSet('sales_stage')
  const stage = useSalesStageChange((r) => {
    if (!r.ok) onRuleMessage(r.reason)
    else if (r.message) onRuleMessage(r.message)
  })
  const [dragging, setDragging] = useState<Client | null>(null)
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), useSensor(KeyboardSensor))
  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const c = e.active.data.current?.client as Client | undefined
    const to = e.over?.id as string | undefined
    if (!c || !to) return
    const stageId = to === NO_STAGE ? null : to
    if (stageId === c.sales_stage_id) return
    await stage.change(c, stageId, today)
  }
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging((e.active.data.current?.client as Client) ?? null)} onDragEnd={(e) => void onDragEnd(e)} onDragCancel={() => setDragging(null)}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {[...(clients.some((c) => !stages.byId(c.sales_stage_id)) ? [{ id: NO_STAGE, label: '未設定' }] : []), ...stages.items].map((s) => {
          const items = clients.filter((c) => (s.id === NO_STAGE ? !stages.byId(c.sales_stage_id) : c.sales_stage_id === s.id))
          return (
            <Column key={s.id} id={s.id} title={s.label} count={items.length}>
              {items.map((c) => (
                <ClientCard key={c.id} client={c} />
              ))}
            </Column>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <ClientCard client={dragging} overlay />}</DragOverlay>
      {stage.dialog}
    </DndContext>
  )
}
