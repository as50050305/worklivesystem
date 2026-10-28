import { getSupabase } from '@/lib/supabase'
import type { OptionCategory, OptionItem } from '../types'

export const optionsRepo = {
  async listAll(): Promise<OptionItem[]> {
    const { data, error } = await getSupabase().from('option_items').select('*').order('category').order('sort_order')
    if (error) throw error
    return (data ?? []) as OptionItem[]
  },
  async create(category: OptionCategory, label: string, sortOrder: number): Promise<OptionItem> {
    const { data, error } = await getSupabase().from('option_items').insert({ category, label, sort_order: sortOrder }).select().single()
    if (error) throw error
    return data as OptionItem
  },
  async rename(id: string, label: string): Promise<void> {
    const { error } = await getSupabase().from('option_items').update({ label }).eq('id', id)
    if (error) throw error
  },
  /** 系統選項（有 key）受資料庫保護，不會被刪除；使用中的選項會回傳 23503 */
  async remove(id: string): Promise<void> {
    const { data, error } = await getSupabase().from('option_items').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('系統選項不可刪除')
  },
  async reorder(ids: string[]): Promise<void> {
    const sb = getSupabase()
    for (const [i, id] of ids.entries()) {
      const { error } = await sb.from('option_items').update({ sort_order: i + 1 }).eq('id', id)
      if (error) throw error
    }
  },
}
