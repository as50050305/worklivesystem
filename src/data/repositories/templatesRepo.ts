import { getSupabase } from '@/lib/supabase'
import type { AnchorKind, StageTemplate, TemplateTask } from '../types'

export const templatesRepo = {
  async listStages(): Promise<StageTemplate[]> {
    const { data, error } = await getSupabase().from('stage_templates').select('*').order('sort_order')
    if (error) throw error
    return (data ?? []) as StageTemplate[]
  },
  async createStage(projectTypeId: string, name: string, sortOrder: number): Promise<void> {
    const { error } = await getSupabase().from('stage_templates').insert({ project_type_id: projectTypeId, name, sort_order: sortOrder })
    if (error) throw error
  },
  async renameStage(id: string, name: string): Promise<void> {
    const { error } = await getSupabase().from('stage_templates').update({ name }).eq('id', id)
    if (error) throw error
  },
  /** 刪除階段：正在此階段的專案會變成「未設定階段」 */
  async removeStage(id: string): Promise<void> {
    const { error } = await getSupabase().from('stage_templates').delete().eq('id', id)
    if (error) throw error
  },
  async reorderStages(ids: string[]): Promise<void> {
    const sb = getSupabase()
    for (const [i, id] of ids.entries()) {
      const { error } = await sb.from('stage_templates').update({ sort_order: i + 1 }).eq('id', id)
      if (error) throw error
    }
  },

  async listTasks(): Promise<TemplateTask[]> {
    const { data, error } = await getSupabase().from('template_tasks').select('*').order('sort_order')
    if (error) throw error
    return (data ?? []) as TemplateTask[]
  },
  async createTask(input: { project_type_id: string; name: string; anchor: AnchorKind; offset_days: number; color_tag_id: string | null; sort_order: number }): Promise<void> {
    const { error } = await getSupabase().from('template_tasks').insert(input)
    if (error) throw error
  },
  async updateTask(id: string, patch: Partial<Pick<TemplateTask, 'name' | 'anchor' | 'offset_days' | 'color_tag_id' | 'sort_order'>>): Promise<void> {
    const { error } = await getSupabase().from('template_tasks').update(patch).eq('id', id)
    if (error) throw error
  },
  async removeTask(id: string): Promise<void> {
    const { error } = await getSupabase().from('template_tasks').delete().eq('id', id)
    if (error) throw error
  },
}
