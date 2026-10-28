import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { useOptionSet, useProjects } from '@/data/projectHooks'
import { useQuotes } from '@/data/quoteHooks'
import type { Client, Project } from '@/data/types'
import { formatDate } from '@/lib/dates'
import { formatAmount } from '@/lib/quotes'
import { useOnline } from '@/pwa/useOnline'
import { QuoteCreateDialog } from './QuoteCreateDialog'
import { QuoteStatusBadge, quoteNo } from './shared'

/** 客戶頁：這個客戶的所有報價單 */
export function ClientQuotesCard({ client }: { client: Client }) {
  const online = useOnline()
  const quotes = useQuotes()
  const projects = useProjects()
  const statuses = useOptionSet('quote_status')
  const [creating, setCreating] = useState(false)
  const list = (quotes.data ?? []).filter((q) => q.client_id === client.id)
  const projectOf = (id: string | null): Project | undefined => projects.data?.find((p) => p.id === id)
  return (
    <Card
      title="報價單"
      actions={
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} disabled={!online} onClick={() => setCreating(true)}>
          新增
        </Button>
      }
    >
      {quotes.isLoading ? (
        <div className="skeleton h-10" />
      ) : !list.length ? (
        <p className="text-sm text-text-2">還沒有報價單。</p>
      ) : (
        <ul className="space-y-1">
          {list.map((q) => (
            <li key={q.id}>
              <Link to={`/quotes/${q.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="tabular block font-mono text-sm">{quoteNo(q, client)}</span>
                  <span className="block truncate text-xs text-text-2">
                    {formatDate(q.issued_on)}
                    {(q.title || projectOf(q.project_id)) && `　${q.title ?? projectOf(q.project_id)?.name}`}
                  </span>
                </span>
                <span className="tabular font-mono text-sm">{formatAmount(Number(q.total), q.currency)}</span>
                <QuoteStatusBadge option={statuses.byId(q.status_id)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <QuoteCreateDialog clientId={client.id} onClose={() => setCreating(false)} />}
    </Card>
  )
}
