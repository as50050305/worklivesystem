import { MapPin, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Alert, Badge, Button, Card, EmptyState, Select, Tabs } from '@/components/ui'
import { BoxIllustration, GlobeIllustration } from '@/components/illustrations/Illustrations'
import { stagesOf, useOptionSet, useProjects, useStageTemplates } from '@/data/projectHooks'
import { ProjectBoard } from '@/features/projects/ProjectBoard'
import { ProjectCreateDialog } from '@/features/projects/ProjectCreateDialog'
import { ProjectMap } from '@/features/projects/ProjectMap'
import { MilestoneText, ProgressLine, StatusBadge, TagDot } from '@/features/projects/shared'
import { cn } from '@/lib/cn'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

type View = 'list' | 'board' | 'map'

export function ProjectsPage() {
  const today = useToday()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const view = (['list', 'board', 'map'].includes(params.get('view') ?? '') ? params.get('view') : 'list') as View
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const q = useProjects()
  const types = useOptionSet('project_type')
  const statuses = useOptionSet('project_status')
  const stagesQ = useStageTemplates()
  const [creating, setCreating] = useState(false)

  const statusFilter = params.get('status') ?? 'active' // 預設只看進行中
  const typeFilter = params.get('type') ?? ''
  const boardType = params.get('board') ?? types.items[0]?.id ?? ''

  const projects = useMemo(() => {
    let list = q.data ?? []
    if (statusFilter !== 'all') {
      const sid = statusFilter === 'active' ? statuses.byKey('active')?.id : statusFilter
      list = list.filter((p) => p.status_id === sid)
    }
    if (typeFilter && view !== 'board') list = list.filter((p) => p.type_id === typeFilter)
    return list
  }, [q.data, statusFilter, typeFilter, view, statuses])

  const withLocation = projects.filter((p) => p.latitude != null && p.longitude != null)

  return (
    <>
      <PageHeader
        title="專案"
        eyebrow="Projects"
        actions={
          <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => setCreating(true)}>
            新增專案
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Tabs
          ariaLabel="檢視"
          items={[
            { value: 'list', label: '列表' },
            { value: 'board', label: '看板' },
            { value: 'map', label: '世界地圖' },
          ]}
          value={view}
          onChange={(v) => set('view', v)}
          className="min-w-[240px]"
        />
        <div className="flex flex-wrap items-end gap-3">
          <Select label="狀態" value={statusFilter} onChange={(e) => set('status', e.target.value === 'active' ? '' : e.target.value)} wrapperClassName="w-40">
            <option value="active">進行中</option>
            <option value="all">全部狀態</option>
            {statuses.items
              .filter((s) => s.key !== 'active')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
          </Select>
          {view !== 'board' && (
            <Select label="類型" value={typeFilter} onChange={(e) => set('type', e.target.value)} wrapperClassName="w-44">
              <option value="">全部類型</option>
              {types.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {q.error && <Alert tone="danger">讀取失敗：{(q.error as Error).message}</Alert>}

      {view === 'list' && (
        <Card padded={false} className="overflow-hidden">
          {q.isLoading ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-8" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              illustration={<BoxIllustration />}
              title={q.data?.length ? '沒有符合篩選的專案' : '還沒有專案'}
              action={
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)} disabled={!online}>
                  新增專案
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto p-2 sm:p-4">
              <table className="table">
                <thead>
                  <tr>
                    <th>專案</th>
                    <th>類型</th>
                    <th>狀態</th>
                    <th>階段</th>
                    <th className="w-40">進度</th>
                    <th>倒數</th>
                    <th>地點</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const stage = stagesOf(stagesQ.data, p.type_id).find((s) => s.id === p.current_stage_id)
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/projects/${p.id}`} className="flex items-center gap-2 font-medium hover:underline">
                            <TagDot tagId={p.color_tag_id} />
                            {p.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge tone="lavender">{types.byId(p.type_id)?.label ?? '—'}</Badge>
                        </td>
                        <td>
                          <StatusBadge status={statuses.byId(p.status_id)} />
                        </td>
                        <td className="whitespace-nowrap text-text-2">{stage?.name ?? '—'}</td>
                        <td>
                          <ProgressLine value={Number(p.progress)} />
                        </td>
                        <td className="whitespace-nowrap">
                          <MilestoneText project={p} today={today} />
                        </td>
                        <td className="whitespace-nowrap text-text-2">{[p.city, p.country].filter(Boolean).join('・') || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {view === 'board' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="看板類型">
            {types.items.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === boardType}
                onClick={() => set('board', t.id)}
                className={cn('chip', t.id === boardType && 'selected')}
              >
                {t.label}
                <span className="tabular font-mono text-[11px] opacity-70">{projects.filter((p) => p.type_id === t.id).length}</span>
              </button>
            ))}
          </div>
          {boardType && <ProjectBoard projects={projects} typeId={boardType} today={today} />}
          <p className="mt-3 text-xs text-text-3">拖移卡片即可改階段；進度未手動覆寫時會依階段自動重算。</p>
        </>
      )}

      {view === 'map' && (
        <>
          {withLocation.length === 0 && (
            <Alert tone="info" className="mb-4">
              目前篩選的專案都沒有座標。到專案頁輸入地名並按「查詢座標」即可標在地圖上。
            </Alert>
          )}
          <ProjectMap projects={withLocation} />
          {projects.length > withLocation.length && (
            <div className="mt-4 text-sm text-text-2">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> 未設定座標：
              </span>{' '}
              {projects
                .filter((p) => p.latitude == null || p.longitude == null)
                .map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && '、'}
                    <Link to={`/projects/${p.id}`} className="underline decoration-dotted underline-offset-4">
                      {p.name}
                    </Link>
                  </span>
                ))}
            </div>
          )}
          {projects.length === 0 && <EmptyState illustration={<GlobeIllustration />} title="沒有專案" />}
        </>
      )}

      {creating && <ProjectCreateDialog open={creating} onClose={() => setCreating(false)} />}
    </>
  )
}
