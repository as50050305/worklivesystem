import { getSupabase } from '@/lib/supabase'
import type { PlannedTask, Reschedule } from '@/lib/projects'
import { nextOccurrenceDate } from '@/lib/recurrence'
import type { ChecklistDraft, ChecklistItem, TimelineItem, TimelineItemInput } from '../types'

const T = 'timeline_items'

/** 依規則 D 清理重複欄位：非自訂時不留 interval／unit */
function normalizeRecurrence<T extends Partial<TimelineItemInput>>(input: T): T {
  if (input.recurrence && input.recurrence !== 'custom') {
    return { ...input, recurrence_interval: null, recurrence_unit: null }
  }
  return input
}

export const timelineRepo = {
  async listRange(from: string, to: string): Promise<TimelineItem[]> {
    const { data, error } = await getSupabase()
      .from(T)
      .select('*')
      .gte('item_date', from)
      .lte('item_date', to)
      .order('item_date')
      .order('item_time', { nullsFirst: true })
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as TimelineItem[]
  },

  /** 逾期未完成（限定顏色標籤）—— 側邊欄生活代辦用 */
  async listOverdueByTags(before: string, tagIds: string[]): Promise<TimelineItem[]> {
    if (!tagIds.length) return []
    const { data, error } = await getSupabase()
      .from(T)
      .select('*')
      .lt('item_date', before)
      .eq('is_done', false)
      .in('color_tag_id', tagIds)
      .order('item_date')
    if (error) throw error
    return (data ?? []) as TimelineItem[]
  },

  async create(input: TimelineItemInput): Promise<TimelineItem> {
    const row = normalizeRecurrence(input)
    const { data, error } = await getSupabase()
      .from(T)
      .insert({ ...row, series_start_on: row.recurrence !== 'none' ? row.item_date : null })
      .select()
      .single()
    if (error) throw error
    return data as TimelineItem
  },

  /**
   * 一般編輯。若使用者改了日期，視為手動調整（is_manually_adjusted = true），
   * 之後錨點重算（規則 C）不會覆蓋這筆。
   */
  async update(item: TimelineItem, patch: Partial<TimelineItemInput>): Promise<void> {
    const row: Record<string, unknown> = normalizeRecurrence(patch)
    if (patch.item_date && patch.item_date !== item.item_date) row.is_manually_adjusted = true
    // 開始重複時記錄系列起始日
    if (patch.recurrence && patch.recurrence !== 'none' && item.recurrence === 'none') {
      row.series_start_on = patch.item_date ?? item.item_date
    }
    const { error } = await getSupabase().from(T).update(row).eq('id', item.id)
    if (error) throw error
  },

  /** 拖移改日期：同時標記為手動調整 */
  async moveToDate(id: string, date: string): Promise<void> {
    const { error } = await getSupabase().from(T).update({ item_date: date, is_manually_adjusted: true }).eq('id', id)
    if (error) throw error
  },

  /** 勾選完成；重複項目會由資料庫原子地產生下一筆（日期由規則 D 純函式推算） */
  async complete(item: TimelineItem): Promise<string | null> {
    const next = nextOccurrenceDate(item.item_date, item, item.series_start_on)
    const { data, error } = await getSupabase().rpc('complete_timeline_item', { p_id: item.id, p_next_date: next })
    if (error) throw error
    return (data as string | null) ?? null
  },

  /** 取消完成（已產生的下一筆保留不刪） */
  async uncomplete(id: string): Promise<void> {
    const { error } = await getSupabase().from(T).update({ is_done: false, done_at: null }).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from(T).delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 專案任務 ---------- */

  async listByProject(projectId: string): Promise<TimelineItem[]> {
    const { data, error } = await getSupabase()
      .from(T)
      .select('*')
      .eq('project_id', projectId)
      .order('item_date')
      .order('item_time', { nullsFirst: true })
    if (error) throw error
    return (data ?? []) as TimelineItem[]
  },

  /** 依模板產生任務（source = template，記錄錨點與偏移天數） */
  async createTemplateTasks(projectId: string, tasks: PlannedTask[]): Promise<number> {
    if (!tasks.length) return 0
    const rows = tasks.map((t) => ({
      project_id: projectId,
      title: t.title,
      item_date: t.item_date,
      color_tag_id: t.color_tag_id,
      source: 'template',
      template_task_id: t.template_task_id,
      anchor: t.anchor,
      offset_days: t.offset_days,
      sort_order: t.sort_order,
    }))
    const { data, error } = await getSupabase().from(T).insert(rows).select('id')
    if (error) throw error
    return data?.length ?? 0
  },

  /** 規則 C：重算日期（不標記為手動調整） */
  async reschedule(changes: Reschedule[]): Promise<void> {
    const sb = getSupabase()
    for (const c of changes) {
      const { error } = await sb.from(T).update({ item_date: c.to }).eq('id', c.id).eq('is_manually_adjusted', false).eq('is_done', false)
      if (error) throw error
    }
  },

  /* ---------- 清單子項目 ---------- */

  async listChecklist(itemIds: string[]): Promise<ChecklistItem[]> {
    if (!itemIds.length) return []
    const { data, error } = await getSupabase()
      .from('checklist_items')
      .select('*')
      .in('timeline_item_id', itemIds)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as ChecklistItem[]
  },

  async setChecklistDone(id: string, isDone: boolean): Promise<void> {
    const { error } = await getSupabase().from('checklist_items').update({ is_done: isDone }).eq('id', id)
    if (error) throw error
  },

  /** 以草稿取代整份清單：刪除移除的、更新既有的、新增新的 */
  async saveChecklist(itemId: string, drafts: ChecklistDraft[], existing: ChecklistItem[]): Promise<void> {
    const sb = getSupabase()
    const keep = new Set(drafts.filter((d) => d.id).map((d) => d.id))
    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id)
    if (removed.length) {
      const { error } = await sb.from('checklist_items').delete().in('id', removed)
      if (error) throw error
    }
    for (const [i, d] of drafts.entries()) {
      const content = d.content.trim()
      if (!content) continue
      if (d.id) {
        const { error } = await sb.from('checklist_items').update({ content, is_done: d.is_done, sort_order: i }).eq('id', d.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('checklist_items').insert({ timeline_item_id: itemId, content, is_done: d.is_done, sort_order: i })
        if (error) throw error
      }
    }
  },
}
