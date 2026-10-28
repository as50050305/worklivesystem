import { Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, ConfirmDialog, EmptyState } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'
import { useOnline } from '@/pwa/useOnline'

export interface NoteLike {
  id: string
  content: string
  created_at: string
  updated_at: string
}

/** 筆記串：最新在上、快速新增（Ctrl／⌘ + Enter）、可編輯與刪除（專案筆記、客戶速記共用） */
export function NotesThread({
  notes,
  onAdd,
  onUpdate,
  onRemove,
  placeholder = '寫下筆記…',
  loading,
}: {
  notes: NoteLike[]
  onAdd: (content: string) => Promise<unknown>
  onUpdate: (id: string, content: string) => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
  placeholder?: string
  loading?: boolean
}) {
  const online = useOnline()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [toDelete, setToDelete] = useState<NoteLike | null>(null)

  const add = async (e?: FormEvent) => {
    e?.preventDefault()
    const c = draft.trim()
    if (!c) return
    setBusy(true)
    try {
      await onAdd(c)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  const sorted = [...notes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <div>
      <form onSubmit={add} className="mb-4">
        <textarea
          className="input min-h-20 text-sm"
          value={draft}
          disabled={!online}
          placeholder={online ? placeholder : '離線中無法新增'}
          aria-label="新增筆記"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add()
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-text-3">Ctrl／⌘ + Enter 送出</span>
          <Button type="submit" size="sm" variant="primary" loading={busy} disabled={!draft.trim() || !online}>
            新增筆記
          </Button>
        </div>
      </form>
      {loading ? (
        <div className="skeleton h-16" />
      ) : sorted.length === 0 ? (
        <EmptyState compact title="還沒有筆記" />
      ) : (
        <ol className="relative space-y-4 border-l border-dashed border-line-soft pl-5">
          {sorted.map((n) => (
            <li key={n.id} className="relative">
              <span aria-hidden className="absolute -left-[25px] top-1.5 size-2 rounded-full border border-line bg-surface" />
              <div className="flex items-center justify-between gap-2">
                <time className="tabular font-mono text-[11px] text-text-2" dateTime={n.created_at}>
                  {formatDateTime(n.created_at)}
                  {n.updated_at && n.updated_at.slice(0, 19) !== n.created_at.slice(0, 19) && <span className="ml-2 text-text-3">（已編輯）</span>}
                </time>
                {editing !== n.id && (
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" iconOnly aria-label="編輯筆記" disabled={!online} onClick={() => { setEditing(n.id); setEditText(n.content) }} icon={<Pencil size={13} />} />
                    <Button variant="ghost" size="sm" iconOnly aria-label="刪除筆記" disabled={!online} onClick={() => setToDelete(n)} icon={<Trash2 size={13} />} />
                  </span>
                )}
              </div>
              {editing === n.id ? (
                <div className="mt-1">
                  <textarea className="input min-h-20 text-sm" value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="編輯筆記內容" autoFocus />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!editText.trim()}
                      onClick={async () => {
                        await onUpdate(n.id, editText.trim())
                        setEditing(null)
                      }}
                    >
                      儲存
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{n.content}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="確定要刪除這則筆記？"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const n = toDelete
          setToDelete(null)
          if (n) await onRemove(n.id)
        }}
      >
        {toDelete?.content.slice(0, 80)}
      </ConfirmDialog>
    </div>
  )
}
