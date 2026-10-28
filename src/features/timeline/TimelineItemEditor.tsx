import { GripVertical, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Checkbox, ConfirmDialog, DatePicker, Input, Select, Tabs, Textarea } from '@/components/ui'
import { useChecklist, useColorTags, useTimelineMutations } from '@/data/hooks'
import type { ChecklistDraft, RecurrenceKind, RecurrenceUnit, TimelineItemInput, TimelineKind } from '@/data/types'
import { formatTime, parseTimeInput } from '@/lib/calendar'
import { formatDate, todayTaipei } from '@/lib/dates'
import { describeRecurrence, isValidRule, nextOccurrenceDate } from '@/lib/recurrence'
import { useOnline } from '@/pwa/useOnline'
import type { EditorTarget } from './EditorContext'
import { TagPicker } from './TagPicker'

const RECURRENCE_OPTIONS: { value: RecurrenceKind; label: string }[] = [
  { value: 'none', label: '不重複' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
  { value: 'bimonthly', label: '每兩月' },
  { value: 'custom', label: '自訂…' },
]

export function TimelineItemEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const online = useOnline()
  const { data: tags = [] } = useColorTags()
  const m = useTimelineMutations()
  const editing = target.mode === 'edit' ? target.item : null
  const d = target.mode === 'create' ? target.defaults : {}

  const [title, setTitle] = useState(editing?.title ?? d.title ?? '')
  const [date, setDate] = useState(editing?.item_date ?? d.item_date ?? todayTaipei())
  const [timeText, setTimeText] = useState(formatTime(editing?.item_time ?? d.item_time ?? null))
  const [tagId, setTagId] = useState<string | null>(editing?.color_tag_id ?? d.color_tag_id ?? null)
  const [kind, setKind] = useState<TimelineKind>(editing?.kind ?? d.kind ?? 'normal')
  const [content, setContent] = useState(editing?.content ?? d.content ?? '')
  const [recurrence, setRecurrence] = useState<RecurrenceKind>(editing?.recurrence ?? d.recurrence ?? 'none')
  const [intervalText, setIntervalText] = useState<string>(String(editing?.recurrence_interval ?? d.recurrence_interval ?? 1))
  const [unit, setUnit] = useState<RecurrenceUnit>(editing?.recurrence_unit ?? d.recurrence_unit ?? 'day')
  const [isDone, setIsDone] = useState(editing?.is_done ?? false)
  const [checklist, setChecklist] = useState<ChecklistDraft[] | null>(editing ? null : [{ content: '', is_done: false }])
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const existing = useChecklist(editing && editing.kind === 'checklist' ? [editing.id] : [])
  useEffect(() => {
    if (checklist === null && (existing.data || !editing || editing.kind !== 'checklist')) {
      const rows = (existing.data ?? []).map((c) => ({ id: c.id, content: c.content, is_done: c.is_done }))
      setChecklist(rows.length ? rows : [{ content: '', is_done: false }])
    }
  }, [existing.data, checklist, editing])

  useEffect(() => {
    const dlg = ref.current
    if (dlg && !dlg.open) dlg.showModal()
  }, [])

  // 新增時預設標籤：未分類
  useEffect(() => {
    if (!tagId && tags.length) setTagId(tags.find((t) => t.is_default)?.id ?? null)
  }, [tags, tagId])

  const rule = useMemo(
    () => ({ recurrence, recurrence_interval: recurrence === 'custom' ? Number(intervalText) : null, recurrence_unit: recurrence === 'custom' ? unit : null }),
    [recurrence, intervalText, unit],
  )
  const nextPreview = recurrence !== 'none' && isValidRule(rule) ? nextOccurrenceDate(date, rule, editing?.series_start_on) : null
  const busy = m.create.isPending || m.update.isPending || m.remove.isPending

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) return setError('請輸入標題')
    const time = parseTimeInput(timeText)
    if (time === undefined) return setError('時間格式不正確，例如 09:30（留空代表整天）')
    if (recurrence === 'custom' && !isValidRule(rule)) return setError('自訂重複請填入大於 0 的整數')

    const input: TimelineItemInput = {
      title: title.trim(),
      item_date: date,
      item_time: time,
      color_tag_id: tagId,
      kind,
      content: content.trim() || null,
      ...rule,
      ...(target.mode === 'create' ? { project_id: d.project_id ?? null, client_id: d.client_id ?? null } : {}),
    }
    const drafts = kind === 'checklist' ? (checklist ?? []).filter((c) => c.content.trim()) : undefined
    try {
      if (editing) {
        await m.update.mutateAsync({
          item: editing,
          patch: input,
          checklist: kind === 'checklist' ? drafts : editing.kind === 'checklist' ? [] : undefined,
          existingChecklist: existing.data ?? [],
        })
        if (isDone !== editing.is_done) await m.toggleDone.mutateAsync({ ...editing, ...input, is_done: editing.is_done })
      } else {
        const created = await m.create.mutateAsync({ input, checklist: drafts })
        if (isDone) await m.toggleDone.mutateAsync(created)
      }
      onClose()
    } catch {
      /* 錯誤由全域錯誤列顯示 */
    }
  }

  const updateRow = (i: number, patch: Partial<ChecklistDraft>) =>
    setChecklist((rows) => (rows ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="editor-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(500px,100vw)] max-w-none overflow-hidden border-l border-line bg-surface p-0 text-text backdrop:bg-[var(--c-backdrop)] sm:rounded-l-[var(--r-2xl)]"
    >
      <form onSubmit={submit} className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
          <div className="min-w-0">
            <p className="label-caps text-[11px] text-text-2">{editing ? '編輯項目' : '新增項目'}</p>
            <h2 id="editor-title" className="truncate text-lg font-semibold">
              {title || '未命名'}
            </h2>
          </div>
          <Button variant="ghost" iconOnly size="sm" aria-label="關閉" onClick={onClose} icon={<X size={18} strokeWidth={1.5} />} />
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {!online && <Alert tone="warning">離線中，暫時無法儲存變更。</Alert>}
          {editing && (editing.is_manually_adjusted || editing.source === 'template') && (
            <div className="flex flex-wrap gap-2">
              {editing.source === 'template' && <Badge tone="lavender">由模板產生</Badge>}
              {editing.is_manually_adjusted && <Badge tone="warning">已手動調整日期</Badge>}
            </div>
          )}

          <Input label="標題" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!editing} placeholder="例如：繳電話費" required />

          <div className="grid grid-cols-[1fr_130px] gap-4">
            <DatePicker label="日期" value={date} onChange={(v) => v && setDate(v)} />
            <Input label="時間" value={timeText} onChange={(e) => setTimeText(e.target.value)} placeholder="整天" className="tabular font-mono" inputMode="numeric" help="空白＝整天" />
          </div>

          <div>
            <p className="field-label">顏色標籤</p>
            <TagPicker value={tagId} onChange={setTagId} />
          </div>

          <div>
            <p className="field-label">類型</p>
            <Tabs
              items={[
                { value: 'normal', label: '一般' },
                { value: 'checklist', label: '清單型' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>

          {kind === 'checklist' && (
            <div>
              <p className="field-label">清單項目</p>
              <ul className="space-y-2">
                {(checklist ?? []).map((row, i) => (
                  <li key={row.id ?? `new-${i}`} className="flex items-center gap-2">
                    <GripVertical size={14} className="flex-none text-text-3" aria-hidden />
                    <input type="checkbox" className="check" checked={row.is_done} aria-label={`完成：${row.content || '新項目'}`} onChange={(e) => updateRow(i, { is_done: e.target.checked })} />
                    <input
                      className="input h-9 flex-1 text-sm"
                      value={row.content}
                      placeholder="清單項目"
                      aria-label={`清單項目 ${i + 1}`}
                      onChange={(e) => updateRow(i, { content: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          setChecklist((rows) => [...(rows ?? []).slice(0, i + 1), { content: '', is_done: false }, ...(rows ?? []).slice(i + 1)])
                          requestAnimationFrame(() => {
                            const inputs = ref.current?.querySelectorAll<HTMLInputElement>('input[aria-label^="清單項目"]')
                            inputs?.[i + 1]?.focus()
                          })
                        }
                      }}
                    />
                    <Button variant="ghost" size="sm" iconOnly aria-label="移除此項" onClick={() => setChecklist((rows) => (rows ?? []).filter((_, j) => j !== i))} icon={<X size={14} />} />
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" className="mt-2" icon={<Plus size={14} />} onClick={() => setChecklist((rows) => [...(rows ?? []), { content: '', is_done: false }])}>
                新增清單項目
              </Button>
            </div>
          )}

          <Textarea label="內容" value={content} onChange={(e) => setContent(e.target.value)} placeholder="備註、連結…" />

          <div>
            <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
              <Select label="重複" value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceKind)}>
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {recurrence === 'custom' && (
                <>
                  <Input label="每" type="number" min={1} value={intervalText} onChange={(e) => setIntervalText(e.target.value)} className="w-20 font-mono" />
                  <Select label="單位" value={unit} onChange={(e) => setUnit(e.target.value as RecurrenceUnit)}>
                    <option value="day">天</option>
                    <option value="week">週</option>
                    <option value="month">個月</option>
                  </Select>
                </>
              )}
            </div>
            {nextPreview && (
              <p className="field-help flex items-center gap-1.5">
                <Repeat size={12} /> {describeRecurrence(rule)}：勾選完成後自動產生下一筆（{formatDate(nextPreview)}）
              </p>
            )}
          </div>

          <Checkbox label="已完成" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} />
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <footer className="flex items-center gap-3 border-t border-line-soft px-6 py-4">
          {editing && (
            <Button variant="danger" size="sm" iconOnly aria-label="刪除" disabled={!online || busy} onClick={() => setConfirmDelete(true)} icon={<Trash2 size={15} />} />
          )}
          <div className="ml-auto flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="primary" bracket loading={busy} disabled={!online}>
              儲存
            </Button>
          </div>
        </footer>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={`確定要刪除「${editing?.title ?? ''}」？`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!editing) return
          setConfirmDelete(false)
          try {
            await m.remove.mutateAsync(editing.id)
            onClose()
          } catch {
            /* 全域錯誤列 */
          }
        }}
      >
        {editing?.recurrence !== 'none' ? '只會刪除這一筆，同系列已產生的其他項目會保留。' : '刪除後無法復原。'}
      </ConfirmDialog>
    </dialog>
  )
}
