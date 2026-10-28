import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Button, Card, EmptyState, Select, Tabs } from '@/components/ui'
import { useClients } from '@/data/clientHooks'
import { useOptionSet, useProjects } from '@/data/projectHooks'
import { useQuoteLineNames, useQuotes } from '@/data/quoteHooks'
import { ItemLibrary } from '@/features/quotes/ItemLibrary'
import { QuoteCreateDialog } from '@/features/quotes/QuoteCreateDialog'
import { QuoteStatusBadge, quoteNo } from '@/features/quotes/shared'
import { formatDate } from '@/lib/dates'
import { formatAmount } from '@/lib/quotes'
import { useOnline } from '@/pwa/useOnline'

export function QuotesPage() {
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }
  const tab = params.get('tab') === 'items' ? 'items' : 'quotes'
  const status = params.get('status') ?? ''
  const quotes = useQuotes()
  const clients = useClients()
  const projects = useProjects()
  const names = useQuoteLineNames()
  const statuses = useOptionSet('quote_status')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const clientOf = (id: string | null) => clients.data?.find((c) => c.id === id) ?? null
  const projectOf = (id: string | null) => projects.data?.find((p) => p.id === id) ?? null

  const list = useMemo(() => {
    let l = quotes.data ?? []
    if (status) l = l.filter((q) => q.status_id === status)
    const s = search.trim().toLowerCase()
    if (s) {
      l = l.filter((q) => {
        const c = clientOf(q.client_id)
        return [quoteNo(q, c), c?.name, q.title, projectOf(q.project_id)?.name, ...(names.data?.[q.id] ?? [])].some((x) => x?.toLowerCase().includes(s))
      })
    }
    return l
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes.data, clients.data, projects.data, names.data, status, search])

  return (
    <>
      <PageHeader
        title="報價單"
        eyebrow="Quotes"
        actions={
          tab === 'quotes' && (
            <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => setCreating(true)}>
              新增報價單
            </Button>
          )
        }
      >
        品項小計、總額會自動計算，也都可以手動修改。狀態改為「成交」會同步客戶並自動建立專案。
      </PageHeader>
      <Tabs
        ariaLabel="報價單分類"
        items={[
          { value: 'quotes', label: '報價單' },
          { value: 'items', label: '品項庫' },
        ]}
        value={tab}
        onChange={(v) => set('tab', v === 'items' ? 'items' : '')}
        className="mb-6 max-w-xs"
      />

      {tab === 'items' ? (
        <div className="max-w-4xl">
          <ItemLibrary />
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label className="relative min-w-56 flex-1 sm:max-w-sm">
              <span className="sr-only">搜尋報價單</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-2" />
              <input className="input h-10 pl-9" placeholder="搜尋單號、客戶、品項…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select aria-label="狀態篩選" value={status} onChange={(e) => set('status', e.target.value)} className="h-10 w-36">
              <option value="">全部狀態</option>
              {statuses.items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {quotes.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16" />
              ))}
            </div>
          ) : !list.length ? (
            <Card>
              <EmptyState
                illustration={<BoxIllustration />}
                title={quotes.data?.length ? '沒有符合條件的報價單' : '還沒有報價單'}
                action={
                  !quotes.data?.length && (
                    <Button variant="primary" bracket disabled={!online} onClick={() => setCreating(true)}>
                      新增第一張報價單
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <Card padded={false}>
              <ul aria-label="報價單列表">
                <li className="hidden grid-cols-[110px_minmax(0,1fr)_110px_140px_96px] gap-4 border-b border-line-soft px-6 py-3 text-xs text-text-2 md:grid">
                  <span>單號</span>
                  <span>客戶／內容</span>
                  <span>日期</span>
                  <span className="text-right">總額</span>
                  <span>狀態</span>
                </li>
                {list.map((q) => {
                  const c = clientOf(q.client_id)
                  const desc = q.title ?? projectOf(q.project_id)?.name ?? names.data?.[q.id]?.join('、') ?? ''
                  return (
                    <li key={q.id} className="border-b border-dashed border-line-soft last:border-0">
                      <Link to={`/quotes/${q.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-4 hover:bg-surface-2 sm:px-6 md:grid-cols-[110px_minmax(0,1fr)_110px_140px_96px] md:items-center">
                        <span className="tabular font-mono text-sm">{quoteNo(q, c)}</span>
                        <span className="min-w-0 max-md:col-span-2 max-md:row-start-2">
                          <span className="block truncate">{c?.name ?? '（未指定客戶）'}</span>
                          {desc && <span className="block truncate text-xs text-text-2">{desc}</span>}
                        </span>
                        <span className="tabular font-mono text-xs text-text-2 max-md:hidden">{formatDate(q.issued_on)}</span>
                        <span className="tabular text-right font-mono max-md:row-start-3">
                          <span className="mr-1 text-[11px] text-text-2">{q.currency}</span>
                          {formatAmount(Number(q.total), q.currency)}
                        </span>
                        <span className="max-md:col-start-2 max-md:row-start-1 max-md:justify-self-end">
                          <QuoteStatusBadge option={statuses.byId(q.status_id)} />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )}
      {creating && <QuoteCreateDialog onClose={() => setCreating(false)} />}
    </>
  )
}
