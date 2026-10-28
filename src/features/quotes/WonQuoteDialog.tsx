import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button, Radio } from '@/components/ui'
import { useClientActions } from '@/data/clientHooks'
import { keyOf } from '@/data/clientRules'
import { useOptions } from '@/data/projectHooks'
import { useQuoteLineNames, useQuoteMutations, useQuotes } from '@/data/quoteHooks'
import type { Client, Quote } from '@/data/types'
import { formatDate } from '@/lib/dates'
import { formatAmount } from '@/lib/quotes'
import type { RuleResult } from '@/lib/followup'
import { quoteNo } from './shared'

function WonQuoteDialog({ client, quotes, onPick, onClientOnly, onCancel }: { client: Client; quotes: Quote[]; onPick: (q: Quote) => void; onClientOnly: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const names = useQuoteLineNames()
  const [picked, setPicked] = useState(quotes[0]?.id ?? '')
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="card elev-2 m-auto w-[min(480px,calc(100vw-32px))] p-6 text-text backdrop:bg-[var(--c-backdrop)]"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        「{client.name}」成交的是哪一張報價單？
      </h2>
      <p className="mt-2 text-sm text-text-2">選擇後該報價單會標記為成交；若報價單沒有關聯專案，會自動建立「商業插畫案」專案。</p>
      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">已寄出的報價單</legend>
        {quotes.map((q) => (
          <label key={q.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-soft p-3 has-[:checked]:border-primary-ink has-[:checked]:bg-primary-soft">
            <Radio name="won-quote" checked={picked === q.id} onChange={() => setPicked(q.id)} aria-label={quoteNo(q, client)} />
            <span className="min-w-0 flex-1 text-sm">
              <span className="tabular font-mono">{quoteNo(q, client)}</span>
              <span className="ml-2 text-text-2">{q.title ?? names.data?.[q.id]?.join('、') ?? ''}</span>
              <span className="tabular mt-0.5 block font-mono text-xs text-text-2">
                {formatDate(q.issued_on)}　{q.currency} {formatAmount(Number(q.total), q.currency)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={onClientOnly}>只更新客戶</Button>
        <Button
          variant="primary"
          bracket
          disabled={!picked}
          onClick={() => {
            const q = quotes.find((x) => x.id === picked)
            if (q) onPick(q)
          }}
        >
          標記成交
        </Button>
      </div>
    </dialog>
  )
}

/**
 * 改銷售流程（客戶頁、客戶看板共用）
 * A-7 反向：手動改成「成交」且有「已寄出」報價單 → 先詢問成交的是哪一張
 */
export function useSalesStageChange(onResult: (r: RuleResult) => void): { change: (c: Client, stageId: string | null, today: string) => Promise<void>; dialog: ReactNode } {
  const actions = useClientActions()
  const { data: options = [] } = useOptions()
  const quotes = useQuotes()
  const { markWon } = useQuoteMutations()
  const [ask, setAsk] = useState<{ client: Client; stageId: string | null; today: string; quotes: Quote[] } | null>(null)

  const change = async (c: Client, stageId: string | null, today: string) => {
    if (keyOf(options, stageId) === 'won') {
      const sent = (quotes.data ?? []).filter((q) => q.client_id === c.id && keyOf(options, q.status_id) === 'sent')
      if (sent.length) {
        setAsk({ client: c, stageId, today, quotes: sent })
        return
      }
    }
    onResult(await actions.changeSalesStage(c, stageId, today))
  }

  const dialog = ask && (
    <WonQuoteDialog
      client={ask.client}
      quotes={ask.quotes}
      onCancel={() => setAsk(null)}
      onClientOnly={async () => {
        const a = ask
        setAsk(null)
        onResult(await actions.changeSalesStage(a.client, a.stageId, a.today))
      }}
      onPick={async (q) => {
        setAsk(null)
        const r = await markWon.mutateAsync(q)
        onResult({ ok: true, patch: {}, message: r.createdProject ? `已成交：${quoteNo(q, ask.client)} 標記為成交，並建立專案「${r.project?.name}」` : `已成交：${quoteNo(q, ask.client)} 標記為成交` })
      }}
    />
  )
  return { change, dialog }
}
