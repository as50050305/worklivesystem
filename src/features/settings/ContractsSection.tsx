import { Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, ConfirmDialog, Input, Textarea } from '@/components/ui'
import { useOptionSet } from '@/data/projectHooks'
import { useBusinessMutation, useBusinessProfile, useContractTemplateMutations, useContractTemplates } from '@/data/quoteHooks'
import type { ContractTemplate } from '@/data/types'
import { CONTRACT_VARIABLES, type BusinessProfileLike } from '@/lib/quotes'
import { cn } from '@/lib/cn'
import { useOnline } from '@/pwa/useOnline'
import { parseNumber } from '../quotes/shared'

/* ---------------- 報價方資料 ---------------- */

function BusinessCard() {
  const { profile, isLoading } = useBusinessProfile()
  if (isLoading)
    return (
      <Card title="報價方資料與預設值">
        <div className="skeleton h-48" />
      </Card>
    )
  return <BusinessForm initial={profile} />
}

/** 等設定載入後才掛上表單，避免使用者輸入被載入的資料蓋掉 */
function BusinessForm({ initial }: { initial: BusinessProfileLike }) {
  const online = useOnline()
  const save = useBusinessMutation()
  const currencies = useOptionSet('currency').items.map((c) => c.label)
  const [f, setF] = useState<BusinessProfileLike>(initial)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof BusinessProfileLike>(k: K, v: BusinessProfileLike[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setSaved(false)
  }
  const pct = (s: string) => {
    const n = parseNumber(s)
    return n === null ? 0 : Math.min(100, Math.max(0, n))
  }

  return (
    <Card title="報價方資料與預設值">
      <p className="-mt-2 mb-5 text-sm text-text-2">印在報價單上的名稱與聯絡方式，以及新報價單的預設條件。合約中的 {'{{我的名稱}}'} 也會使用這裡的名稱。</p>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setErr(null)
          if (!f.name.trim()) return setErr('請輸入名稱')
          await save.mutateAsync({ ...f, name: f.name.trim() })
          setSaved(true)
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="名稱（個人或工作室）" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="例如：王小明插畫工作室" />
          <Input label="Email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="電話" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="地址（選填）" value={f.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <Textarea label="匯款資訊（印在報價單底部）" rows={3} value={f.bank} onChange={(e) => set('bank', e.target.value)} placeholder={'銀行與分行代碼\n帳號\n戶名'} />
        <div className="border-t border-dashed border-line-soft pt-5">
          <p className="label-caps mb-4 text-[11px] text-text-2">新報價單預設值</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <label>
              <span className="field-label">幣別</span>
              <select className="input" value={f.default_currency} onChange={(e) => set('default_currency', e.target.value)}>
                {[...new Set([f.default_currency, ...currencies])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <Input label="稅率 %" inputMode="decimal" value={String(f.default_tax_percent)} onChange={(e) => set('default_tax_percent', pct(e.target.value))} className="tabular text-right font-mono" />
            <Input label="訂金 %" inputMode="decimal" value={String(f.default_deposit_percent)} onChange={(e) => set('default_deposit_percent', pct(e.target.value))} className="tabular text-right font-mono" />
            <Input
              label="修改次數"
              inputMode="numeric"
              value={f.default_revision_count === null ? '' : String(f.default_revision_count)}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                set('default_revision_count', n === null ? null : Math.max(0, Math.round(n)))
              }}
              className="tabular text-right font-mono"
            />
          </div>
          <div className="mt-4 grid gap-4">
            <Textarea label="授權範圍" rows={2} value={f.default_license_scope} onChange={(e) => set('default_license_scope', e.target.value)} />
            <Input label="交期" value={f.default_delivery_terms} onChange={(e) => set('default_delivery_terms', e.target.value)} />
            <Input label="報價單備註" value={f.default_note} onChange={(e) => set('default_note', e.target.value)} />
          </div>
        </div>
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary-ink">已儲存</span>}
          <Button type="submit" variant="primary" bracket loading={save.isPending} disabled={!online}>
            儲存
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ---------------- 合約模板 ---------------- */

function TemplateEditor({ template }: { template: ContractTemplate }) {
  const online = useOnline()
  const m = useContractTemplateMutations()
  const [name, setName] = useState(template.name)
  const [body, setBody] = useState(template.body)
  const [saved, setSaved] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    setName(template.name)
    setBody(template.body)
  }, [template.id, template.name, template.body])
  const dirty = name !== template.name || body !== template.body

  /** 在游標位置插入變數 */
  const insert = (v: string) => {
    const el = ta.current
    const token = `{{${v}}}`
    if (!el) return setBody((b) => b + token)
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    setSaved(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="space-y-4">
      <Input label="模板名稱" value={name} disabled={!online} onChange={(e) => (setName(e.target.value), setSaved(false))} />
      <div>
        <p className="field-label">插入變數</p>
        <div className="flex flex-wrap gap-1.5">
          {CONTRACT_VARIABLES.map((v) => (
            <button key={v} type="button" className="chip h-7 px-2.5 font-mono text-[12px]" disabled={!online} onClick={() => insert(v)}>
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>
      <Textarea ref={ta} label="內文" rows={18} className="font-[var(--ff-cjk)] text-sm leading-7" value={body} disabled={!online} onChange={(e) => (setBody(e.target.value), setSaved(false))} help="第一行會成為合約 PDF 的標題；「一、」「二、」開頭的行會排成條款標題。" />
      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && <span className="text-sm text-primary-ink">已儲存</span>}
        <Button
          variant="primary"
          bracket
          disabled={!online || !dirty || !name.trim()}
          loading={m.update.isPending}
          onClick={async () => {
            await m.update.mutateAsync({ id: template.id, patch: { name: name.trim(), body } })
            setSaved(true)
          }}
        >
          儲存模板
        </Button>
      </div>
    </div>
  )
}

function TemplatesCard() {
  const online = useOnline()
  const q = useContractTemplates()
  const m = useContractTemplateMutations()
  const list = q.data ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ContractTemplate | null>(null)
  const current = list.find((t) => t.id === selected) ?? list.find((t) => t.is_default) ?? list[0]

  return (
    <Card
      title="合約模板"
      actions={
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus size={14} />}
          disabled={!online}
          loading={m.create.isPending}
          onClick={async () => {
            const t = await m.create.mutateAsync({ name: '新合約模板', body: current?.body ?? '合約書\n\n委託方：{{客戶名稱}}\n受託方：{{我的名稱}}\n', sort_order: list.length + 1 })
            setSelected(t.id)
          }}
        >
          新增模板
        </Button>
      }
    >
      <p className="-mt-2 mb-4 text-sm text-text-2">在報價單按「產生合約」時，會用模板代入報價資料，預覽修改後再匯出 PDF。修改模板不影響已產生的合約。</p>
      {q.isLoading ? (
        <div className="skeleton h-40" />
      ) : !list.length ? (
        <p className="text-sm text-text-2">還沒有模板，按右上角「新增模板」。</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ul aria-label="模板列表" className="space-y-1">
            {list.map((t) => (
              <li key={t.id} className={cn('flex items-center gap-1 rounded-xl pr-1', current?.id === t.id && 'bg-primary-soft')}>
                <button type="button" aria-current={current?.id === t.id || undefined} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm" onClick={() => setSelected(t.id)}>
                  {t.name}
                </button>
                {t.is_default ? (
                  <Badge tone="primary">預設</Badge>
                ) : (
                  <Button size="sm" variant="ghost" iconOnly aria-label={`將 ${t.name} 設為預設`} title="設為預設" icon={<Star size={13} />} disabled={!online} onClick={() => m.setDefault.mutate(t.id)} />
                )}
                <Button size="sm" variant="ghost" iconOnly aria-label={`刪除模板 ${t.name}`} icon={<Trash2 size={13} />} disabled={!online} onClick={() => setToDelete(t)} />
              </li>
            ))}
          </ul>
          {current && <TemplateEditor key={current.id} template={current} />}
        </div>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除模板「${toDelete?.name ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) m.remove.mutate(toDelete.id)
          if (toDelete?.id === selected) setSelected(null)
          setToDelete(null)
        }}
      >
        已用這個模板產生的合約會保留。
      </ConfirmDialog>
    </Card>
  )
}

export function ContractsSection() {
  return (
    <div className="grid gap-6">
      <BusinessCard />
      <TemplatesCard />
    </div>
  )
}
