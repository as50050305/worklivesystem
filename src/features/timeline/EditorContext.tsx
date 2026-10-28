import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { TimelineItem, TimelineItemInput } from '@/data/types'
import { TimelineItemEditor } from './TimelineItemEditor'

export type EditorTarget = { mode: 'edit'; item: TimelineItem } | { mode: 'create'; defaults: Partial<TimelineItemInput> }

interface EditorApi {
  openEdit: (item: TimelineItem) => void
  openCreate: (defaults?: Partial<TimelineItemInput>) => void
}

const Ctx = createContext<EditorApi | null>(null)

/** 全域的時間軸項目編輯抽屜（時間軸頁與側邊欄共用） */
export function TimelineEditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const openEdit = useCallback((item: TimelineItem) => setTarget({ mode: 'edit', item }), [])
  const openCreate = useCallback((defaults: Partial<TimelineItemInput> = {}) => setTarget({ mode: 'create', defaults }), [])
  return (
    <Ctx.Provider value={{ openEdit, openCreate }}>
      {children}
      {target && <TimelineItemEditor key={target.mode === 'edit' ? target.item.id : 'new'} target={target} onClose={() => setTarget(null)} />}
    </Ctx.Provider>
  )
}

export function useTimelineEditor(): EditorApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTimelineEditor 必須在 <TimelineEditorProvider> 內使用')
  return v
}
