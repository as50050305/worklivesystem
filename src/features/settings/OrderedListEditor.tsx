import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, ConfirmDialog } from '@/components/ui'
import { useOnline } from '@/pwa/useOnline'

export interface ListRow {
  id: string
  label: string
  /** 系統項目：可改名、排序，不可刪除 */
  locked?: boolean
}

function Row({ row, index, total, onRename, onMove, onDelete, numbered }: { row: ListRow; index: number; total: number; onRename: (label: string) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void; numbered?: boolean }) {
  const online = useOnline()
  const [v, setV] = useState(row.label)
  useEffect(() => setV(row.label), [row.label])
  return (
    <li className="flex items-center gap-2 border-b border-dashed border-line-soft py-2 last:border-0">
      {numbered && <span className="tabular w-6 text-right font-mono text-xs text-text-3">{index + 1}</span>}
      <input
        className="input h-9 flex-1 text-sm"
        aria-label={`名稱：${row.label}`}
        value={v}
        disabled={!online}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => (v.trim() ? v.trim() !== row.label && onRename(v.trim()) : setV(row.label))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {row.locked && (
        <span title="系統選項：自動化規則會用到，可改名但不可刪除" className="text-text-3">
          <Lock size={13} aria-label="系統選項" />
        </span>
      )}
      <Button variant="ghost" size="sm" iconOnly aria-label={`上移 ${row.label}`} disabled={index === 0 || !online} onClick={() => onMove(-1)} icon={<ArrowUp size={14} />} />
      <Button variant="ghost" size="sm" iconOnly aria-label={`下移 ${row.label}`} disabled={index === total - 1 || !online} onClick={() => onMove(1)} icon={<ArrowDown size={14} />} />
      <Button variant="ghost" size="sm" iconOnly aria-label={row.locked ? '系統選項不可刪除' : `刪除 ${row.label}`} disabled={row.locked || !online} onClick={onDelete} icon={<Trash2 size={14} />} />
    </li>
  )
}

/** 可改名、排序、刪除、新增的清單（選項表、階段模板共用） */
export function OrderedListEditor({
  rows,
  onRename,
  onReorder,
  onDelete,
  onAdd,
  addPlaceholder = '新增項目',
  deleteHint,
  numbered,
}: {
  rows: ListRow[]
  onRename: (id: string, label: string) => void
  onReorder: (ids: string[]) => void
  onDelete: (id: string) => Promise<unknown> | void
  onAdd: (label: string) => Promise<unknown>
  addPlaceholder?: string
  deleteHint?: string
  numbered?: boolean
}) {
  const online = useOnline()
  const [draft, setDraft] = useState('')
  const [toDelete, setToDelete] = useState<ListRow | null>(null)
  const move = (i: number, dir: -1 | 1) => {
    const ids = rows.map((r) => r.id)
    const j = i + dir
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    onReorder(ids)
  }
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    await onAdd(draft.trim())
    setDraft('')
  }
  return (
    <div>
      <ul>
        {rows.map((r, i) => (
          <Row key={r.id} row={r} index={i} total={rows.length} numbered={numbered} onRename={(l) => onRename(r.id, l)} onMove={(d) => move(i, d)} onDelete={() => setToDelete(r)} />
        ))}
        {!rows.length && <li className="py-2 text-sm text-text-3">尚無項目</li>}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className="input h-9 flex-1 text-sm" placeholder={addPlaceholder} aria-label={addPlaceholder} value={draft} disabled={!online} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" variant="secondary" size="sm" className="h-9" icon={<Plus size={14} />} disabled={!online || !draft.trim()}>
          新增
        </Button>
      </form>
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.label ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const r = toDelete
          setToDelete(null)
          if (r) await onDelete(r.id)
        }}
      >
        {deleteHint}
      </ConfirmDialog>
    </div>
  )
}
