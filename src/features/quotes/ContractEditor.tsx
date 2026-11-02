import { Download, RefreshCw, RotateCcw, Save, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Input, Select, Tabs } from '@/components/ui'
import { useBusinessProfile, useContractMutations, useContractTemplates, useCustomVariables } from '@/data/quoteHooks'
import type { Client, Contract, Quote, QuoteLine } from '@/data/types'
import { CONTRACT_VARIABLES, contractValues, mergeVariableValues, missingVariables, quoteTotals, renderContract, variablesIn } from '@/lib/quotes'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'
import { quoteNo } from './shared'

export interface ContractEditorProps {
  quote: Quote
  client: Client | null
  lines: QuoteLine[]
  /** 既有合約；null 表示由模板新產生 */
  contract: Contract | null
  onClose: () => void
  onDownload: (c: { title: string; body: string }) => Promise<void>
}

/** 由報價單一鍵產生合約：選模板 → 代入變數 → 預覽／修改 → 儲存、匯出 PDF */
export function ContractEditor({ quote, client, lines, contract, onClose, onDownload }: ContractEditorProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const online = useOnline()
  const today = useToday()
  const templates = useContractTemplates()
  const { profile } = useBusinessProfile()
  const { variables: custom } = useCustomVariables()
  const m = useContractMutations()
  const [saved, setSaved] = useState<Contract | null>(contract)
  const [templateId, setTemplateId] = useState<string>(contract?.template_id ?? '')
  const [title, setTitle] = useState(contract?.title ?? '')
  const [body, setBody] = useState(contract?.body ?? '')
  const [dirty, setDirty] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  /** 這份合約手動修改的變數值（只影響這份合約） */
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const number = quoteNo(quote, client)
  const auto = useMemo(() => {
    const t = quoteTotals(quote, lines)
    return contractValues({
      clientName: client?.name ?? null,
      quoteNumber: number,
      version: quote.version,
      currency: quote.currency,
      total: t.total,
      deposit: t.deposit,
      depositPercent: quote.deposit_percent,
      licenseScope: quote.license_scope,
      revisionCount: quote.revision_count,
      deliveryTerms: quote.delivery_terms,
      myName: profile.name,
      today,
    })
  }, [quote, lines, client, number, profile.name, today])
  const values = useMemo(() => mergeVariableValues(auto, custom, overrides), [auto, custom, overrides])

  const apply = (id: string) => {
    const t = templates.data?.find((x) => x.id === id)
    if (!t) return
    setTemplateId(t.id)
    setTitle(`${number} ${t.name.replace(/（預設）$/, '')}`)
    setBody(renderContract(t.body, values))
    setDirty(true)
  }

  /** 只把目前內文中還沒代入的 {{變數}} 換成值，保留已手動修改的文字 */
  const fillBody = () => {
    const next = renderContract(body, values)
    if (next !== body) {
      setBody(next)
      setDirty(true)
    }
  }

  const template = templates.data?.find((x) => x.id === templateId)
  const varNames = useMemo(
    () => [...new Set<string>([...CONTRACT_VARIABLES, ...custom.map((c) => c.name), ...variablesIn(template?.body ?? ''), ...variablesIn(body)])],
    [custom, template?.body, body],
  )
  const customNames = new Set(custom.map((c) => c.name))
  const defaultOf = (name: string) => mergeVariableValues(auto, custom, {})[name] ?? ''

  // 新合約：模板載入後自動套用預設模板
  useEffect(() => {
    if (contract || templateId || !templates.data?.length) return
    apply((templates.data.find((t) => t.is_default) ?? templates.data[0]!).id)
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.data])

  const missing = missingVariables(body, {})
  const [varsOpen, setVarsOpen] = useState(false)

  const save = async (): Promise<Contract | null> => {
    if (!title.trim()) {
      setMsg('請輸入合約名稱')
      return null
    }
    setMsg(null)
    if (saved) {
      if (dirty) await m.update.mutateAsync({ id: saved.id, patch: { title: title.trim(), body } })
      setDirty(false)
      return saved
    }
    const c = await m.create.mutateAsync({ quote_id: quote.id, template_id: templateId || null, title: title.trim(), body })
    setSaved(c)
    setDirty(false)
    return c
  }

  const download = async () => {
    setBusy(true)
    try {
      if (online && (dirty || !saved)) await save()
      await onDownload({ title: title.trim() || '合約', body })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="contract-editor-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="card elev-2 m-auto flex max-h-[calc(100dvh-32px)] w-[min(880px,calc(100vw-32px))] flex-col overflow-hidden p-0 text-text backdrop:bg-[var(--c-backdrop)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
        <h2 id="contract-editor-title" className="text-lg font-semibold">
          {saved ? '編輯合約' : '產生合約'} <span className="tabular ml-1 font-mono text-sm text-text-2">{number}</span>
        </h2>
        <Tabs
          ariaLabel="合約檢視"
          items={[
            { value: 'edit', label: '編輯' },
            { value: 'preview', label: '預覽' },
          ]}
          value={view}
          onChange={setView}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Input label="合約名稱" value={title} onChange={(e) => (setTitle(e.target.value), setDirty(true))} />
          <Select label="模板" value={templateId} onChange={(e) => setTemplateId(e.target.value)} wrapperClassName="sm:w-56">
            <option value="">（未使用模板）</option>
            {(templates.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button icon={<RefreshCw size={14} />} disabled={!templateId} onClick={() => apply(templateId)} title="以選擇的模板重新產生內文（會取代目前內文）">
            套用模板
          </Button>
        </div>

        <details
          className="card-inset mt-4 p-0"
          open={varsOpen || missing.length > 0}
          onToggle={(e) => setVarsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            變數值 <span className="ml-1 text-xs font-normal text-text-2">可修改這份合約要代入的值，改完按「代入內文」或「套用模板」</span>
          </summary>
          <div className="border-t border-dashed border-line-soft px-4 pb-4 pt-3">
            <ul aria-label="變數值" className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {varNames.map((name) => {
                const overridden = Object.hasOwn(overrides, name)
                const current = overridden ? overrides[name]! : defaultOf(name)
                return (
                  <li key={name} className="flex min-w-0 items-center gap-2">
                    <label className="w-28 flex-none truncate font-mono text-[12px] text-text-2" htmlFor={`var-${name}`} title={`{{${name}}}`}>
                      {name}
                      {customNames.has(name) && <span className="ml-1 text-[10px] text-primary-ink">自訂</span>}
                      {!customNames.has(name) && !(CONTRACT_VARIABLES as readonly string[]).includes(name) && <span className="ml-1 text-[10px] text-warning">未定義</span>}
                    </label>
                    <input
                      id={`var-${name}`}
                      className="input h-9 min-w-0 flex-1 text-sm"
                      value={current}
                      placeholder="（沒有資料）"
                      onChange={(e) => setOverrides((o) => ({ ...o, [name]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="flex-none rounded-lg p-1.5 text-text-3 hover:bg-surface-2 hover:text-text disabled:invisible"
                      disabled={!overridden}
                      aria-label={`還原 ${name} 的值`}
                      title="還原為自動帶入的值"
                      onClick={() =>
                        setOverrides((o) => {
                          const { [name]: _, ...rest } = o
                          return rest
                        })
                      }
                    >
                      <RotateCcw size={13} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-text-2">要新增常用變數，請到 設定 → 報價與合約 →「自訂變數」。</span>
              <Button size="sm" icon={<Wand2 size={14} />} onClick={fillBody} title="把內文中還沒代入的 {{變數}} 換成上面的值，不影響已修改的文字">
                代入內文
              </Button>
            </div>
          </div>
        </details>

        {missing.length > 0 && (
          <Alert tone="warning" className="mt-4">
            尚未代入：{missing.map((v) => `{{${v}}}`).join('、')}。可在上方「變數值」填入後按「代入內文」，或直接修改內文。
          </Alert>
        )}

        {view === 'edit' ? (
          <textarea
            aria-label="合約內文"
            className="input mt-4 min-h-[48vh] w-full font-[var(--ff-cjk)] text-sm leading-7"
            value={body}
            onChange={(e) => (setBody(e.target.value), setDirty(true))}
          />
        ) : (
          <article aria-label="合約預覽" className="paper mt-4 min-h-[48vh] whitespace-pre-wrap rounded-[var(--r-md)] border border-line px-6 py-8 text-[14px] leading-7 sm:px-12">
            {body}
          </article>
        )}
        {msg && (
          <Alert tone="danger" className="mt-4">
            {msg}
          </Alert>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft px-5 py-4 sm:px-6">
        <span className="mr-auto text-xs text-text-2">{dirty ? '有未儲存的修改' : saved ? '已儲存' : ''}</span>
        <Button variant="ghost" onClick={onClose}>
          關閉
        </Button>
        <Button icon={<Save size={14} />} loading={m.create.isPending || m.update.isPending} disabled={!online || (!dirty && Boolean(saved))} onClick={() => void save()}>
          儲存
        </Button>
        <Button variant="primary" bracket icon={<Download size={14} />} loading={busy} onClick={() => void download()}>
          下載 PDF
        </Button>
      </footer>
    </dialog>
  )
}
