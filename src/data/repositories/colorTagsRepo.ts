import { getSupabase } from '@/lib/supabase'
import type { ColorTag } from '../types'

const T = 'color_tags'

export type ColorTagInput = Pick<ColorTag, 'name' | 'color'> & Partial<Pick<ColorTag, 'is_life_todo'>>

/** 顏色標籤（「未分類」is_default 不可刪除，由 RLS 保護） */
export const colorTagsRepo = {
  async list(): Promise<ColorTag[]> {
    const { data, error } = await getSupabase().from(T).select('*').order('sort_order').order('created_at')
    if (error) throw error
    return (data ?? []) as ColorTag[]
  },

  async create(input: ColorTagInput, sortOrder: number): Promise<ColorTag> {
    const { data, error } = await getSupabase()
      .from(T)
      .insert({ ...input, sort_order: sortOrder })
      .select()
      .single()
    if (error) throw error
    return data as ColorTag
  },

  async update(id: string, patch: Partial<ColorTagInput>): Promise<void> {
    const { error } = await getSupabase().from(T).update(patch).eq('id', id)
    if (error) throw error
  },

  /** 刪除後，使用此標籤的項目 color_tag_id 由資料庫設為 null（顯示為「未分類」） */
  async remove(id: string): Promise<void> {
    const { data, error } = await getSupabase().from(T).delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('此標籤不可刪除')
  },

  /** 依傳入順序重設 sort_order */
  async reorder(ids: string[]): Promise<void> {
    const sb = getSupabase()
    const results = await Promise.all(ids.map((id, i) => sb.from(T).update({ sort_order: i }).eq('id', id)))
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  },
}
