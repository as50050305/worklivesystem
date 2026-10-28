import { isLocalMode } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'

/**
 * 多裝置即時同步：訂閱 public schema 的資料變更，回呼變動的表名。
 * 連線失敗時不影響使用（React Query 仍會在視窗聚焦時重新抓取）。
 */
export const realtimeRepo = {
  subscribe(onChange: (table: string) => void): () => void {
    // 本機模式只有一台電腦，不需要即時同步
    if (isLocalMode) return () => {}
    const sb = getSupabase()
    const channel = sb
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => onChange(payload.table))
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  },
}
