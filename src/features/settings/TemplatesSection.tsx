import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Card } from '@/components/ui'
import { useColorTags } from '@/data/hooks'
import { stagesOf, useOptionSet, useStageTemplates, useTemplateMutations, useTemplateTasks } from '@/data/projectHooks'
import type { AnchorKind, TemplateTask } from '@/data/types'
import { cn } from '@/lib/cn'
import { ANCHOR_LABEL, describeOffset } from '@/lib/projects'
import { useOnline } from '@/pwa/useOnline'
import { OrderedListEditor } from './OrderedListEditor'

const ANCHORS = Object.keys(ANCHOR_LABEL) as AnchorKind[]

function TaskRow({ task }: { task: TemplateTask }) {
  const online = useOnline()
  const { data: tags = [] } = useColorTags()
  const m = useTemplateMutations()
  const [name, setName] = useState(task.name)
  const [offset, setOffset] = useState(String(task.offset_days))
  useEffect(() => {
    setName(task.name)
    setOffset(String(task.offset_days))
  }, [task.name, task.offset_days])
  const upd = (patch: Parameters<typeof m.updateTask.mutate>[0]['patch']) => m.updateTask.mutate({ id: task.id, patch })
  return (
    <tr>
      <td>
        <input className="input h-9 min-w-36 text-sm" aria-label="任務名稱" value={name} disabled={!online} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== task.name && upd({ name: name.trim() })} />
      </td>
      <td>
        <select className="input h-9 min-w-32 text-sm" aria-label="錨點" value={task.anchor} disabled={!online} onChange={(e) => upd({ anchor: e.target.value as AnchorKind })}>
          {ANCHORS.map((a) => (
            <option key={a} value={a}>
              {ANCHOR_LABEL[a]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="input tabular h-9 w-24 text-right font-mono text-sm"
          aria-label="偏移天數"
          type="number"
          step={1}
          value={offset}
          disabled={!online}
          onChange={(e) => setOffset(e.target.value)}
          onBlur={() => {
            const n = Number(offset)
            if (Number.isInteger(n) && n !== task.offset_days) upd({ offset_days: n })
            else setOffset(String(task.offset_days))
          }}
        />
      </td>
      <td>
        <select className="input h-9 min-w-28 text-sm" aria-label="顏色標籤" value={task.color_tag_id ?? ''} disabled={!online} onChange={(e) => upd({ color_tag_id: e.target.value || null })}>
          <option value="">跟隨專案</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap text-xs text-text-2">{describeOffset(task.anchor, task.offset_days)}</td>
      <td>
        <Button variant="ghost" size="sm" iconOnly aria-label={`刪除 ${task.name}`} disabled={!online} onClick={() => m.removeTask.mutate(task.id)} icon={<Trash2 size={14} />} />
      </td>
    </tr>
  )
}

function NewTaskForm({ typeId, count }: { typeId: string; count: number }) {
  const online = useOnline()
  const m = useTemplateMutations()
  const [name, setName] = useState('')
  const [anchor, setAnchor] = useState<AnchorKind>('apply_deadline')
  const [offset, setOffset] = useState('-7')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(offset)
    if (!name.trim() || !Number.isInteger(n)) return
    await m.createTask.mutateAsync({ project_type_id: typeId, name: name.trim(), anchor, offset_days: n, color_tag_id: null, sort_order: count + 1 })
    setName('')
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-line-soft pt-4">
      <input className="input h-9 min-w-40 flex-1 text-sm" placeholder="新任務，例如：完成作品集" aria-label="新任務名稱" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="input h-9 w-36 text-sm" aria-label="新任務錨點" value={anchor} onChange={(e) => setAnchor(e.target.value as AnchorKind)}>
        {ANCHORS.map((a) => (
          <option key={a} value={a}>
            {ANCHOR_LABEL[a]}
          </option>
        ))}
      </select>
      <input className="input tabular h-9 w-24 text-right font-mono text-sm" type="number" step={1} aria-label="新任務偏移天數" value={offset} onChange={(e) => setOffset(e.target.value)} />
      <span className="text-sm text-text-2">天</span>
      <Button type="submit" variant="secondary" size="sm" className="h-9" icon={<Plus size={14} />} disabled={!online || !name.trim()}>
        新增
      </Button>
    </form>
  )
}

export function TemplatesSection() {
  const types = useOptionSet('project_type')
  const [typeId, setTypeId] = useState<string>('')
  useEffect(() => {
    if (!typeId && types.items[0]) setTypeId(types.items[0].id)
  }, [types.items, typeId])
  const stagesQ = useStageTemplates()
  const tasksQ = useTemplateTasks()
  const m = useTemplateMutations()
  const stages = stagesOf(stagesQ.data, typeId)
  const tasks = (tasksQ.data ?? []).filter((t) => t.project_type_id === typeId).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="專案類型">
        {types.items.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === typeId} onClick={() => setTypeId(t.id)} className={cn('chip', t.id === typeId && 'selected')}>
            {t.label}
          </button>
        ))}
      </div>
      {typeId && (
        <>
          <Card title="階段">
            <p className="-mt-2 mb-4 text-sm text-text-2">專案的「目前階段」從這裡選，進度會依階段順序自動計算。刪除階段時，正在該階段的專案會變成「未設定階段」。</p>
            <OrderedListEditor
              numbered
              rows={stages.map((s) => ({ id: s.id, label: s.name }))}
              onRename={(id, name) => m.renameStage.mutate({ id, name })}
              onReorder={(ids) => m.reorderStages.mutate(ids)}
              onDelete={(id) => m.removeStage.mutateAsync(id)}
              onAdd={(name) => m.createStage.mutateAsync({ typeId, name, sortOrder: stages.length + 1 })}
              addPlaceholder="新增階段"
              deleteHint="正在這個階段的專案會變成「未設定階段」。"
            />
          </Card>
          <Card title="錨點任務">
            <p className="-mt-2 mb-4 text-sm text-text-2">建立專案或按「從模板產生」時，依錨點日期＋偏移天數產生時間軸任務（負數＝之前）。錨點日期空白的任務會略過。</p>
            {tasks.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>任務</th>
                      <th>錨點</th>
                      <th>偏移（天）</th>
                      <th>顏色</th>
                      <th>說明</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-3">此類型尚無錨點任務</p>
            )}
            <NewTaskForm typeId={typeId} count={tasks.length} />
          </Card>
        </>
      )}
    </div>
  )
}
