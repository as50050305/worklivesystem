import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Checkbox, DatePicker, Input, Select } from '@/components/ui'
import { stagesOf, useOptionSet, useProjectMutations, useStageTemplates, useTemplateTasks } from '@/data/projectHooks'
import { planTemplateTasks, progressFromStage } from '@/lib/projects'
import { useOnline } from '@/pwa/useOnline'
import { TagPicker } from '../timeline/TagPicker'

export function ProjectCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const nav = useNavigate()
  const online = useOnline()
  const types = useOptionSet('project_type')
  const statuses = useOptionSet('project_status')
  const stages = useStageTemplates()
  const templates = useTemplateTasks()
  const { create } = useProjectMutations()

  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)
  const [applyStart, setApplyStart] = useState<string | null>(null)
  const [applyDeadline, setApplyDeadline] = useState<string | null>(null)
  const [eventStart, setEventStart] = useState<string | null>(null)
  const [eventEnd, setEventEnd] = useState<string | null>(null)
  const [genTasks, setGenTasks] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    if (!typeId && types.items[0]) setTypeId(types.items[0].id)
  }, [types.items, typeId])

  const anchors = { apply_start_on: applyStart, apply_deadline_on: applyDeadline, event_start_on: eventStart }
  const plan = useMemo(
    () => planTemplateTasks((templates.data ?? []).filter((t) => t.project_type_id === typeId), anchors, [], tagId),
    [templates.data, typeId, applyStart, applyDeadline, eventStart, tagId],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('請輸入專案名稱')
    const typeStages = stagesOf(stages.data, typeId)
    const first = typeStages[0]?.id ?? null
    try {
      const { project } = await create.mutateAsync({
        input: {
          name: name.trim(),
          type_id: typeId || null,
          status_id: statuses.byKey('active')?.id ?? null,
          current_stage_id: first,
          progress: progressFromStage(typeStages, first),
          color_tag_id: tagId,
          apply_start_on: applyStart,
          apply_deadline_on: applyDeadline,
          event_start_on: eventStart,
          event_end_on: eventEnd,
        },
        tasks: genTasks ? plan.create : [],
      })
      onClose()
      nav(`/projects/${project.id}`)
    } catch {
      /* 全域錯誤列 */
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="create-project-title"
      className="card elev-2 m-auto max-h-[calc(100dvh-32px)] w-[min(620px,calc(100vw-32px))] overflow-y-auto p-6 text-text backdrop:bg-[var(--c-backdrop)] sm:p-8"
    >
      <form onSubmit={submit} className="space-y-5">
        <h2 id="create-project-title" className="text-xl font-semibold">
          新增專案
        </h2>
        <Input label="專案名稱" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="例如：2027 台北插畫藝術節" />
        <Select label="類型" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {types.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <div>
          <p className="field-label">顏色標籤</p>
          <TagPicker value={tagId} onChange={setTagId} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label="開始申請日" value={applyStart} onChange={setApplyStart} allowEmpty />
          <DatePicker label="申請截止日" value={applyDeadline} onChange={setApplyDeadline} allowEmpty />
          <DatePicker label="活動開始日" value={eventStart} onChange={setEventStart} allowEmpty />
          <DatePicker label="活動結束日" value={eventEnd} onChange={setEventEnd} allowEmpty />
        </div>
        <div className="card-inset p-4">
          <Checkbox label={`依階段模板產生時間軸任務（${plan.create.length} 筆）`} checked={genTasks} onChange={(e) => setGenTasks(e.target.checked)} />
          {plan.skippedNoAnchor.length > 0 && (
            <p className="mt-2 text-xs text-text-2">錨點日期未填，將略過 {plan.skippedNoAnchor.length} 筆：{plan.skippedNoAnchor.map((s) => s.name).join('、')}（之後填入日期可在專案頁補產生）</p>
          )}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
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
