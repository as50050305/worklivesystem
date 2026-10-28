import { Bell, ChevronDown, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { LampIllustration } from '@/components/illustrations/Illustrations'
import { useClientActions, useClients } from '@/data/clientHooks'
import { keyOf } from '@/data/clientRules'
import { useCollectionMutations, useCollections } from '@/data/collectionHooks'
import { useOptions } from '@/data/projectHooks'
import { useActiveProjectsForCountdown, useChecklist, useColorTags, useSidebarTimeline, useTimelineMutations } from '@/data/hooks'
import type { ChecklistItem } from '@/data/types'
import { ItemCard } from '@/features/timeline/ItemCard'
import { cn } from '@/lib/cn'
import { diffDays, formatDate } from '@/lib/dates'
import { isReminderDue } from '@/lib/collections'
import { isDueToday } from '@/lib/followup'
import { lifeTodos, nearestCountdowns, todaySchedule } from '@/lib/sidebar'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

const COLLAPSE_KEY = 'wls.sidebar.collapsedSections'
function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function Section({ id, title, count, phase, children }: { id: string; title: string; count?: number; phase?: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed().includes(id))
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      const all = new Set(readCollapsed())
      if (next) all.add(id)
      else all.delete(id)
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...all]))
    } catch {
      /* ignore */
    }
  }
  return (
    <section className="border-t border-dashed border-line-soft py-3" aria-labelledby={`sb-${id}`}>
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="mb-1 flex w-full items-center justify-between gap-2 py-1">
        <span id={`sb-${id}`} className="label-caps text-[11px] text-text-2">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {phase && <Badge tone="lavender">{phase}</Badge>}
          {count !== undefined && count > 0 && <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-surface-2 px-1.5 font-mono text-[11px]">{count}</span>}
          <ChevronDown size={14} className={cn('text-text-3 transition-transform', collapsed && '-rotate-90')} />
        </span>
      </button>
      {!collapsed && children}
    </section>
  )
}

function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => Promise<unknown> }) {
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const online = useOnline()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const t = v.trim()
    if (!t) return
    setBusy(true)
    try {
      await onAdd(t)
      setV('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-line-soft px-2.5 focus-within:border-line">
      {busy ? <Spinner size={13} /> : <Plus size={14} className="flex-none text-text-3" />}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={online ? placeholder : '離線中無法新增'}
        disabled={!online || busy}
        aria-label={placeholder}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-3"
      />
    </form>
  )
}

export function SidebarSections() {
  const today = useToday()
  const { data: tags = [] } = useColorTags()
  const lifeTagIds = useMemo(() => tags.filter((t) => t.is_life_todo).map((t) => t.id), [tags])
  const defaultTag = tags.find((t) => t.is_default)
  const lifeSet = useMemo(() => new Set(lifeTagIds), [lifeTagIds])
  const timeline = useSidebarTimeline(today, lifeTagIds)
  const all = timeline.data?.items ?? []
  const schedule = todaySchedule(all, today, lifeSet)
  const life = lifeTodos(all, today, lifeSet)
  const checklistQ = useChecklist(all.filter((i) => i.kind === 'checklist').map((i) => i.id))
  const checklists = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>()
    for (const c of checklistQ.data ?? []) m.set(c.timeline_item_id, [...(m.get(c.timeline_item_id) ?? []), c])
    return m
  }, [checklistQ.data])
  const projects = useActiveProjectsForCountdown()
  const countdowns = nearestCountdowns(projects.data ?? [], today, 3)
  const { create } = useTimelineMutations()
  const online = useOnline()
  const collectionsQ = useCollections()
  const colM = useCollectionMutations()
  const clientsQ = useClients()
  const { data: options = [] } = useOptions()
  const clientActions = useClientActions()
  const clients = clientsQ.data ?? []
  const fkey = (id: string | null) => keyOf(options, id)
  const dueClients = clients
    .filter((c) => isDueToday({ followup_status: fkey(c.followup_status_id) as never, next_followup_on: c.next_followup_on }, today))
    .sort((a, b) => ((a.next_followup_on ?? '') < (b.next_followup_on ?? '') ? -1 : 1))
  const recontact = clients.filter((c) => fkey(c.followup_status_id) === 'recontact')
  const noShow = clients.filter((c) => c.no_show_pending)
  const reminders = (collectionsQ.data ?? []).filter((c) => isReminderDue(c, today)).sort((a, b) => ((a.remind_on ?? '') < (b.remind_on ?? '') ? -1 : 1))

  const quickAdd = (title: string, tagId: string | null | undefined) =>
    create.mutateAsync({
      input: { title, item_date: today, item_time: null, color_tag_id: tagId ?? null, kind: 'normal', content: null, recurrence: 'none', recurrence_interval: null, recurrence_unit: null },
    })

  return (
    <>
      <Section id="today" title="今日排程" count={schedule.filter((i) => !i.is_done).length}>
        {timeline.isLoading ? (
          <div className="skeleton h-8" />
        ) : schedule.length ? (
          <div className="-mx-2 space-y-0.5">
            {schedule.map((it) => (
              <ItemCard key={it.id} item={it} variant="row" checklist={checklists.get(it.id)} />
            ))}
          </div>
        ) : (
          <EmptyState compact illustration={<LampIllustration size={56} />} title="今天沒有排程" />
        )}
        <QuickAdd placeholder="快速新增到今天" onAdd={(t) => quickAdd(t, defaultTag?.id)} />
      </Section>

      <Section id="countdown" title="倒數提醒" count={countdowns.length}>
        {countdowns.length ? (
          <ul className="space-y-2">
            {countdowns.map((c) => (
              <li key={`${c.project.id}-${c.kind}`} className="flex items-center justify-between gap-3 rounded-xl border border-line-soft px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{c.project.name}</p>
                  <p className="font-mono text-[11px] text-text-2">
                    {c.label} · {formatDate(c.date)}
                  </p>
                </div>
                <p className={cn('tabular flex-none font-mono font-medium', c.countdown.kind === 'today' ? 'text-lg text-primary-ink' : 'text-2xl')}>
                  {c.countdown.kind === 'today' ? '今天' : c.countdown.days}
                  {c.countdown.kind !== 'today' && <span className="ml-0.5 text-xs text-text-2">天</span>}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-3">沒有進行中專案的截止日或活動日</p>
        )}
      </Section>

      <Section id="clients" title="待追蹤客戶" count={dueClients.length + recontact.length + noShow.length}>
        {dueClients.length + recontact.length + noShow.length === 0 ? (
          <p className="text-sm text-text-3">今天沒有要追蹤的客戶</p>
        ) : (
          <ul className="space-y-1.5">
            {noShow.map((c) => (
              <li key={`ns-${c.id}`} className="flex items-center gap-2 rounded-xl border border-dashed border-warning px-3 py-2">
                <Link to={`/clients/${c.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm hover:underline">
                    <span className="tabular mr-1 font-mono text-[11px] text-text-2">{c.code}</span>
                    {c.name}
                  </span>
                  <span className="block text-[11px] font-semibold text-warning">No show：寄追蹤信</span>
                </Link>
                <button type="button" disabled={!online} onClick={() => void clientActions.clearNoShow(c)} className="flex-none rounded-lg px-2 py-1 text-[11px] text-text-2 hover:bg-surface-2 hover:text-text" aria-label={`已寄出 ${c.name} 的追蹤信`}>
                  已寄出
                </button>
              </li>
            ))}
            {dueClients.map((c) => {
              const late = diffDays(c.next_followup_on!, today)
              return (
                <li key={`due-${c.id}`}>
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-2 rounded-xl border border-line-soft px-3 py-2 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <span className="tabular mr-1 font-mono text-[11px] text-text-2">{c.code}</span>
                        {c.name}
                      </span>
                      <span className={cn('block text-[11px]', late > 0 ? 'font-semibold text-danger' : 'text-text-2')}>
                        第 {c.followup_count + 1} 次追蹤{late > 0 ? `・逾期 ${late} 天` : '・今天'}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
            {recontact.map((c) => (
              <li key={`re-${c.id}`}>
                <Link to={`/clients/${c.id}`} className="flex items-center gap-2 rounded-xl border border-primary-ink/60 px-3 py-2 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span className="tabular mr-1 font-mono text-[11px] text-text-2">{c.code}</span>
                      {c.name}
                    </span>
                    <span className="block text-[11px] text-primary-ink">可重新聯絡・第 {c.round} 輪</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="life" title="生活代辦" count={life.filter((i) => !i.is_done).length}>
        {lifeTagIds.length === 0 ? (
          <p className="text-sm text-text-3">
            尚未有標籤列入生活代辦，可到
            <Link to="/settings?tab=tags" className="mx-1 underline decoration-dotted underline-offset-4">
              設定 → 顏色標籤
            </Link>
            開啟。
          </p>
        ) : (
          <>
            {life.length ? (
              <div className="-mx-2 space-y-0.5">
                {life.map((it) => {
                  const late = diffDays(it.item_date, today)
                  return (
                    <ItemCard
                      key={it.id}
                      item={it}
                      variant="row"
                      checklist={checklists.get(it.id)}
                      note={late > 0 ? <span className="font-semibold text-danger">逾期 {late} 天</span> : undefined}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-text-3">今天沒有到期的生活代辦</p>
            )}
            <QuickAdd placeholder="快速新增生活代辦" onAdd={(t) => quickAdd(t, lifeTagIds[0])} />
          </>
        )}
      </Section>

      <Section id="nextyear" title="明年提醒" count={reminders.length}>
        {reminders.length ? (
          <ul className="space-y-1.5">
            {reminders.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line-soft px-3 py-2">
                <Bell size={14} className="flex-none text-warning" aria-hidden />
                <Link to={`/collections?edit=${c.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm hover:underline">{c.name}</span>
                  <span className="tabular block font-mono text-[11px] text-text-2">提醒日 {formatDate(c.remind_on)}</span>
                </Link>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => colM.update.mutate({ id: c.id, patch: { remind_next_year: false } })}
                  className="flex-none rounded-lg px-2 py-1 text-[11px] text-text-2 hover:bg-surface-2 hover:text-text"
                  aria-label={`關閉「${c.name}」的明年提醒`}
                >
                  已處理
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-3">沒有到期的明年提醒</p>
        )}
      </Section>
    </>
  )
}
