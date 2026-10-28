import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Alert, Badge, Button, Card, EmptyState, Select, Tabs } from '@/components/ui'
import { useClients } from '@/data/clientHooks'
import { useOptionSet } from '@/data/projectHooks'
import { ClientBoard } from '@/features/clients/ClientBoard'
import { ClientCreateDialog } from '@/features/clients/ClientCreateDialog'
import { CountDots, StatusBadge, coopTone, followupTone } from '@/features/clients/shared'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

export function ClientsPage() {
  const today = useToday()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }
  const view = params.get('view') === 'table' ? 'table' : 'board'
  const q = useClients()
  const sales = useOptionSet('sales_stage')
  const coop = useOptionSet('cooperation_status')
  const fstatus = useOptionSet('followup_status')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fFilter = params.get('followup') ?? ''
  const cFilter = params.get('coop') ?? ''

  const list = useMemo(() => {
    let l = q.data ?? []
    if (fFilter) l = l.filter((c) => c.followup_status_id === fFilter)
    if (cFilter) l = l.filter((c) => c.cooperation_status_id === cFilter)
    const s = search.trim().toLowerCase()
    if (s) l = l.filter((c) => [c.code, c.name, c.email, c.phone, c.instagram, c.website].some((x) => x?.toLowerCase().includes(s)))
    return l
  }, [q.data, fFilter, cFilter, search])

  return (
    <>
      <PageHeader
        title="客戶"
        eyebrow="Clients"
        actions={
          <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => setCreating(true)}>
            新增客戶
          </Button>
        }
      >
        以品牌／公司為單位。追蹤：每輪最多 5 次、每次間隔 7 天，滿 5 次未成交會冷卻到下一季。
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <Tabs
          ariaLabel="檢視"
          items={[
            { value: 'board', label: '看板' },
            { value: 'table', label: '表格' },
          ]}
          value={view}
          onChange={(v) => set('view', v === 'board' ? '' : v)}
          className="min-w-[160px]"
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-56">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input className="input pl-10" placeholder="搜尋編號、品牌、聯絡方式" aria-label="搜尋客戶" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="追蹤狀態" value={fFilter} onChange={(e) => set('followup', e.target.value)} wrapperClassName="w-40">
            <option value="">全部追蹤狀態</option>
            {fstatus.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select aria-label="合作狀態" value={cFilter} onChange={(e) => set('coop', e.target.value)} wrapperClassName="w-40">
            <option value="">全部合作狀態</option>
            {coop.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {msg && (
        <Alert tone="info" className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => setMsg(null)}>知道了</Button>}>
          {msg}
        </Alert>
      )}
      {q.error && <Alert tone="danger">讀取失敗：{(q.error as Error).message}</Alert>}

      {q.isLoading ? (
        <div className="skeleton h-40" />
      ) : !q.data?.length ? (
        <Card>
          <EmptyState illustration={<BoxIllustration />} title="還沒有客戶" action={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)} disabled={!online}>新增客戶</Button>}>
            也可以從收藏庫把「潛在客戶品牌」轉為客戶。
          </EmptyState>
        </Card>
      ) : view === 'board' ? (
        <>
          <ClientBoard clients={list} onRuleMessage={setMsg} />
          <p className="mt-3 text-xs text-text-3">拖移卡片可改銷售流程；拖到「No show」會計一次追蹤，拖到「成交」會標記為接過案。</p>
        </>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto p-2 sm:p-4">
            <table className="table">
              <thead>
                <tr>
                  <th>編號</th>
                  <th>品牌</th>
                  <th>銷售流程</th>
                  <th>合作</th>
                  <th>追蹤狀態</th>
                  <th>本輪</th>
                  <th>下次追蹤</th>
                  <th>冷卻至</th>
                  <th>接過案</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="tabular font-mono text-text-2">{c.code}</td>
                    <td>
                      <Link to={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.decline_next && <Badge tone="danger" className="ml-2">下次婉拒</Badge>}
                    </td>
                    <td className="whitespace-nowrap">{sales.byId(c.sales_stage_id)?.label ?? '—'}</td>
                    <td>
                      <StatusBadge option={coop.byId(c.cooperation_status_id)} tone={coopTone(coop.byId(c.cooperation_status_id))} />
                    </td>
                    <td>
                      <StatusBadge option={fstatus.byId(c.followup_status_id)} tone={followupTone(fstatus.byId(c.followup_status_id))} />
                    </td>
                    <td className="whitespace-nowrap">
                      <CountDots count={c.followup_count} /> <span className="tabular ml-1 font-mono text-[11px] text-text-3">第 {c.round} 輪</span>
                    </td>
                    <td className={cn('tabular whitespace-nowrap font-mono text-[12px]', c.next_followup_on && c.next_followup_on <= today && 'font-semibold text-danger')}>{formatDate(c.next_followup_on) || '—'}</td>
                    <td className="tabular whitespace-nowrap font-mono text-[12px] text-text-2">{formatDate(c.cooldown_until) || '—'}</td>
                    <td>{c.has_worked_together ? '是' : '否'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {creating && <ClientCreateDialog onClose={() => setCreating(false)} />}
    </>
  )
}
