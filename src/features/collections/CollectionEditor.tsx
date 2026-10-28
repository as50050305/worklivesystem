import { ArrowRightLeft, ExternalLink, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, ConfirmDialog, DatePicker, Input, Select, Switch, Textarea } from '@/components/ui'
import { useCollectionMutations } from '@/data/collectionHooks'
import { useOptionSet } from '@/data/projectHooks'
import type { Collection, CollectionInput } from '@/data/types'
import { canConvertToClient, defaultRemindDate } from '@/lib/collections'
import { formatDate } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

export type ConvertKind = 'project' | 'client'

/** 收藏的新增／編輯抽屜 */
export function CollectionEditor({
  collection,
  onClose,
  onConvert,
}: {
  collection: Collection | null
  onClose: () => void
  onConvert: (c: Collection, kind: ConvertKind) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const online = useOnline()
  const today = useToday()
  const types = useOptionSet('collection_type')
  const statuses = useOptionSet('collection_status')
  const currencies = useOptionSet('currency').items.map((c) => c.label)
  const m = useCollectionMutations()
  const c = collection

  const [f, setF] = useState<CollectionInput>(() => ({
    name: c?.name ?? '',
    url: c?.url ?? '',
    note: c?.note ?? '',
    type_id: c?.type_id ?? null,
    organizer: c?.organizer ?? '',
    city: c?.city ?? '',
    country: c?.country ?? '',
    apply_start_on: c?.apply_start_on ?? null,
    apply_deadline_on: c?.apply_deadline_on ?? null,
    event_start_on: c?.event_start_on ?? null,
    event_end_on: c?.event_end_on ?? null,
    fee_amount: c?.fee_amount ?? null,
    fee_currency: c?.fee_currency ?? 'TWD',
    requirements: c?.requirements ?? '',
    status_id: c?.status_id ?? null,
    remind_next_year: c?.remind_next_year ?? false,
    remind_on: c?.remind_on ?? null,
  }))
  const [fee, setFee] = useState(c?.fee_amount != null ? String(Number(c.fee_amount)) : '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof CollectionInput>(k: K, v: CollectionInput[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  // 新增時預設：第一個類型、觀望中
  useEffect(() => {
    setF((x) => ({
      ...x,
      type_id: x.type_id ?? types.items[0]?.id ?? null,
      status_id: x.status_id ?? statuses.byKey('watching')?.id ?? null,
    }))
  }, [types.items.length, statuses.items.length])

  const type = types.byId(f.type_id)
  const busy = m.create.isPending || m.update.isPending

  const toPatch = (): CollectionInput | null => {
    setError(null)
    if (!f.name.trim()) {
      setError('請輸入名稱')
      return null
    }
    const n = fee.trim() === '' ? null : Number(fee)
    if (n !== null && !Number.isFinite(n)) {
      setError('費用需為數字')
      return null
    }
    let url = (f.url ?? '').trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)
    return {
      ...f,
      name: f.name.trim(),
      url: url || null,
      note: blank(f.note),
      organizer: blank(f.organizer),
      city: blank(f.city),
      country: blank(f.country),
      requirements: blank(f.requirements),
      fee_amount: n,
      remind_on: f.remind_next_year ? (f.remind_on ?? defaultRemindDate(f as never, today)) : f.remind_on,
    }
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    const patch = toPatch()
    if (!patch) return false
    try {
      if (c) await m.update.mutateAsync({ id: c.id, patch })
      else await m.create.mutateAsync(patch)
      return true
    } catch {
      return false
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="collection-editor-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(560px,100vw)] max-w-none overflow-hidden border-l border-line bg-surface p-0 text-text backdrop:bg-[var(--c-backdrop)] sm:rounded-l-[var(--r-2xl)]"
    >
      <form
        onSubmit={async (e) => {
          if (await save(e)) onClose()
        }}
        className="flex h-full flex-col"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
          <div className="min-w-0">
            <p className="label-caps text-[11px] text-text-2">{c ? '編輯收藏' : '新增收藏'}</p>
            <h2 id="collection-editor-title" className="truncate text-lg font-semibold">
              {f.name || '未命名'}
            </h2>
          </div>
          <Button variant="ghost" iconOnly size="sm" aria-label="關閉" onClick={onClose} icon={<X size={18} strokeWidth={1.5} />} />
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!online && <Alert tone="warning">離線中，暫時無法儲存變更。</Alert>}
          {c && (c.converted_project_id || c.converted_client_id) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-soft p-3 text-sm">
              <Badge tone="primary">已轉換</Badge>
              {c.converted_project_id && (
                <Link to={`/projects/${c.converted_project_id}`} className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4" onClick={onClose}>
                  開啟專案 <ExternalLink size={12} />
                </Link>
              )}
              {c.converted_client_id && <span className="text-text-2">已建立客戶（客戶頁於 P5 完成）</span>}
            </div>
          )}

          <Input label="名稱" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!c} placeholder="例如：台中國際藝術駐村 2027" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="類型" value={f.type_id ?? ''} onChange={(e) => set('type_id', e.target.value || null)}>
              {types.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select label="狀態" value={f.status_id ?? ''} onChange={(e) => set('status_id', e.target.value || null)}>
              {statuses.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Input label="網址" value={f.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" inputMode="url" />
          <Input label="主辦" value={f.organizer ?? ''} onChange={(e) => set('organizer', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="城市" value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            <Input label="國家" value={f.country ?? ''} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker label="開始申請日" value={f.apply_start_on ?? null} allowEmpty onChange={(v) => set('apply_start_on', v)} />
            <DatePicker label="申請截止日" value={f.apply_deadline_on ?? null} allowEmpty onChange={(v) => set('apply_deadline_on', v)} />
            <DatePicker label="活動開始日" value={f.event_start_on ?? null} allowEmpty onChange={(v) => set('event_start_on', v)} />
            <DatePicker label="活動結束日" value={f.event_end_on ?? null} allowEmpty onChange={(v) => set('event_end_on', v)} />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <Input label="費用" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="tabular font-mono" placeholder="0" />
            <Select label="幣別" value={f.fee_currency ?? 'TWD'} onChange={(e) => set('fee_currency', e.target.value)}>
              {[...new Set([f.fee_currency ?? 'TWD', ...currencies])].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </div>
          <Textarea label="條件摘要" value={f.requirements ?? ''} onChange={(e) => set('requirements', e.target.value)} placeholder="資格、需繳交的資料…" />
          <Textarea label="筆記" value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />

          <div className="card-inset space-y-3 p-4">
            <Switch
              label="明年提醒"
              checked={Boolean(f.remind_next_year)}
              onChange={(e) => {
                const on = e.target.checked
                setF((x) => ({ ...x, remind_next_year: on, remind_on: on ? (x.remind_on ?? defaultRemindDate(x as never, today)) : x.remind_on }))
              }}
            />
            {f.remind_next_year && (
              <>
                <DatePicker label="提醒日期" value={f.remind_on ?? null} onChange={(v) => set('remind_on', v)} />
                <p className="field-help">預設為明年開始申請日的前 30 天；到期後會出現在側邊欄「明年提醒」。</p>
              </>
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line-soft px-6 py-4">
          {c && <Button variant="danger" size="sm" iconOnly aria-label="刪除收藏" disabled={!online} onClick={() => setConfirmDelete(true)} icon={<Trash2 size={15} />} />}
          {c && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowRightLeft size={14} />}
                disabled={!online || busy}
                onClick={async () => {
                  if (await save()) onConvert({ ...c, ...toPatch()! } as Collection, 'project')
                }}
              >
                轉為專案
              </Button>
              {canConvertToClient(type) && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UserPlus size={14} />}
                  disabled={!online || busy}
                  onClick={async () => {
                    if (await save()) onConvert({ ...c, ...toPatch()! } as Collection, 'client')
                  }}
                >
                  轉為客戶
                </Button>
              )}
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="primary" bracket loading={busy} disabled={!online}>
              儲存
            </Button>
          </div>
        </footer>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={`確定要刪除「${c?.name ?? ''}」？`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          if (!c) return
          await m.remove.mutateAsync(c.id)
          onClose()
        }}
      >
        {c?.converted_project_id ? '已轉換的專案不會被刪除。' : '刪除後無法復原。'}
        {c?.remind_on && <span className="block">（明年提醒 {formatDate(c.remind_on)} 也會一併移除）</span>}
      </ConfirmDialog>
    </dialog>
  )
}
