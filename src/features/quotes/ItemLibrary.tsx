import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Alert, Button, Card, ConfirmDialog, EmptyState, Input } from '@/components/ui'
import { useQuoteItemMutations, useQuoteItems } from '@/data/quoteHooks'
import type { QuoteItem } from '@/data/types'
import { formatAmount } from '@/lib/quotes'
import { useOnline } from '@/pwa/useOnline'
import { DraftInput, parseNumber } from './shared'

/** 品項庫：常用品項與預設單價，報價時可一鍵帶入再修改 */
export function ItemLibrary() {
  const online = useOnline()
  const q = useQuoteItems()
  const m = useQuoteItemMutations()
  const items = q.data ?? []
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<QuoteItem | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('請輸入品項名稱')
    const p = parseNumber(price)
    if (price.trim() && p === null) return setErr('單價請輸入數字')
    await m.create.mutateAsync({ name: name.trim(), unit_price: p ?? 0, note: null, sort_order: items.length + 1 })
    setName('')
    setPrice('')
  }
  const move = (i: number, dir: -1 | 1) => {
    const ids = items.map((x) => x.id)
    const j = i + dir
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    m.reorder.mutate(ids)
  }

  return (
    <Card title="品項庫">
      <p className="-mt-2 mb-4 text-sm text-text-2">常用品項與預設單價。在報價單按「從品項庫加入」即可帶入，帶入後仍可修改。</p>
      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState compact illustration={<BoxIllustration size={90} />} title="品項庫還是空的">先新增幾個常用品項，例如「封面插畫」「內頁插圖」。</EmptyState>
      ) : (
        <ul aria-label="品項庫">
          <li className="hidden grid-cols-[1fr_140px_1fr_auto] gap-3 pb-2 text-xs text-text-2 sm:grid">
            <span>品項</span>
            <span className="text-right">預設單價（TWD）</span>
            <span>備註</span>
            <span className="w-[108px]" />
          </li>
          {items.map((it, i) => (
            <li key={it.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-t border-dashed border-line-soft py-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-center">
              <DraftInput aria-label="品項名稱" value={it.name} disabled={!online} className="h-10" onCommit={(v) => v.trim() && m.update.mutate({ id: it.id, patch: { name: v.trim() } })} />
              <DraftInput
                aria-label={`${it.name} 的預設單價`}
                inputMode="decimal"
                value={formatAmount(it.unit_price, 'TWD')}
                disabled={!online}
                className="tabular h-10 text-right font-mono max-sm:order-3"
                onCommit={(v) => {
                  const n = parseNumber(v)
                  if (n !== null) m.update.mutate({ id: it.id, patch: { unit_price: n } })
                }}
              />
              <DraftInput aria-label="備註" placeholder="備註" value={it.note ?? ''} disabled={!online} className="h-10 max-sm:order-4" onCommit={(v) => m.update.mutate({ id: it.id, patch: { note: v.trim() || null } })} />
              <div className="flex items-center gap-1 max-sm:order-2">
                <Button variant="ghost" size="sm" iconOnly aria-label="上移" disabled={i === 0 || !online} onClick={() => move(i, -1)} icon={<ArrowUp size={15} />} />
                <Button variant="ghost" size="sm" iconOnly aria-label="下移" disabled={i === items.length - 1 || !online} onClick={() => move(i, 1)} icon={<ArrowDown size={15} />} />
                <Button variant="ghost" size="sm" iconOnly aria-label={`刪除 ${it.name}`} disabled={!online} onClick={() => setToDelete(it)} icon={<Trash2 size={15} />} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line-soft pt-5">
        <Input label="新品項" value={name} onChange={(e) => setName(e.target.value)} wrapperClassName="min-w-48 flex-1" placeholder="例如：封面插畫" />
        <Input label="單價" value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} wrapperClassName="w-36" className="tabular text-right font-mono" placeholder="0" />
        <Button type="submit" variant="primary" icon={<Plus size={15} />} loading={m.create.isPending} disabled={!online}>
          新增
        </Button>
      </form>
      {err && <Alert tone="danger" className="mt-3">{err}</Alert>}
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.name ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) m.remove.mutate(toDelete.id)
          setToDelete(null)
        }}
      >
        已經加到報價單裡的品項不受影響。
      </ConfirmDialog>
    </Card>
  )
}
