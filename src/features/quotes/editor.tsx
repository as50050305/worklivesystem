import { ArrowDown, ArrowUp, Download, FileText, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DatePicker, Select } from '@/components/ui'
import { useClients } from '@/data/clientHooks'
import { useOptionSet, useProjects } from '@/data/projectHooks'
import { useContractMutations, useContracts, useQuoteItems, useQuoteMutations, useQuotes } from '@/data/quoteHooks'
import type { Client, Contract, Quote, QuoteLine } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatAmount, lineSubtotal, quoteTotals } from '@/lib/quotes'
import { useOnline } from '@/pwa/useOnline'
import { DraftInput, DraftTextarea, QuoteStatusBadge, parseNumber, quoteNo } from './shared'

/* ---------------- 基本資料 ---------------- */

export function QuoteBasicsCard({ quote }: { quote: Quote }) {
  const online = useOnline()
  const clients = useClients()
  const projects = useProjects()
  const currencies = useOptionSet('currency').items.map((c) => c.label)
  const m = useQuoteMutations()
  const save = (patch: Parameters<typeof m.update.mutate>[0]['patch'], recalc = false) => m.update.mutate({ id: quote.id, patch, recalc })
  const projectOptions = (projects.data ?? []).filter((p) => !quote.client_id || !p.client_id || p.client_id === quote.client_id || p.id === quote.project_id)
  return (
    <Card title="基本資料">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="客戶" value={quote.client_id ?? ''} disabled={!online} onChange={(e) => save({ client_id: e.target.value || null })}>
          <option value="">（不指定）</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </Select>
        <Select label="專案" value={quote.project_id ?? ''} disabled={!online} onChange={(e) => save({ project_id: e.target.value || null })} help="成交時若未指定，會自動建立專案">
          <option value="">（不指定）</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <DatePicker label="開立日期" value={quote.issued_on} disabled={!online} onChange={(v) => v && save({ issued_on: v })} />
        <Select label="幣別" value={quote.currency} disabled={!online} onChange={(e) => save({ currency: e.target.value }, true)} help="TWD／JPY 取整數，其他取到小數 2 位">
          {[...new Set([quote.currency, ...currencies])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  )
}

/* ---------------- 品項 ---------------- */

function LineRow({ quote, line, index, total, onMove, onDelete }: { quote: Quote; line: QuoteLine; index: number; total: number; onMove: (d: -1 | 1) => void; onDelete: () => void }) {
  const online = useOnline()
  const m = useQuoteMutations()
  const c = quote.currency
  const upd = (patch: Parameters<typeof m.updateLine.mutate>[0]['patch']) => m.updateLine.mutate({ quoteId: quote.id, id: line.id, patch })
  const num = (v: string, f: (n: number) => void) => {
    const n = parseNumber(v)
    if (n !== null) f(n)
  }
  return (
    <li
      aria-label={`品項 ${index + 1}`}
      className="grid grid-cols-[1fr_1fr_auto] gap-x-2 gap-y-2 border-t border-dashed border-line-soft py-3 sm:grid-cols-[minmax(0,1fr)_64px_112px_124px_auto] sm:items-center"
    >
      <DraftInput aria-label="品項名稱" value={line.item_name} disabled={!online} className="h-10 max-sm:col-span-3" onCommit={(v) => v.trim() && upd({ item_name: v.trim() })} />
      <span className="col-span-3 -mb-1 text-[11px] text-text-2 sm:hidden">數量 × 單價 ＝ 小計</span>
      <DraftInput aria-label="數量" inputMode="decimal" value={String(line.quantity)} disabled={!online} className="tabular h-10 text-right font-mono" onCommit={(v) => num(v, (n) => upd({ quantity: n }))} />
      <DraftInput aria-label="單價" inputMode="decimal" value={formatAmount(line.unit_price, c)} disabled={!online} className="tabular h-10 text-right font-mono" onCommit={(v) => num(v, (n) => upd({ unit_price: n }))} />
      <div className="relative max-sm:col-span-2">
        <DraftInput
          aria-label="小計"
          title={line.subtotal_is_manual ? '手動覆寫' : '自動計算（數量 × 單價），可直接修改'}
          inputMode="decimal"
          value={formatAmount(lineSubtotal(line, c), c)}
          disabled={!online}
          className={cn('tabular h-10 text-right font-mono', line.subtotal_is_manual && 'border-warning pl-8 text-warning')}
          onCommit={(v) => num(v, (n) => upd({ subtotal: n, subtotal_is_manual: true }))}
        />
        {line.subtotal_is_manual && (
          <button
            type="button"
            className="absolute left-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-warning hover:bg-surface-2"
            aria-label="小計改回自動計算"
            title="改回自動計算"
            disabled={!online}
            onClick={() => upd({ subtotal_is_manual: false })}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-end gap-0.5">
        <Button variant="ghost" size="sm" iconOnly aria-label="上移" disabled={index === 0 || !online} onClick={() => onMove(-1)} icon={<ArrowUp size={14} />} />
        <Button variant="ghost" size="sm" iconOnly aria-label="下移" disabled={index === total - 1 || !online} onClick={() => onMove(1)} icon={<ArrowDown size={14} />} />
        <Button variant="ghost" size="sm" iconOnly aria-label={`刪除品項 ${line.item_name}`} disabled={!online} onClick={onDelete} icon={<Trash2 size={14} />} />
      </div>
    </li>
  )
}

export function QuoteLinesCard({ quote, lines, loading }: { quote: Quote; lines: QuoteLine[]; loading: boolean }) {
  const online = useOnline()
  const items = useQuoteItems()
  const m = useQuoteMutations()
  const [toDelete, setToDelete] = useState<QuoteLine | null>(null)
  const nextOrder = (lines.at(-1)?.sort_order ?? 0) + 1
  const move = (i: number, dir: -1 | 1) => {
    const ids = lines.map((l) => l.id)
    const j = i + dir
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    m.reorderLines.mutate({ quoteId: quote.id, ids })
  }
  return (
    <Card title="品項">
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      ) : (
        <ul aria-label="報價品項">
          <li className="hidden grid-cols-[minmax(0,1fr)_64px_112px_124px_auto] gap-x-2 pb-2 text-xs text-text-2 sm:grid">
            <span>品項</span>
            <span className="text-right">數量</span>
            <span className="text-right">單價</span>
            <span className="text-right">小計</span>
            <span className="w-[100px]" />
          </li>
          {lines.map((l, i) => (
            <LineRow key={l.id} quote={quote} line={l} index={i} total={lines.length} onMove={(d) => move(i, d)} onDelete={() => setToDelete(l)} />
          ))}
          {!lines.length && <li className="border-t border-dashed border-line-soft py-6 text-center text-sm text-text-2">還沒有品項，從品項庫加入或新增空白品項。</li>}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
        <select
          className="input h-10 w-auto min-w-48"
          aria-label="從品項庫加入"
          value=""
          disabled={!online || !items.data?.length}
          onChange={(e) => {
            const it = items.data?.find((x) => x.id === e.target.value)
            if (it) m.addLine.mutate({ quoteId: quote.id, line: { item_name: it.name, unit_price: it.unit_price, quantity: 1, sort_order: nextOrder } })
          }}
        >
          <option value="">{items.data?.length ? '＋ 從品項庫加入…' : '品項庫是空的'}</option>
          {(items.data ?? []).map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}　{formatAmount(it.unit_price, 'TWD')}
            </option>
          ))}
        </select>
        <Button size="sm" icon={<Plus size={14} />} disabled={!online} loading={m.addLine.isPending} onClick={() => m.addLine.mutate({ quoteId: quote.id, line: { item_name: '新品項', quantity: 1, unit_price: 0, sort_order: nextOrder } })}>
          新增空白品項
        </Button>
        <Link to="/quotes?tab=items" className="text-xs text-text-2 underline decoration-dotted underline-offset-4">
          管理品項庫
        </Link>
      </div>
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除品項「${toDelete?.item_name ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) m.removeLine.mutate({ quoteId: quote.id, id: toDelete.id })
          setToDelete(null)
        }}
      />
    </Card>
  )
}

/* ---------------- 金額 ---------------- */

export function QuoteTotalsCard({ quote, lines }: { quote: Quote; lines: QuoteLine[] }) {
  const online = useOnline()
  const m = useQuoteMutations()
  const c = quote.currency
  const t = quoteTotals(quote, lines)
  const save = (patch: Parameters<typeof m.update.mutate>[0]['patch']) => m.update.mutate({ id: quote.id, patch, recalc: true })
  const pctInput = (label: string, value: number | null, onSave: (n: number | null) => void, allowEmpty: boolean) => (
    <label className="flex items-center gap-2 text-sm text-text-2">
      {label}
      <DraftInput
        aria-label={label}
        inputMode="decimal"
        value={value === null ? '' : String(Number(value))}
        disabled={!online}
        className="tabular h-8 w-16 px-2 text-right font-mono text-sm"
        onCommit={(v) => {
          const n = parseNumber(v)
          if (n === null) return allowEmpty ? onSave(null) : undefined
          if (n >= 0 && n <= 100) onSave(n)
        }}
      />
      %
    </label>
  )
  const row = (label: React.ReactNode, value: number, muted = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-sm text-text-2">{label}</dt>
      <dd className={cn('tabular font-mono', muted && 'text-text-2')}>{formatAmount(value, c)}</dd>
    </div>
  )
  return (
    <Card title="金額">
      <dl>
        {row('品項合計', t.itemsSum)}
        {row(pctInput('稅率', quote.tax_percent, (n) => save({ tax_percent: n ?? 0 }), false), t.tax, true)}
        <div className="my-3 border-y border-line py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dt className="text-sm">
              總額 <span className="text-xs text-text-2">{c}</span>
              {quote.total_is_manual && (
                <Badge tone="warning" className="ml-2">
                  手動
                </Badge>
              )}
            </dt>
            <dd className="flex items-center gap-2">
              {quote.total_is_manual && (
                <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} disabled={!online} onClick={() => save({ total_is_manual: false })} title={`自動計算為 ${formatAmount(t.autoTotal, c)}`}>
                  改回自動
                </Button>
              )}
              <DraftInput
                aria-label="總額"
                inputMode="decimal"
                value={formatAmount(t.total, c)}
                disabled={!online}
                className={cn('tabular h-11 w-40 text-right font-mono text-lg', quote.total_is_manual ? 'border-warning text-warning' : 'text-primary-ink')}
                onCommit={(v) => {
                  const n = parseNumber(v)
                  if (n !== null) save({ total: n, total_is_manual: true })
                }}
              />
            </dd>
          </div>
          {quote.total_is_manual && <p className="mt-2 text-right text-xs text-text-2">自動計算為 {formatAmount(t.autoTotal, c)}</p>}
        </div>
        {row(pctInput('訂金', quote.deposit_percent, (n) => save({ deposit_percent: n }), true), t.deposit)}
        {row('尾款', t.balance, true)}
      </dl>
    </Card>
  )
}

/* ---------------- 條款 ---------------- */

export function QuoteTermsCard({ quote }: { quote: Quote }) {
  const online = useOnline()
  const m = useQuoteMutations()
  const save = (patch: Parameters<typeof m.update.mutate>[0]['patch']) => m.update.mutate({ id: quote.id, patch })
  return (
    <Card title="條款">
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor={`lic-${quote.id}`}>
            授權範圍
          </label>
          <DraftTextarea id={`lic-${quote.id}`} rows={3} value={quote.license_scope ?? ''} disabled={!online} placeholder="例如：台灣地區包裝與電商使用，期間兩年" onCommit={(v) => save({ license_scope: v.trim() || null })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div>
            <label className="field-label" htmlFor={`rev-${quote.id}`}>
              修改次數
            </label>
            <DraftInput
              id={`rev-${quote.id}`}
              inputMode="numeric"
              value={quote.revision_count === null ? '' : String(quote.revision_count)}
              disabled={!online}
              className="tabular text-right font-mono"
              onCommit={(v) => {
                const n = parseNumber(v)
                save({ revision_count: n === null ? null : Math.max(0, Math.round(n)) })
              }}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`del-${quote.id}`}>
              交期
            </label>
            <DraftInput id={`del-${quote.id}`} value={quote.delivery_terms ?? ''} disabled={!online} placeholder="例如：簽約後 4 週交付初稿" onCommit={(v) => save({ delivery_terms: v.trim() || null })} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor={`note-${quote.id}`}>
            備註（印在報價單上）
          </label>
          <DraftTextarea id={`note-${quote.id}`} rows={2} value={quote.note ?? ''} disabled={!online} onCommit={(v) => save({ note: v.trim() || null })} />
        </div>
      </div>
    </Card>
  )
}

/* ---------------- 合約 ---------------- */

export function ContractsCard({ quote, onOpen, onDownload, downloading }: { quote: Quote; onOpen: (c: Contract | null) => void; onDownload: (c: Contract) => void; downloading: string | null }) {
  const online = useOnline()
  const q = useContracts(quote.id)
  const m = useContractMutations()
  const [toDelete, setToDelete] = useState<Contract | null>(null)
  return (
    <Card
      title="合約"
      actions={
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} disabled={!online} onClick={() => onOpen(null)}>
          產生合約
        </Button>
      }
    >
      {q.isLoading ? (
        <div className="skeleton h-10" />
      ) : !q.data?.length ? (
        <p className="text-sm text-text-2">從合約模板一鍵產生，可預覽修改後匯出 PDF。</p>
      ) : (
        <ul className="space-y-1">
          {q.data.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <FileText size={15} className="flex-none text-text-2" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(c)}>
                <span className="block truncate text-sm">{c.title}</span>
                <span className="tabular block font-mono text-[11px] text-text-2">{formatDateTime(c.updated_at)}</span>
              </button>
              <Button size="sm" variant="ghost" iconOnly aria-label={`編輯 ${c.title}`} icon={<Pencil size={14} />} onClick={() => onOpen(c)} />
              <Button size="sm" variant="ghost" iconOnly aria-label={`下載 ${c.title} PDF`} icon={<Download size={14} />} loading={downloading === c.id} onClick={() => onDownload(c)} />
              <Button size="sm" variant="ghost" iconOnly aria-label={`刪除 ${c.title}`} icon={<Trash2 size={14} />} disabled={!online} onClick={() => setToDelete(c)} />
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除合約「${toDelete?.title ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) m.remove.mutate(toDelete.id)
          setToDelete(null)
        }}
      />
    </Card>
  )
}

/* ---------------- 版本 ---------------- */

export function VersionsCard({ quote, client }: { quote: Quote; client: Client | null }) {
  const all = useQuotes()
  const statuses = useOptionSet('quote_status')
  const versions = (all.data ?? []).filter((x) => x.client_id === quote.client_id && x.project_id === quote.project_id).sort((a, b) => b.version - a.version)
  const from = quote.copied_from_id ? all.data?.find((x) => x.id === quote.copied_from_id) : undefined
  return (
    <Card title="版本">
      {from && (
        <p className="mb-3 text-xs text-text-2">
          由{' '}
          <Link className="underline decoration-dotted underline-offset-4" to={`/quotes/${from.id}`}>
            {quoteNo(from, client)}
          </Link>{' '}
          複製
        </p>
      )}
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v.id}>
            <Link to={`/quotes/${v.id}`} aria-current={v.id === quote.id ? 'page' : undefined} className={cn('flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-2', v.id === quote.id && 'bg-primary-soft')}>
              <span className="tabular font-mono">V{v.version}</span>
              <span className="tabular flex-1 font-mono text-xs text-text-2">{formatDate(v.issued_on)}</span>
              <QuoteStatusBadge option={statuses.byId(v.status_id)} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
