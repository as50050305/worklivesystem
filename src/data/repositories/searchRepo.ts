import { getSupabase } from '@/lib/supabase'
import type { TimelineItem } from '../types'

export interface SearchExtras {
  timeline: TimelineItem[]
  projectNotes: { id: string; project_id: string; content: string }[]
  clientNotes: { id: string; client_id: string; content: string }[]
  contracts: { id: string; quote_id: string | null; title: string }[]
}

/** 全域搜尋需要、但各頁沒有整批載入的資料（開啟搜尋時才讀取，並隨快取保存供離線使用） */
export const searchRepo = {
  async extras(): Promise<SearchExtras> {
    const sb = getSupabase()
    const [t, pn, cn, ct] = await Promise.all([
      sb.from('timeline_items').select('*').order('item_date', { ascending: false }).limit(5000),
      sb.from('project_notes').select('id,project_id,content'),
      sb.from('client_notes').select('id,client_id,content'),
      sb.from('contracts').select('id,quote_id,title'),
    ])
    for (const r of [t, pn, cn, ct]) if (r.error) throw r.error
    return {
      timeline: (t.data ?? []) as TimelineItem[],
      projectNotes: (pn.data ?? []) as SearchExtras['projectNotes'],
      clientNotes: (cn.data ?? []) as SearchExtras['clientNotes'],
      contracts: (ct.data ?? []) as SearchExtras['contracts'],
    }
  },
}
