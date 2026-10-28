import { Plus, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui'
import { useChecklist } from '@/data/hooks'
import { useProjectMutations, useProjectTasks, useTemplateTasks } from '@/data/projectHooks'
import type { ChecklistItem, Project } from '@/data/types'
import { useTimelineEditor } from '@/features/timeline/EditorContext'
import { ItemCard } from '@/features/timeline/ItemCard'
import { diffDays, formatDate, weekdayZh } from '@/lib/dates'
import { describeOffset, planTemplateTasks } from '@/lib/projects'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

export function TasksCard({ project }: { project: Project }) {
  const today = useToday()
  const online = useOnline()
  const tasks = useProjectTasks(project.id)
  const templates = useTemplateTasks()
  const { openCreate } = useTimelineEditor()
  const m = useProjectMutations()
  const [msg, setMsg] = useState<string | null>(null)
  const list = tasks.data ?? []
  const checklistQ = useChecklist(list.filter((t) => t.kind === 'checklist').map((t) => t.id))
  const checklists = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>()
    for (const c of checklistQ.data ?? []) map.set(c.timeline_item_id, [...(map.get(c.timeline_item_id) ?? []), c])
    return map
  }, [checklistQ.data])

  const plan = planTemplateTasks(
    (templates.data ?? []).filter((t) => t.project_type_id === project.type_id),
    project,
    list.map((t) => t.template_task_id).filter((x): x is string => Boolean(x)),
    project.color_tag_id,
  )

  const generate = async () => {
    setMsg(null)
    const n = await m.generateTasks.mutateAsync({ id: project.id, tasks: plan.create })
    setMsg(`已產生 ${n} 筆任務${plan.skippedNoAnchor.length ? `，錨點日期未填而略過 ${plan.skippedNoAnchor.length} 筆` : ''}。`)
  }

  const open = list.filter((t) => !t.is_done).length

  return (
    <Card
      title={`時間軸任務 · ${open} 未完成`}
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={14} />}
          disabled={!online}
          onClick={() => openCreate({ project_id: project.id, color_tag_id: project.color_tag_id, item_date: today })}
        >
          新增任務
        </Button>
      }
    >
      {(plan.create.length > 0 || plan.skippedNoAnchor.length > 0) && (
        <div className="card-inset mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-text-2">
            {plan.create.length > 0 ? `階段模板還有 ${plan.create.length} 筆任務可產生。` : ''}
            {plan.skippedNoAnchor.length > 0 && ` ${plan.skippedNoAnchor.length} 筆因錨點日期未填無法產生（${plan.skippedNoAnchor.map((s) => describeOffset(s.anchor, s.offset_days)).join('、')}）。`}
          </p>
          {plan.create.length > 0 && (
            <Button variant="primary" size="sm" icon={<Wand2 size={14} />} loading={m.generateTasks.isPending} disabled={!online} onClick={() => void generate()}>
              從模板產生
            </Button>
          )}
        </div>
      )}
      {msg && <Alert tone="success" className="mb-4">{msg}</Alert>}

      {tasks.isLoading ? (
        <div className="skeleton h-16" />
      ) : list.length === 0 ? (
        <EmptyState compact title="還沒有任務" />
      ) : (
        <ul className="space-y-1">
          {list.map((t) => {
            const late = !t.is_done && t.item_date < today ? diffDays(t.item_date, today) : 0
            return (
              <li key={t.id} className="grid grid-cols-[92px_1fr] items-start gap-3 border-b border-dashed border-line-soft py-2 last:border-0">
                <div className="pt-1.5">
                  <p className="tabular font-mono text-[12px]">{formatDate(t.item_date).slice(5)}</p>
                  <p className="text-[11px] text-text-3">{weekdayZh(t.item_date)}</p>
                </div>
                <div className="min-w-0">
                  <ItemCard
                    item={t}
                    variant="row"
                    checklist={checklists.get(t.id)}
                    note={
                      <>
                        {t.source === 'template' && t.anchor && t.offset_days !== null && <Badge tone="lavender">{describeOffset(t.anchor, t.offset_days)}</Badge>}
                        {t.is_manually_adjusted && <Badge tone="warning">已手動調整</Badge>}
                        {late > 0 && <span className="font-semibold text-danger">逾期 {late} 天</span>}
                      </>
                    }
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
