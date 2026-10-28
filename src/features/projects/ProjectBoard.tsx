import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { stagePatch, stagesOf, useProjectMutations, useStageTemplates } from '@/data/projectHooks'
import type { Project } from '@/data/types'
import { cn } from '@/lib/cn'
import type { PlainDate } from '@/lib/dates'
import { useOnline } from '@/pwa/useOnline'
import { MilestoneText, ProgressLine, TagDot } from './shared'

const NO_STAGE = '__none__'

function BoardCard({ project, today, overlay = false }: { project: Project; today: PlainDate; overlay?: boolean }) {
  const online = useOnline()
  const drag = useDraggable({ id: overlay ? `${project.id}:overlay` : project.id, data: { project }, disabled: overlay || !online })
  const { 'aria-disabled': _a, role: _r, ...attrs } = drag.attributes
  return (
    <article
      ref={drag.setNodeRef}
      {...(overlay ? {} : { ...drag.listeners, ...attrs })}
      aria-label={project.name}
      className={cn(
        'rounded-2xl border border-line bg-surface p-3 text-sm',
        !overlay && online && 'cursor-grab touch-manipulation active:cursor-grabbing',
        drag.isDragging && 'opacity-30',
        overlay && 'elev-1 rotate-2',
      )}
    >
      <Link to={`/projects/${project.id}`} className="flex items-start gap-2 font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
        <TagDot tagId={project.color_tag_id} className="mt-1.5" />
        <span className="min-w-0 break-words">{project.name}</span>
      </Link>
      {(project.city || project.country) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-text-2">
          <MapPin size={11} /> {[project.city, project.country].filter(Boolean).join('・')}
        </p>
      )}
      <div className="mt-2">
        <MilestoneText project={project} today={today} />
      </div>
      <ProgressLine value={Number(project.progress)} className="mt-2" />
    </article>
  )
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn('flex w-60 flex-none flex-col rounded-[var(--r-xl)] border border-dashed border-line-soft bg-surface-3/40', isOver && 'border-primary-ink bg-primary-soft')}
    >
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <h3 className="label-caps text-[11px] text-text-2">{title}</h3>
        <span className="tabular font-mono text-[11px] text-text-3">{count}</span>
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  )
}

/** 看板：依「階段」分欄（階段由類型的模板決定），拖移卡片即可改階段；進度未手動覆寫時自動重算 */
export function ProjectBoard({ projects, typeId, today }: { projects: Project[]; typeId: string; today: PlainDate }) {
  const stagesQ = useStageTemplates()
  const stages = stagesOf(stagesQ.data, typeId)
  const { update } = useProjectMutations()
  const [dragging, setDragging] = useState<Project | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const list = projects.filter((p) => p.type_id === typeId)
  const inStage = (sid: string) => list.filter((p) => (sid === NO_STAGE ? !p.current_stage_id || !stages.some((s) => s.id === p.current_stage_id) : p.current_stage_id === sid))
  const columns = [...(inStage(NO_STAGE).length || !stages.length ? [{ id: NO_STAGE, name: '未設定階段' }] : []), ...stages]

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const p = e.active.data.current?.project as Project | undefined
    const target = e.over?.id as string | undefined
    if (!p || !target) return
    const sid = target === NO_STAGE ? null : target
    if (sid === p.current_stage_id) return
    update.mutate({ id: p.id, patch: stagePatch(p, stages, sid) })
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging((e.active.data.current?.project as Project) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {columns.map((c) => {
          const items = inStage(c.id)
          return (
            <Column key={c.id} id={c.id} title={c.name} count={items.length}>
              {items.map((p) => (
                <BoardCard key={p.id} project={p} today={today} />
              ))}
            </Column>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <BoardCard project={dragging} today={today} overlay />}</DragOverlay>
    </DndContext>
  )
}
