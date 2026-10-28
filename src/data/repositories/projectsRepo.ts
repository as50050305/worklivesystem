import { getSupabase } from '@/lib/supabase'
import { OWNER_ID } from '../owner'
import type { Attachment, Project, ProjectCost, ProjectCountdownRow, ProjectInput, ProjectLink, ProjectNote } from '../types'

const BUCKET = 'attachments'

/** 檔名清理：保留中英文數字與 .-_，避免 Storage 路徑問題 */
function safeName(name: string): string {
  const cleaned = name.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/_+/g, '_')
  return cleaned.slice(-80) || 'file'
}

export const projectsRepo = {
  async list(): Promise<Project[]> {
    const { data, error } = await getSupabase().from('projects').select('*').order('sort_order').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Project[]
  },

  async get(id: string): Promise<Project | null> {
    const { data, error } = await getSupabase().from('projects').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as Project | null
  },

  async create(input: ProjectInput): Promise<Project> {
    const { data, error } = await getSupabase().from('projects').insert(input).select().single()
    if (error) throw error
    return data as Project
  },

  async update(id: string, patch: Partial<ProjectInput>): Promise<Project> {
    const { data, error } = await getSupabase().from('projects').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data as Project
  },

  /** 刪除專案：先刪 Storage 上的附件檔，再刪資料（筆記、成本、網址、任務會一併刪除） */
  async remove(id: string): Promise<void> {
    const sb = getSupabase()
    const { data: atts } = await sb.from('attachments').select('storage_path').eq('project_id', id)
    const paths = (atts ?? []).map((a: { storage_path: string }) => a.storage_path)
    if (paths.length) await sb.storage.from(BUCKET).remove(paths)
    const { error } = await sb.from('projects').delete().eq('id', id)
    if (error) throw error
  },

  /** 狀態為「進行中」（系統鍵 active）的專案，倒數用 */
  async listActiveForCountdown(): Promise<ProjectCountdownRow[]> {
    const sb = getSupabase()
    const { data: opt, error: e1 } = await sb.from('option_items').select('id').eq('category', 'project_status').eq('key', 'active').maybeSingle()
    if (e1) throw e1
    if (!opt) return []
    const { data, error } = await sb
      .from('projects')
      .select('id,name,apply_deadline_on,event_start_on,color_tag_id')
      .eq('status_id', (opt as { id: string }).id)
    if (error) throw error
    return (data ?? []) as ProjectCountdownRow[]
  },

  /* ---------- 筆記 ---------- */
  async listNotes(projectId: string): Promise<ProjectNote[]> {
    const { data, error } = await getSupabase().from('project_notes').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ProjectNote[]
  },
  async addNote(projectId: string, content: string): Promise<void> {
    const { error } = await getSupabase().from('project_notes').insert({ project_id: projectId, content })
    if (error) throw error
  },
  async updateNote(id: string, content: string): Promise<void> {
    const { error } = await getSupabase().from('project_notes').update({ content }).eq('id', id)
    if (error) throw error
  },
  async removeNote(id: string): Promise<void> {
    const { error } = await getSupabase().from('project_notes').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 成本 ---------- */
  async listCosts(projectId: string): Promise<ProjectCost[]> {
    const { data, error } = await getSupabase().from('project_costs').select('*').eq('project_id', projectId).order('sort_order').order('created_at')
    if (error) throw error
    return (data ?? []) as ProjectCost[]
  },
  async addCost(projectId: string, cost: { item: string; amount: number; currency: string; sort_order: number }): Promise<void> {
    const { error } = await getSupabase().from('project_costs').insert({ project_id: projectId, ...cost })
    if (error) throw error
  },
  async updateCost(id: string, patch: Partial<Pick<ProjectCost, 'item' | 'amount' | 'currency'>>): Promise<void> {
    const { error } = await getSupabase().from('project_costs').update(patch).eq('id', id)
    if (error) throw error
  },
  async removeCost(id: string): Promise<void> {
    const { error } = await getSupabase().from('project_costs').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 網址 ---------- */
  async listLinks(projectId: string): Promise<ProjectLink[]> {
    const { data, error } = await getSupabase().from('project_links').select('*').eq('project_id', projectId).order('sort_order').order('created_at')
    if (error) throw error
    return (data ?? []) as ProjectLink[]
  },
  async addLink(projectId: string, url: string, title: string | null, sortOrder: number): Promise<void> {
    const { error } = await getSupabase().from('project_links').insert({ project_id: projectId, url, title, sort_order: sortOrder })
    if (error) throw error
  },
  async removeLink(id: string): Promise<void> {
    const { error } = await getSupabase().from('project_links').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 附件（私有 bucket，以簽名網址開啟） ---------- */
  async listAttachments(projectId: string): Promise<Attachment[]> {
    const { data, error } = await getSupabase().from('attachments').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Attachment[]
  },
  async uploadAttachment(projectId: string, file: File): Promise<void> {
    const sb = getSupabase()
    const path = `${OWNER_ID}/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) throw upErr
    const { error } = await sb.from('attachments').insert({ project_id: projectId, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size })
    if (error) {
      await sb.storage.from(BUCKET).remove([path])
      throw error
    }
  },
  async signedUrl(path: string): Promise<string> {
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 60 * 10)
    if (error) throw error
    return data.signedUrl
  },
  async removeAttachment(att: Attachment): Promise<void> {
    const sb = getSupabase()
    await sb.storage.from(BUCKET).remove([att.storage_path])
    const { error } = await sb.from('attachments').delete().eq('id', att.id)
    if (error) throw error
  },
}
