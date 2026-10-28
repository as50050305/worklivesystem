import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Input, Select } from '@/components/ui'
import { useClients } from '@/data/clientHooks'
import { useOptionSet, useProjects } from '@/data/projectHooks'
import { useBusinessProfile, useQuoteMutations } from '@/data/quoteHooks'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

/** 新增報價單：選客戶／專案後直接進入編輯頁；條件預設值來自「設定 → 報價與合約」 */
export function QuoteCreateDialog({ onClose, clientId: presetClient, projectId: presetProject }: { onClose: () => void; clientId?: string; projectId?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const nav = useNavigate()
  const online = useOnline()
  const today = useToday()
  const clients = useClients()
  const projects = useProjects()
  const statuses = useOptionSet('quote_status')
  const { profile } = useBusinessProfile()
  const { create } = useQuoteMutations()
  const [clientId, setClientId] = useState(presetClient ?? '')
  const [projectId, setProjectId] = useState(presetProject ?? '')
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  // 專案選單：未選客戶時顯示全部；選了客戶時顯示該客戶的專案與尚未指定客戶的專案
  const projectOptions = (projects.data ?? []).filter((p) => !clientId || !p.client_id || p.client_id === clientId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!clientId && !title.trim()) return setErr('請選擇客戶或輸入標題')
    try {
      const q = await create.mutateAsync({
        client_id: clientId || null,
        project_id: projectId || null,
        title: title.trim() || null,
        issued_on: today,
        currency: profile.default_currency,
        tax_percent: profile.default_tax_percent,
        deposit_percent: profile.default_deposit_percent,
        revision_count: profile.default_revision_count,
        license_scope: profile.default_license_scope || null,
        delivery_terms: profile.default_delivery_terms || null,
        note: profile.default_note || null,
        status_id: statuses.byKey('draft')?.id ?? null,
      })
      onClose()
      nav(`/quotes/${q.id}`)
    } catch {
      /* 全域錯誤列 */
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="create-quote-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="card elev-2 m-auto max-h-[calc(100dvh-32px)] w-[min(520px,calc(100vw-32px))] overflow-y-auto p-6 text-text backdrop:bg-[var(--c-backdrop)] sm:p-8"
    >
      <form onSubmit={submit} className="space-y-5">
        <h2 id="create-quote-title" className="text-xl font-semibold">
          新增報價單
        </h2>
        <Select label="客戶" value={clientId} onChange={(e) => setClientId(e.target.value)} autoFocus>
          <option value="">（不指定）</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </Select>
        <Select label="專案" value={projectId} onChange={(e) => setProjectId(e.target.value)} help="可留空；成交時會自動建立專案">
          <option value="">（不指定）</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input label="標題（選填）" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：2027 春季包裝插畫" />
        <p className="text-xs text-text-2">版本號會依「客戶＋專案」自動遞增。稅率、訂金比例等預設值可在 設定 → 報價與合約 修改。</p>
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" bracket loading={create.isPending} disabled={!online}>
            建立
          </Button>
        </div>
      </form>
    </dialog>
  )
}
