import { ArrowDown, ArrowUp, Bell, ExternalLink, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { PlantIllustration } from '@/components/illustrations/Illustrations'
import { Alert, Badge, Button, Card, EmptyState, Select, type BadgeTone } from '@/components/ui'
import { useCollections } from '@/data/collectionHooks'
import { useOptionSet } from '@/data/projectHooks'
import type { Collection, OptionItem } from '@/data/types'
import { CollectionEditor, type ConvertKind } from '@/features/collections/CollectionEditor'
import { ConvertToClientDialog, ConvertToProjectDialog } from '@/features/collections/ConvertDialogs'
import { isReminderDue, sortCollections, type SortDir, type SortKey } from '@/lib/collections'
import { cn } from '@/lib/cn'
import { countdown, formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/projects'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

function statusTone(o: OptionItem | undefined): BadgeTone {
  switch (o?.key) {
    case 'joining':
      return 'primary'
    case 'converted':
      return 'steel'
    case 'skipped':
    case 'missed':
      return 'neutral'
    case 'watching':
      return 'lavender'
    default:
      return 'mauve'
  }
}

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: 'name', label: '名稱' },
  { key: 'type', label: '類型' },
  { key: null, label: '主辦／地點' },
  { key: 'apply_deadline_on', label: '申請截止' },
  { key: 'event_start_on', label: '活動日期' },
  { key: null, label: '費用', className: 'text-right' },
  { key: 'status', label: '狀態' },
]

export function CollectionsPage() {
  const today = useToday()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const q = useCollections()
  const types = useOptionSet('collection_type')
  const statuses = useOptionSet('collection_status')
  const [search, setSearch] = useState('')
  const [converting, setConverting] = useState<{ c: Collection; kind: ConvertKind } | null>(null)

  const typeFilter = params.get('type') ?? ''
  const statusFilter = params.get('status') ?? ''
  const sortKey = (params.get('sort') as SortKey) ?? 'apply_deadline_on'
  const sortDir = (params.get('dir') as SortDir) ?? 'asc'
  const editId = params.get('edit')
  const isNew = params.get('new') === '1'
  const editing = editId ? (q.data ?? []).find((c) => c.id === editId) ?? null : null

  const labelOf = (id: string | null) => types.byId(id)?.label ?? statuses.byId(id)?.label ?? ''
  const list = useMemo(() => {
    let l = q.data ?? []
    if (typeFilter) l = l.filter((c) => c.type_id === typeFilter)
    if (statusFilter) l = l.filter((c) => c.status_id === statusFilter)
    const s = search.trim().toLowerCase()
    if (s) l = l.filter((c) => [c.name, c.organizer, c.city, c.country, c.note, c.requirements].some((x) => x?.toLowerCase().includes(s)))
    return sortCollections(l, sortKey, sortDir, labelOf)
  }, [q.data, typeFilter, statusFilter, search, sortKey, sortDir, types.items, statuses.items])

  const toggleSort = (k: SortKey) => {
    const next = new URLSearchParams(params)
    if (k === sortKey) next.set('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else {
      next.set('sort', k)
      next.set('dir', 'asc')
    }
    setParams(next, { replace: true })
  }

  const closeEditor = () => {
    const next = new URLSearchParams(params)
    next.delete('edit')
    next.delete('new')
    setParams(next, { replace: true })
  }

  const Deadline = ({ c }: { c: Collection }) => {
    if (!c.apply_deadline_on) return <span className="text-text-3">—</span>
    const cd = countdown(c.apply_deadline_on, today)
    return (
      <span className="tabular whitespace-nowrap font-mono text-[12px]">
        {formatDate(c.apply_deadline_on)}
        <span className={cn('ml-2', cd.kind === 'past' ? 'text-text-3' : cd.kind === 'today' ? 'text-primary-ink' : 'text-text-2')}>{cd.label}</span>
      </span>
    )
  }
  const EventDates = ({ c }: { c: Collection }) =>
    c.event_start_on ? (
      <span className="tabular whitespace-nowrap font-mono text-[12px]">
        {formatDate(c.event_start_on)}
        {c.event_end_on && c.event_end_on !== c.event_start_on && ` – ${formatDate(c.event_end_on).slice(5)}`}
      </span>
    ) : (
      <span className="text-text-3">—</span>
    )
  const Fee = ({ c }: { c: Collection }) => (c.fee_amount != null ? <span className="tabular font-mono text-[12px]">{formatMoney(Number(c.fee_amount), c.fee_currency ?? 'TWD')}</span> : <span className="text-text-3">—</span>)
  const NameCell = ({ c }: { c: Collection }) => (
    <span className="flex items-center gap-2">
      <button type="button" className="text-left font-medium hover:underline" onClick={() => set('edit', c.id)}>
        {c.name}
      </button>
      {c.url && (
        <a href={c.url} target="_blank" rel="noreferrer noopener" aria-label={`開啟 ${c.name} 網址`} className="text-text-3 hover:text-text">
          <ExternalLink size={12} />
        </a>
      )}
      {c.remind_next_year && (
        <span title={`明年提醒 ${formatDate(c.remind_on)}`} className={cn(isReminderDue(c, today) ? 'text-warning' : 'text-text-3')}>
          <Bell size={12} aria-label="明年提醒" />
        </span>
      )}
    </span>
  )

  return (
    <>
      <PageHeader
        title="收藏庫"
        eyebrow="Collections"
        actions={
          <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => set('new', '1')}>
            新增收藏
          </Button>
        }
      >
        展會、駐村、補助、潛在客戶品牌與研究參考。可一鍵轉為專案或客戶。
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
          <input className="input pl-10" placeholder="搜尋名稱、主辦、地點、筆記…" aria-label="搜尋收藏" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select aria-label="類型" value={typeFilter} onChange={(e) => set('type', e.target.value)} wrapperClassName="w-44">
          <option value="">全部類型</option>
          {types.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select aria-label="狀態" value={statusFilter} onChange={(e) => set('status', e.target.value)} wrapperClassName="w-40">
          <option value="">全部狀態</option>
          {statuses.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        {/* 手機排序 */}
        <Select aria-label="排序" value={`${sortKey}:${sortDir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); const n = new URLSearchParams(params); n.set('sort', k!); n.set('dir', d!); setParams(n, { replace: true }) }} wrapperClassName="w-44 md:hidden">
          <option value="apply_deadline_on:asc">申請截止（近→遠）</option>
          <option value="event_start_on:asc">活動日期（近→遠）</option>
          <option value="name:asc">名稱</option>
          <option value="updated_at:desc">最近更新</option>
        </Select>
      </div>

      {q.error && <Alert tone="danger">讀取失敗：{(q.error as Error).message}</Alert>}

      <Card padded={false} className="overflow-hidden">
        {q.isLoading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-8" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            illustration={<PlantIllustration />}
            title={q.data?.length ? '沒有符合的收藏' : '還沒有收藏'}
            action={
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => set('new', '1')} disabled={!online}>
                新增收藏
              </Button>
            }
          />
        ) : (
          <>
            {/* 桌面：表格 */}
            <div className="hidden overflow-x-auto p-2 sm:p-4 md:block">
              <table className="table">
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th key={col.label} className={col.className} aria-sort={col.key === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {col.key ? (
                          <button type="button" onClick={() => toggleSort(col.key!)} className="inline-flex items-center gap-1 uppercase hover:text-text">
                            {col.label}
                            {col.key === sortKey && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <NameCell c={c} />
                      </td>
                      <td>
                        <Badge tone="lavender">{types.byId(c.type_id)?.label ?? '—'}</Badge>
                      </td>
                      <td className="text-text-2">
                        <span className="block max-w-48 truncate">{c.organizer ?? '—'}</span>
                        <span className="block text-xs text-text-3">{[c.city, c.country].filter(Boolean).join('・')}</span>
                      </td>
                      <td>
                        <Deadline c={c} />
                      </td>
                      <td>
                        <EventDates c={c} />
                      </td>
                      <td className="text-right">
                        <Fee c={c} />
                      </td>
                      <td>
                        <Badge tone={statusTone(statuses.byId(c.status_id))}>{statuses.byId(c.status_id)?.label ?? '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 手機：卡片 */}
            <ul className="divide-y divide-dashed divide-line-soft md:hidden">
              {list.map((c) => (
                <li key={c.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <NameCell c={c} />
                    <Badge tone={statusTone(statuses.byId(c.status_id))}>{statuses.byId(c.status_id)?.label ?? '—'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2">
                    <Badge tone="lavender">{types.byId(c.type_id)?.label ?? '—'}</Badge>
                    {(c.city || c.country) && <span>{[c.city, c.country].filter(Boolean).join('・')}</span>}
                    <Fee c={c} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs">
                    <span>截止 <Deadline c={c} /></span>
                    <span>活動 <EventDates c={c} /></span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <p className="mt-3 text-xs text-text-3">共 {list.length} 筆{(q.data?.length ?? 0) !== list.length && `（全部 ${q.data?.length}）`}。點名稱可編輯、轉為專案或客戶。</p>

      {(isNew || editing) && (
        <CollectionEditor
          key={editing?.id ?? 'new'}
          collection={editing}
          onClose={closeEditor}
          onConvert={(c, kind) => {
            closeEditor()
            setConverting({ c, kind })
          }}
        />
      )}
      {converting?.kind === 'project' && <ConvertToProjectDialog collection={converting.c} onClose={() => setConverting(null)} />}
      {converting?.kind === 'client' && <ConvertToClientDialog collection={converting.c} onClose={() => setConverting(null)} />}
    </>
  )
}
