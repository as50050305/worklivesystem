import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NotesThread } from '@/components/notes/NotesThread'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Select, Spinner, TitleInput } from '@/components/ui'
import { stagePatch, stagesOf, useOptionSet, useProject, useProjectMutations, useProjectNotes, useStageTemplates } from '@/data/projectHooks'
import type { Project } from '@/data/types'
import { BasicInfoCard } from '@/features/projects/detail/BasicInfoCard'
import { AttachmentsCard, CostsCard, CountdownCard, LinksCard, ProgressCard, RelationsCard } from '@/features/projects/detail/SideCards'
import { TasksCard } from '@/features/projects/detail/TasksCard'
import { TagPicker } from '@/features/timeline/TagPicker'
import { useOnline } from '@/pwa/useOnline'

function Header({ project }: { project: Project }) {
  const online = useOnline()
  const nav = useNavigate()
  const types = useOptionSet('project_type')
  const statuses = useOptionSet('project_status')
  const stagesQ = useStageTemplates()
  const stages = stagesOf(stagesQ.data, project.type_id)
  const m = useProjectMutations()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="mb-8">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
        <ArrowLeft size={14} /> 專案
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-[1_1_18rem]">
          <p className="label-caps mb-2 text-text-2">{types.byId(project.type_id)?.label ?? '未設定類型'}</p>
          <TitleInput
            className="text-3xl font-medium tracking-tight sm:text-5xl"
            aria-label="專案名稱"
            value={project.name}
            disabled={!online}
            onCommit={(v) => m.update.mutate({ id: project.id, patch: { name: v } })}
          />
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} disabled={!online} onClick={() => setConfirm(true)}>
          刪除專案
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[200px_220px_1fr]">
        <Select label="狀態" value={project.status_id ?? ''} disabled={!online} onChange={(e) => m.update.mutate({ id: project.id, patch: { status_id: e.target.value || null } })}>
          <option value="">未設定</option>
          {statuses.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          label="目前階段"
          value={project.current_stage_id ?? ''}
          disabled={!online || !stages.length}
          help={!stages.length ? '此類型尚未設定階段模板' : undefined}
          onChange={(e) => m.update.mutate({ id: project.id, patch: stagePatch(project, stages, e.target.value || null) })}
        >
          <option value="">未設定</option>
          {stages.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="field-label">顏色標籤</p>
          <TagPicker value={project.color_tag_id} disabled={!online} onChange={(id) => m.update.mutate({ id: project.id, patch: { color_tag_id: id } })} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={`確定要刪除「${project.name}」？`}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false)
          await m.remove.mutateAsync(project.id)
          nav('/projects')
        }}
      >
        專案的筆記、成本、網址、附件與時間軸任務會一起刪除，無法復原。
      </ConfirmDialog>
    </div>
  )
}

function NotesCard({ project }: { project: Project }) {
  const notes = useProjectNotes(project.id)
  const m = useProjectMutations()
  return (
    <Card title="筆記">
      <NotesThread
        notes={notes.data ?? []}
        loading={notes.isLoading}
        placeholder="記錄進度、想法、聯絡內容…"
        onAdd={(c) => m.addNote.mutateAsync({ id: project.id, content: c })}
        onUpdate={(id, c) => m.updateNote.mutateAsync({ id, content: c })}
        onRemove={(id) => m.removeNote.mutateAsync(id)}
      />
    </Card>
  )
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const q = useProject(id)
  if (q.isLoading) {
    return (
      <div className="grid place-items-center py-20 text-text-2">
        <Spinner size={24} />
      </div>
    )
  }
  if (!q.data) {
    return (
      <Card>
        <EmptyState
          illustration={<BoxIllustration />}
          title="找不到這個專案"
          action={
            <Link to="/projects">
              <Badge>回專案列表</Badge>
            </Link>
          }
        />
      </Card>
    )
  }
  const p = q.data
  return (
    <div className="mx-auto max-w-[1280px]">
      <Header project={p} />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-6">
          <TasksCard project={p} />
          <BasicInfoCard project={p} />
          <NotesCard project={p} />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <ProgressCard project={p} />
          <CountdownCard project={p} />
          <CostsCard project={p} />
          <LinksCard project={p} />
          <AttachmentsCard project={p} />
          <RelationsCard project={p} />
        </div>
      </div>
    </div>
  )
}
