import { ExternalLink, FileText, Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, ConfirmDialog, Countdown, ProgressRing, Spinner, Switch } from '@/components/ui'
import { stagesOf, useOptionSet, useProjectAttachments, useProjectCosts, useProjectLinks, useProjectMutations, useStageTemplates } from '@/data/projectHooks'
import { projectsRepo } from '@/data/repositories/projectsRepo'
import { useClients } from '@/data/clientHooks'
import { useQuotes } from '@/data/quoteHooks'
import type { Attachment, Project, ProjectCost } from '@/data/types'
import { QuoteCreateDialog } from '@/features/quotes/QuoteCreateDialog'
import { quoteNumber } from '@/lib/quotes'
import { formatMoney, progressFromStage, sumByCurrency } from '@/lib/projects'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

/* ---------------- 進度 ---------------- */
export function ProgressCard({ project }: { project: Project }) {
  const online = useOnline()
  const stagesQ = useStageTemplates()
  const stages = stagesOf(stagesQ.data, project.type_id)
  const stageIdx = stages.findIndex((s) => s.id === project.current_stage_id)
  const { update } = useProjectMutations()
  const [manual, setManual] = useState(String(project.progress))
  useEffect(() => setManual(String(Number(project.progress))), [project.progress])
  // 開關立即反映，伺服器資料回來後同步
  const [isManual, setIsManual] = useState(project.progress_is_manual)
  useEffect(() => setIsManual(project.progress_is_manual), [project.progress_is_manual])

  const toggleManual = (on: boolean) => {
    setIsManual(on)
    // 關閉手動 → 立刻依階段重算
    update.mutate({ id: project.id, patch: on ? { progress_is_manual: true } : { progress_is_manual: false, progress: progressFromStage(stages, project.current_stage_id) } })
  }
  const saveManual = () => {
    const v = Math.max(0, Math.min(100, Number(manual)))
    if (Number.isFinite(v) && v !== Number(project.progress)) update.mutate({ id: project.id, patch: { progress: v } })
  }

  return (
    <Card title="進度">
      <div className="flex justify-center">
        <ProgressRing
          value={Number(project.progress)}
          size={210}
          label={stages[stageIdx]?.name ?? '未設定階段'}
          sublabel={stageIdx >= 0 ? `${stageIdx + 1} ／ ${stages.length} 階段` : undefined}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-soft pt-4">
        <Switch label="手動覆寫進度" checked={isManual} disabled={!online} onChange={(e) => toggleManual(e.target.checked)} />
        {isManual ? (
          <div className="flex items-center gap-2">
            <input
              className="input tabular h-9 w-20 font-mono"
              type="number"
              min={0}
              max={100}
              step={1}
              aria-label="進度百分比"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onBlur={saveManual}
              onKeyDown={(e) => e.key === 'Enter' && saveManual()}
            />
            <span className="text-sm text-text-2">%</span>
          </div>
        ) : (
          <span className="text-xs text-text-3">依階段自動計算</span>
        )}
      </div>
    </Card>
  )
}

/* ---------------- 倒數（規則 E） ---------------- */
export function CountdownCard({ project }: { project: Project }) {
  const today = useToday()
  if (!project.apply_deadline_on && !project.event_start_on) return null
  return (
    <Card title="倒數">
      <div className="grid grid-cols-2 gap-4">
        {project.apply_deadline_on && <Countdown caption="申請截止" target={project.apply_deadline_on} today={today} size="md" />}
        {project.event_start_on && <Countdown caption="活動開始" target={project.event_start_on} today={today} size="md" />}
      </div>
    </Card>
  )
}

/* ---------------- 成本 ---------------- */
function CostRow({ cost, currencies }: { cost: ProjectCost; currencies: string[] }) {
  const online = useOnline()
  const m = useProjectMutations()
  const [item, setItem] = useState(cost.item)
  const [amount, setAmount] = useState(String(cost.amount))
  useEffect(() => {
    setItem(cost.item)
    setAmount(String(cost.amount))
  }, [cost.item, cost.amount])
  return (
    <li className="grid grid-cols-[1fr_96px_84px_auto] items-center gap-2">
      <input className="input h-9 text-sm" aria-label="成本項目" value={item} disabled={!online} onChange={(e) => setItem(e.target.value)} onBlur={() => item.trim() && item !== cost.item && m.updateCost.mutate({ id: cost.id, patch: { item: item.trim() } })} />
      <input
        className="input tabular h-9 text-right font-mono text-sm"
        aria-label="金額"
        inputMode="decimal"
        value={amount}
        disabled={!online}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          const n = Number(amount)
          if (Number.isFinite(n) && n !== Number(cost.amount)) m.updateCost.mutate({ id: cost.id, patch: { amount: n } })
          else setAmount(String(cost.amount))
        }}
      />
      <select className="input h-9 px-2 text-sm" aria-label="幣別" value={cost.currency} disabled={!online} onChange={(e) => m.updateCost.mutate({ id: cost.id, patch: { currency: e.target.value } })}>
        {[...new Set([cost.currency, ...currencies])].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <Button variant="ghost" size="sm" iconOnly aria-label="刪除成本" disabled={!online} onClick={() => m.removeCost.mutate(cost.id)} icon={<Trash2 size={13} />} />
    </li>
  )
}

export function CostsCard({ project }: { project: Project }) {
  const online = useOnline()
  const costs = useProjectCosts(project.id)
  const currencies = useOptionSet('currency').items.map((c) => c.label)
  const m = useProjectMutations()
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [err, setErr] = useState<string | null>(null)
  const list = costs.data ?? []
  const totals = sumByCurrency(list)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const n = Number(amount)
    if (!item.trim()) return setErr('請輸入項目')
    if (!amount.trim() || !Number.isFinite(n)) return setErr('金額需為數字')
    await m.addCost.mutateAsync({ id: project.id, item: item.trim(), amount: n, currency, sort_order: list.length })
    setItem('')
    setAmount('')
  }

  return (
    <Card title="成本">
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((c) => (
            <CostRow key={c.id} cost={c} currencies={currencies} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">尚無成本</p>
      )}
      <form onSubmit={add} className="mt-3 grid grid-cols-[1fr_96px_84px_auto] items-center gap-2 border-t border-dashed border-line-soft pt-3">
        <input className="input h-9 text-sm" placeholder="項目，例如：攤位費" aria-label="新成本項目" value={item} onChange={(e) => setItem(e.target.value)} />
        <input className="input tabular h-9 text-right font-mono text-sm" placeholder="金額" aria-label="新成本金額" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="input h-9 px-2 text-sm" aria-label="新成本幣別" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {(currencies.length ? currencies : ['TWD']).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" iconOnly aria-label="新增成本" disabled={!online} icon={<Plus size={14} />} />
      </form>
      {err && <p className="field-error">{err}</p>}
      {totals.length > 0 && (
        <dl className="mt-4 space-y-1 rounded-xl bg-surface-3 px-4 py-3">
          {totals.map((t) => (
            <div key={t.currency} className="flex items-baseline justify-between">
              <dt className="label-caps text-[11px] text-text-2">總計 {t.currency}</dt>
              <dd className="tabular font-mono text-lg font-medium">{formatMoney(t.total, t.currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

/* ---------------- 網址 ---------------- */
export function LinksCard({ project }: { project: Project }) {
  const online = useOnline()
  const links = useProjectLinks(project.id)
  const m = useProjectMutations()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const list = links.data ?? []

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    let u = url.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    try {
      new URL(u)
    } catch {
      return setErr('網址格式不正確')
    }
    await m.addLink.mutateAsync({ id: project.id, url: u, title: title.trim() || null, sort_order: list.length })
    setUrl('')
    setTitle('')
  }

  return (
    <Card title="網址">
      {list.length > 0 ? (
        <ul className="space-y-1">
          {list.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                <ExternalLink size={13} className="flex-none text-text-2" />
                <span className="truncate">{l.title || l.url.replace(/^https?:\/\//, '')}</span>
              </a>
              <Button variant="ghost" size="sm" iconOnly aria-label="刪除網址" disabled={!online} onClick={() => m.removeLink.mutate(l.id)} icon={<Trash2 size={13} />} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">尚無網址</p>
      )}
      <form onSubmit={add} className="mt-3 space-y-2 border-t border-dashed border-line-soft pt-3">
        <input className="input h-9 text-sm" placeholder="https://…" aria-label="新網址" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex gap-2">
          <input className="input h-9 flex-1 text-sm" placeholder="名稱（選填）" aria-label="網址名稱" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" variant="secondary" size="sm" className="h-9" disabled={!online || !url.trim()} icon={<Plus size={14} />}>
            新增
          </Button>
        </div>
      </form>
      {err && <p className="field-error">{err}</p>}
    </Card>
  )
}

/* ---------------- 附件 ---------------- */
const fmtSize = (n: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

export function AttachmentsCard({ project }: { project: Project }) {
  const online = useOnline()
  const atts = useProjectAttachments(project.id)
  const m = useProjectMutations()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Attachment | null>(null)
  const list = atts.data ?? []

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setErr(null)
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) {
          setErr(`「${f.name}」超過 50 MB，未上傳`)
          continue
        }
        await m.upload.mutateAsync({ id: project.id, file: f })
      }
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const openFile = async (a: Attachment) => {
    setOpening(a.id)
    // 先開視窗（避免被瀏覽器擋彈出），再填入簽名網址
    const w = window.open('', '_blank')
    try {
      const url = await projectsRepo.signedUrl(a.storage_path)
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e) {
      w?.close()
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(null)
    }
  }

  return (
    <Card
      title="附件"
      actions={
        <Button variant="ghost" size="sm" icon={busy ? <Spinner size={13} /> : <Upload size={14} />} disabled={!online || busy} onClick={() => input.current?.click()}>
          上傳
        </Button>
      }
    >
      <input ref={input} type="file" multiple className="sr-only" aria-label="選擇附件" onChange={(e) => void upload(e.target.files)} />
      {list.length > 0 ? (
        <ul className="space-y-1">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <button type="button" onClick={() => void openFile(a)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                {opening === a.id ? <Spinner size={13} /> : a.mime_type?.startsWith('image/') ? <Paperclip size={13} className="text-text-2" /> : <FileText size={13} className="text-text-2" />}
                <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
                <span className="tabular flex-none font-mono text-[11px] text-text-3">{fmtSize(a.size_bytes)}</span>
              </button>
              <Button variant="ghost" size="sm" iconOnly aria-label={`刪除附件 ${a.file_name}`} disabled={!online} onClick={() => setToDelete(a)} icon={<Trash2 size={13} />} />
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          disabled={!online}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void upload(e.dataTransfer.files)
          }}
          className="hatch grid w-full place-items-center rounded-xl border border-dashed border-line-soft py-6 text-sm text-text-2 hover:border-line"
        >
          點擊或拖放檔案上傳（單檔 50 MB 內）
        </button>
      )}
      {err && <Alert tone="danger" className="mt-3">{err}</Alert>}
      <p className="field-help">附件存放在私有空間，以 10 分鐘有效的簽名網址開啟。</p>
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.file_name ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) m.removeAttachment.mutate(toDelete)
          setToDelete(null)
        }}
      >
        檔案會被永久刪除，無法復原。
      </ConfirmDialog>
    </Card>
  )
}

/* ---------------- 關聯 ---------------- */
export function RelationsCard({ project }: { project: Project }) {
  const online = useOnline()
  const m = useProjectMutations()
  const clients = useClients()
  const quotes = useQuotes()
  const statuses = useOptionSet('quote_status')
  const [creating, setCreating] = useState(false)
  const client = clients.data?.find((c) => c.id === project.client_id) ?? null
  const related = (quotes.data ?? []).filter((q) => q.project_id === project.id || q.id === project.quote_id)
  const codeOf = (clientId: string | null) => clients.data?.find((c) => c.id === clientId) ?? null
  return (
    <Card title="關聯">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-2">來源收藏</dt>
          <dd>
            {project.source_collection_id ? (
              <Link to={`/collections?edit=${project.source_collection_id}`} className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4">
                查看收藏 <ExternalLink size={12} />
              </Link>
            ) : (
              <span className="text-text-3">—</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-2">客戶</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {client && (
              <Link to={`/clients/${client.id}`} aria-label={`前往客戶 ${client.name}`} className="text-text-2 hover:text-text">
                <ExternalLink size={13} />
              </Link>
            )}
            <select className="input h-8 w-auto max-w-44 px-2 text-sm" aria-label="專案客戶" value={project.client_id ?? ''} disabled={!online} onChange={(e) => m.update.mutate({ id: project.id, patch: { client_id: e.target.value || null } })}>
              <option value="">（無）</option>
              {(clients.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt className="mb-1 flex items-center justify-between text-text-2">
            報價單
            <Button size="sm" variant="ghost" icon={<Plus size={13} />} disabled={!online} onClick={() => setCreating(true)}>
              新增報價單
            </Button>
          </dt>
          <dd>
            {!related.length ? (
              <span className="text-text-3">—</span>
            ) : (
              <ul className="space-y-1">
                {related.map((q) => (
                  <li key={q.id}>
                    <Link to={`/quotes/${q.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
                      <FileText size={13} className="text-text-2" />
                      <span className="tabular flex-1 font-mono text-xs">{quoteNumber(codeOf(q.client_id)?.code, q.version)}</span>
                      <Badge tone={statuses.byId(q.status_id)?.key === 'won' ? 'primary' : 'neutral'}>{statuses.byId(q.status_id)?.label ?? '—'}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      {creating && <QuoteCreateDialog clientId={project.client_id ?? undefined} projectId={project.id} onClose={() => setCreating(false)} />}
    </Card>
  )
}
