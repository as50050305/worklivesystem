import { MutationCache, QueryClient } from '@tanstack/react-query'

type ErrorListener = (message: string | null) => void
const listeners = new Set<ErrorListener>()

/** 將 Supabase／Postgres 錯誤轉成中文 */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string } | undefined
  const msg = e?.message ?? String(err)
  if (e?.code === '42501' || /row-level security/i.test(msg)) return '沒有權限執行此操作（請確認資料庫 migration 已全部套用）'
  if (e?.code === '23505') return '資料重複，請檢查是否已有相同的項目'
  if (e?.code === '23503') return '此資料仍被其他項目使用，無法刪除'
  if (/failed to fetch|network/i.test(msg)) return '無法連線到伺服器，變更未儲存'
  return msg
}

export function onMutationError(fn: ErrorListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
  mutationCache: new MutationCache({
    onError: (err) => listeners.forEach((fn) => fn(friendlyError(err))),
  }),
})

/** 資料表 → 受影響的查詢 key 前綴 */
export const TABLE_KEYS: Record<string, string[][]> = {
  color_tags: [['color_tags'], ['timeline'], ['sidebar']],
  timeline_items: [['timeline'], ['sidebar'], ['projects']],
  checklist_items: [['checklist'], ['sidebar']],
  projects: [['projects'], ['sidebar']],
  project_notes: [['projects']],
  project_costs: [['projects']],
  project_links: [['projects']],
  attachments: [['projects']],
  option_items: [['options'], ['sidebar'], ['projects']],
  stage_templates: [['templates'], ['projects']],
  template_tasks: [['templates']],
  collections: [['collections'], ['sidebar']],
  clients: [['clients']],
  app_settings: [['settings']],
}

export function invalidateTable(table: string): void {
  for (const key of TABLE_KEYS[table] ?? []) void queryClient.invalidateQueries({ queryKey: key })
}
