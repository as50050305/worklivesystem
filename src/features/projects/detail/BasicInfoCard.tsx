import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, ConfirmDialog, DatePicker, Input, Select, Spinner } from '@/components/ui'
import { stagePatch, stagesOf, useOptionSet, useProjectMutations, useProjectTasks, useStageTemplates } from '@/data/projectHooks'
import { geocodeRepo } from '@/data/repositories/geocodeRepo'
import type { GeoResult, Project, ProjectInput } from '@/data/types'
import { formatDate } from '@/lib/dates'
import { anchorsChanged, rescheduleTasks, type Reschedule } from '@/lib/projects'
import { useOnline } from '@/pwa/useOnline'

type DateField = 'apply_start_on' | 'apply_deadline_on' | 'event_start_on' | 'event_end_on'

const DATE_FIELDS: { key: DateField; label: string }[] = [
  { key: 'apply_start_on', label: '開始申請日' },
  { key: 'apply_deadline_on', label: '申請截止日' },
  { key: 'event_start_on', label: '活動開始日' },
  { key: 'event_end_on', label: '活動結束日' },
]

export function BasicInfoCard({ project }: { project: Project }) {
  const online = useOnline()
  const types = useOptionSet('project_type')
  const stagesQ = useStageTemplates()
  const tasks = useProjectTasks(project.id)
  const m = useProjectMutations()
  const [pending, setPending] = useState<{ changes: Reschedule[]; skipped: number } | null>(null)

  const save = (patch: Partial<ProjectInput>) => m.update.mutateAsync({ id: project.id, patch })

  /** 規則 C：錨點日期變更 → 詢問是否重算尚未手動調整過的任務 */
  const saveDate = async (key: DateField, value: string | null) => {
    if (project[key] === value) return
    const after = { ...project, [key]: value }
    await save({ [key]: value })
    const changed = anchorsChanged(project, after)
    if (!changed.length) return
    const all = tasks.data ?? []
    const changes = rescheduleTasks(all, after, changed)
    const skipped = all.filter((t) => t.source === 'template' && t.anchor && changed.includes(t.anchor) && (t.is_manually_adjusted || t.is_done)).length
    if (changes.length) setPending({ changes, skipped })
  }

  const changeType = async (typeId: string) => {
    const stages = stagesOf(stagesQ.data, typeId)
    await save({ type_id: typeId || null, ...stagePatch(project, stages, stages[0]?.id ?? null) })
  }

  /* ---------- 地點 ---------- */
  const [city, setCity] = useState(project.city ?? '')
  const [country, setCountry] = useState(project.country ?? '')
  const [lat, setLat] = useState(project.latitude?.toString() ?? '')
  const [lng, setLng] = useState(project.longitude?.toString() ?? '')
  const [geoQ, setGeoQ] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoResults, setGeoResults] = useState<GeoResult[] | null>(null)
  const [geoErr, setGeoErr] = useState<string | null>(null)
  useEffect(() => {
    setCity(project.city ?? '')
    setCountry(project.country ?? '')
    setLat(project.latitude?.toString() ?? '')
    setLng(project.longitude?.toString() ?? '')
  }, [project.city, project.country, project.latitude, project.longitude])

  const saveCoords = () => {
    const la = lat.trim() === '' ? null : Number(lat)
    const lo = lng.trim() === '' ? null : Number(lng)
    if ((la !== null && (!Number.isFinite(la) || la < -90 || la > 90)) || (lo !== null && (!Number.isFinite(lo) || lo < -180 || lo > 180))) {
      setGeoErr('緯度需介於 -90～90、經度需介於 -180～180')
      return
    }
    setGeoErr(null)
    if (la !== project.latitude || lo !== project.longitude) void save({ latitude: la, longitude: lo })
  }

  const search = async () => {
    const q = geoQ.trim() || [city, country].filter(Boolean).join(' ')
    if (!q) return setGeoErr('請先輸入地名')
    setGeoErr(null)
    setGeoBusy(true)
    try {
      const r = await geocodeRepo.search(q)
      setGeoResults(r)
      if (!r.length) setGeoErr('找不到這個地點，換個寫法試試（例如加上國家）')
    } catch (e) {
      setGeoErr(e instanceof Error ? e.message : String(e))
    } finally {
      setGeoBusy(false)
    }
  }

  return (
    <Card title="基本資料">
      <div className="grid gap-5">
        <Select label="類型" value={project.type_id ?? ''} disabled={!online} onChange={(e) => void changeType(e.target.value)} help="更換類型會把階段重設為新類型的第一個階段">
          <option value="">未設定</option>
          {types.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-2">
          {DATE_FIELDS.map((f) => (
            <DatePicker key={f.key} label={f.label} value={project[f.key]} allowEmpty disabled={!online} onChange={(v) => void saveDate(f.key, v)} />
          ))}
        </div>

        <hr className="divider-dashed" />

        <div>
          <p className="field-label">地點</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="城市" placeholder="城市" value={city} disabled={!online} onChange={(e) => setCity(e.target.value)} onBlur={() => city !== (project.city ?? '') && void save({ city: city.trim() || null })} />
            <Input aria-label="國家" placeholder="國家" value={country} disabled={!online} onChange={(e) => setCountry(e.target.value)} onBlur={() => country !== (project.country ?? '') && void save({ country: country.trim() || null })} />
            <Input aria-label="緯度" placeholder="緯度（例如 25.0330）" className="tabular font-mono" value={lat} disabled={!online} onChange={(e) => setLat(e.target.value)} onBlur={saveCoords} inputMode="decimal" />
            <Input aria-label="經度" placeholder="經度（例如 121.5654）" className="tabular font-mono" value={lng} disabled={!online} onChange={(e) => setLng(e.target.value)} onBlur={saveCoords} inputMode="decimal" />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="input h-10 flex-1 text-sm"
              placeholder="輸入地名查座標，例如：台北市 松山文創園區"
              aria-label="查詢地名"
              value={geoQ}
              onChange={(e) => setGeoQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void search()
                }
              }}
            />
            <Button variant="secondary" size="sm" className="h-10" icon={geoBusy ? <Spinner size={14} /> : <Search size={14} />} disabled={!online || geoBusy} onClick={() => void search()}>
              查詢座標
            </Button>
          </div>
          {geoErr && <p className="field-error">{geoErr}</p>}
          {geoResults && geoResults.length > 0 && (
            <ul className="mt-3 divide-y divide-dashed divide-line-soft rounded-xl border border-line-soft" aria-label="查詢結果">
              {geoResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={async () => {
                      await save({ city: r.city, country: r.country, latitude: r.latitude, longitude: r.longitude })
                      setGeoResults(null)
                      setGeoQ('')
                    }}
                  >
                    <span className="block">{r.label}</span>
                    <span className="tabular font-mono text-[11px] text-text-2">
                      {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="field-help">地點查詢使用 OpenStreetMap，選擇結果後會帶入城市、國家與座標，仍可手動修改。</p>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        danger={false}
        title="是否重新計算尚未手動調整過的任務日期？"
        confirmLabel="重新計算"
        cancelLabel="保留原日期"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const p = pending
          setPending(null)
          if (p) await m.reschedule.mutateAsync(p.changes)
        }}
      >
        <ul className="mt-2 space-y-1">
          {pending?.changes.map((c) => {
            const t = tasks.data?.find((x) => x.id === c.id)
            return (
              <li key={c.id} className="tabular font-mono text-xs">
                {t?.title}：{formatDate(c.from)} → <span className="text-primary-ink">{formatDate(c.to)}</span>
              </li>
            )
          })}
        </ul>
        {!!pending?.skipped && <Alert tone="info" className="mt-3">另有 {pending.skipped} 筆已手動調整或已完成的任務不會變動。</Alert>}
      </ConfirmDialog>
    </Card>
  )
}
