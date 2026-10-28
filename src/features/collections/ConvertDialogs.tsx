import { CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Checkbox, DatePicker, Input, Select } from '@/components/ui'
import { useCollectionMutations } from '@/data/collectionHooks'
import { stagesOf, useOptionSet, useStageTemplates, useTemplateTasks } from '@/data/projectHooks'
import type { ClientRow, Collection } from '@/data/types'
import { draftClientFromCollection, draftProjectFromCollection, mapToProjectType, type ProjectDraft } from '@/lib/collections'
import { planTemplateTasks, progressFromStage } from '@/lib/projects'
import { useOnline } from '@/pwa/useOnline'
import { TagPicker } from '../timeline/TagPicker'

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="card elev-2 m-auto max-h-[calc(100dvh-32px)] w-[min(640px,calc(100vw-32px))] overflow-y-auto p-6 text-text backdrop:bg-[var(--c-backdrop)] sm:p-8"
    >
      <h2 className="mb-1 text-xl font-semibold">{title}</h2>
      {children}
    </dialog>
  )
}

/** 規則 B：轉為專案（預覽可修改後再確認） */
export function ConvertToProjectDialog({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const online = useOnline()
  const collectionTypes = useOptionSet('collection_type')
  const collectionStatuses = useOptionSet('collection_status')
  const projectTypes = useOptionSet('project_type')
  const projectStatuses = useOptionSet('project_status')
  const currencies = useOptionSet('currency').items.map((c) => c.label)
  const stagesQ = useStageTemplates()
  const templatesQ = useTemplateTasks()
  const m = useCollectionMutations()

  const mapped = mapToProjectType(collectionTypes.byId(collection.type_id), projectTypes.items)
  const [d, setD] = useState<ProjectDraft>(() => draftProjectFromCollection(collection, mapped))
  const [includeCost, setIncludeCost] = useState(d.cost !== null)
  const [costAmount, setCostAmount] = useState(d.cost ? String(d.cost.amount) : '')
  const [tagId, setTagId] = useState<string | null>(null)
  const [genTasks, setGenTasks] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; tasks: number } | null>(null)
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  useEffect(() => {
    if (!d.type_id && mapped) set('type_id', mapped)
  }, [mapped, d.type_id])

  const plan = useMemo(
    () => planTemplateTasks((templatesQ.data ?? []).filter((t) => t.project_type_id === d.type_id), d, [], tagId),
    [templatesQ.data, d, tagId],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!d.name.trim()) return setErr('請輸入專案名稱')
    if (!d.type_id) return setErr('請選擇專案類型')
    const amt = Number(costAmount)
    if (includeCost && (!costAmount.trim() || !Number.isFinite(amt))) return setErr('費用需為數字')
    const stages = stagesOf(stagesQ.data, d.type_id)
    const first = stages[0]?.id ?? null
    try {
      const r = await m.toProject.mutateAsync({
        collection,
        project: {
          name: d.name.trim(),
          type_id: d.type_id,
          status_id: projectStatuses.byKey('active')?.id ?? null,
          current_stage_id: first,
          progress: progressFromStage(stages, first),
          color_tag_id: tagId,
          city: d.city,
          country: d.country,
          apply_start_on: d.apply_start_on,
          apply_deadline_on: d.apply_deadline_on,
          event_start_on: d.event_start_on,
          event_end_on: d.event_end_on,
        },
        url: d.url,
        cost: includeCost ? { item: d.cost?.item ?? '費用', amount: amt, currency: d.cost?.currency ?? collection.fee_currency ?? 'TWD' } : null,
        tasks: genTasks ? plan.create : [],
        convertedStatusId: collectionStatuses.byKey('converted')?.id ?? null,
      })
      setDone({ id: r.project.id, tasks: r.tasks })
    } catch {
      /* 全域錯誤列 */
    }
  }

  if (done) {
    return (
      <Shell title="已轉為專案" onClose={onClose}>
        <Alert tone="success" className="mt-4">
          已建立專案「{d.name}」，並產生 {done.tasks} 筆時間軸任務
          {genTasks && plan.skippedNoAnchor.length > 0 && `（略過 ${plan.skippedNoAnchor.length} 筆：錨點日期未填）`}。原收藏已標記為「已轉換」。
        </Alert>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            留在收藏庫
          </Button>
          <Link to={`/projects/${done.id}`} onClick={onClose} className="btn btn-primary btn-bracket">
            開啟專案
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title="轉為專案" onClose={onClose}>
      <p className="mb-5 text-sm text-text-2">確認要帶入的內容，可以先修改再建立。原收藏會保留，狀態改為「已轉換」。</p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="專案名稱" value={d.name} onChange={(e) => set('name', e.target.value)} />
        <Select label="專案類型" value={d.type_id ?? ''} onChange={(e) => set('type_id', e.target.value || null)} help={!mapped ? '這個收藏類型沒有對應的專案類型，請手動選擇' : '依收藏類型自動對應，決定套用哪一組階段模板'}>
          <option value="">請選擇</option>
          {projectTypes.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="開始申請日" value={d.apply_start_on} allowEmpty onChange={(v) => set('apply_start_on', v)} />
          <DatePicker label="申請截止日" value={d.apply_deadline_on} allowEmpty onChange={(v) => set('apply_deadline_on', v)} />
          <DatePicker label="活動開始日" value={d.event_start_on} allowEmpty onChange={(v) => set('event_start_on', v)} />
          <DatePicker label="活動結束日" value={d.event_end_on} allowEmpty onChange={(v) => set('event_end_on', v)} />
          <Input label="城市" value={d.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
          <Input label="國家" value={d.country ?? ''} onChange={(e) => set('country', e.target.value || null)} />
        </div>
        <Input label="網址" value={d.url ?? ''} onChange={(e) => set('url', e.target.value || null)} help="會加到專案的網址清單" />
        <div className="card-inset space-y-3 p-4">
          <Checkbox label="費用帶入為成本" checked={includeCost} onChange={(e) => setIncludeCost(e.target.checked)} />
          {includeCost && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Input aria-label="費用金額" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} inputMode="decimal" className="tabular font-mono" />
              <select
                className="input"
                aria-label="費用幣別"
                value={d.cost?.currency ?? collection.fee_currency ?? 'TWD'}
                onChange={(e) => set('cost', { item: d.cost?.item ?? '費用', amount: Number(costAmount) || 0, currency: e.target.value })}
              >
                {[...new Set([d.cost?.currency ?? collection.fee_currency ?? 'TWD', ...currencies])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <p className="field-label">顏色標籤</p>
          <TagPicker value={tagId} onChange={setTagId} />
        </div>
        <div className="card-inset p-4">
          <Checkbox label={`依階段模板產生時間軸任務（${plan.create.length} 筆）`} checked={genTasks} onChange={(e) => setGenTasks(e.target.checked)} />
          {plan.skippedNoAnchor.length > 0 && (
            <p className="mt-2 text-xs text-text-2">
              錨點日期為空，將略過 {plan.skippedNoAnchor.length} 筆：{plan.skippedNoAnchor.map((s) => s.name).join('、')}
            </p>
          )}
        </div>
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" bracket loading={m.toProject.isPending} disabled={!online}>
            建立專案
          </Button>
        </div>
      </form>
    </Shell>
  )
}

/** 規則 B：轉為客戶（僅限潛在客戶品牌） */
export function ConvertToClientDialog({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const online = useOnline()
  const collectionStatuses = useOptionSet('collection_status')
  const sales = useOptionSet('sales_stage')
  const coop = useOptionSet('cooperation_status')
  const m = useCollectionMutations()
  const init = draftClientFromCollection(collection)
  const [name, setName] = useState(init.name)
  const [website, setWebsite] = useState(init.website ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<ClientRow | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('請輸入品牌名稱')
    try {
      const c = await m.toClient.mutateAsync({
        collection,
        client: {
          name: name.trim(),
          website: website.trim() || null,
          sales_stage_id: sales.byKey('first_contact')?.id ?? null,
          cooperation_status_id: coop.byKey('unset')?.id ?? null,
        },
        convertedStatusId: collectionStatuses.byKey('converted')?.id ?? null,
      })
      setDone(c)
    } catch {
      /* 全域錯誤列 */
    }
  }

  if (done) {
    return (
      <Shell title="已轉為客戶" onClose={onClose}>
        <Alert tone="success" className="mt-4">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} /> 已建立客戶 <strong className="font-mono">{done.code}</strong>「{done.name}」，銷售流程為「初次接觸」。客戶頁將於 P5 完成。
          </span>
        </Alert>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            完成
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title="轉為客戶" onClose={onClose}>
      <p className="mb-5 text-sm text-text-2">帶入品牌名稱與網址建立客戶（編號自動產生）。原收藏會保留，狀態改為「已轉換」。</p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="品牌名稱" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="網址" value={website} onChange={(e) => setWebsite(e.target.value)} />
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" bracket loading={m.toClient.isPending} disabled={!online}>
            建立客戶
          </Button>
        </div>
      </form>
    </Shell>
  )
}
